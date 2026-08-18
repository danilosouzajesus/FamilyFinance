import type { Request, Response } from 'express';
import { processIncomingPluggyTx } from '@ff/shared';
import {
  sampleBankTransactions,
  sampleBankInvestments,
  RawPluggyTx,
  RawPluggyInvestment,
  normalizePluggyDate,
  inferPaymentMethod,
  isPluggyNotFound,
  PluggyAccountInfo,
} from '@ff/shared';
import { getPluggyClient } from '../services/pluggyService';
import {
  upsertPending,
  listPendingByUser,
  getPending,
  updatePending,
  upsertConnection,
  listConnectionsByUser,
  deleteConnection,
  listAccountMappingsByUser,
  upsertAccountMapping,
} from '../repositories/pluggyStore';

// 1. Config — indica se as chaves da Pluggy estão configuradas no servidor
export function getConfig(req: Request, res: Response) {
  res.json({
    configured: !!getPluggyClient(),
    webhookUrl: process.env.PLUGGY_WEBHOOK_URL || `${req.protocol}://${req.get('host')}/api/pluggy/webhook`,
  });
}

// 2. Connect token — abre o widget de conexão bancária
export async function getConnectToken(req: Request, res: Response) {
  try {
    const client = getPluggyClient();
    if (!client) {
      return res.status(400).json({ error: 'Pluggy não configurado. Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no servidor.' });
    }
    const userId = String(req.query.userId || 'local');
    const options: { clientUserId: string; webhookUrl?: string } = { clientUserId: userId };
    const webhookUrl = process.env.PLUGGY_WEBHOOK_URL || (req.secure ? `${req.protocol}://${req.get('host')}/api/pluggy/webhook` : '');
    if (webhookUrl) options.webhookUrl = webhookUrl;
    const { accessToken } = await client.createConnectToken(undefined, options);
    res.json({ accessToken });
  } catch (err: any) {
    console.error('[Pluggy] Erro ao gerar connect token:', err);
    res.status(500).json({ error: err.message || 'Erro ao gerar connect token.' });
  }
}

// 3. Webhook — Pluggy notifica eventos de transações; processa inline e responde 200
export async function handleWebhook(req: Request, res: Response) {
  const { event, itemId, transactionId } = req.body || {};
  try {
    if ((event === 'transactions/created' || event === 'transactions/updated') && transactionId) {
      const { processWebhookEvent } = await import('../services/pluggyService');
      await processWebhookEvent(itemId, transactionId);
    }
  } catch (e) {
    console.error('[Pluggy] Webhook error:', e);
  }
  res.status(200).send('OK');
}

// 4. Sincronização manual (pull)
export async function syncFromPluggy(req: Request, res: Response) {
  const userId = String(req.query.userId || 'local');
  const shouldWait = req.query.wait === '1';
  const onlyAccountId = req.query.accountId ? String(req.query.accountId) : null;
  const fromDate = req.query.from ? String(req.query.from) : null;
  const client = getPluggyClient();

  const ingestTxs = async (raws: RawPluggyTx[], pluggyItemId?: string) => {
    let synced = 0;
    let skipped = 0;
    for (const raw of raws) {
      const pending = processIncomingPluggyTx(raw, { categories: [] });
      if (await getPending(pending.id)) {
        skipped++;
        continue;
      }
      await upsertPending({ ...pending, userId, pluggyItemId });
      synced++;
    }
    return { synced, skipped };
  };

  if (!client) {
    const samples = sampleBankTransactions().filter((t) => {
      if (onlyAccountId && t.accountId !== onlyAccountId) return false;
      if (fromDate && t.date < fromDate) return false;
      return true;
    });
    const { synced, skipped } = await ingestTxs(samples);
    return res.json({ synced, skipped, removed: [], pending: await listPendingByUser(userId) });
  }

  const connections = await listConnectionsByUser(userId);
  let synced = 0;
  let skipped = 0;
  const removed: string[] = [];
  for (const conn of connections) {
    try {
      let item = await client.fetchItem(conn.itemId);
      if (shouldWait) {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline && ['UPDATING', 'WAITING_USER_ACTION', 'WAITING_USER_INPUT', 'LOGIN_OK'].includes(item.status)) {
          await new Promise((r) => setTimeout(r, 2000));
          try { item = await client.fetchItem(conn.itemId); } catch { break; }
        }
      }
      const accounts = await client.fetchAccounts(conn.itemId);
      for (const account of accounts.results || []) {
        if (onlyAccountId && account.id !== onlyAccountId) continue;
        const txs = await client.fetchAllTransactions(account.id, fromDate ? { dateFrom: fromDate } : undefined);
        const raws: RawPluggyTx[] = txs.map((tx) => ({
          id: tx.id,
          accountId: tx.accountId,
          description: tx.description || tx.descriptionRaw || '',
          amount: tx.amount,
          date: normalizePluggyDate(tx.date),
          paymentMethod: tx.paymentData?.paymentMethod || inferPaymentMethod(tx.description || ''),
          pluggyType: tx.type,
        }));
        const r = await ingestTxs(raws, conn.itemId);
        synced += r.synced;
        skipped += r.skipped;
      }
      await upsertConnection({ ...conn, status: item.status, updatedAt: new Date().toISOString() });
    } catch (e: any) {
      if (isPluggyNotFound(e)) {
        console.warn(`[Pluggy] Sync: item ${conn.itemId} não encontrado na Pluggy — removendo conexão "${conn.connectorName}".`);
        removed.push(conn.connectorName || conn.itemId);
        try { await deleteConnection(conn.itemId); } catch { /* store indisponível */ }
        continue;
      }
      console.error(`[Pluggy] Sync: erro na conexão ${conn.itemId}:`, e.message);
    }
  }
  res.json({ synced, skipped, removed, pending: await listPendingByUser(userId) });
}

// 5. Caixa de Entrada (pendências)
export async function listPending(req: Request, res: Response) {
  const userId = String(req.query.userId || 'local');
  res.json(await listPendingByUser(userId));
}

// 5.1 Investimentos
// Somente ativos com saldo atual acima de zero são listados (investimentos
// liquidados/zerados não têm valor a acompanhar).
export async function listInvestments(req: Request, res: Response) {
  const userId = String(req.query.userId || 'local');
  const client = getPluggyClient();

  if (!client) {
    return res.json({ investments: sampleBankInvestments().filter(inv => (inv.amount ?? 0) > 0) });
  }

  const connections = await listConnectionsByUser(userId);
  const investments: RawPluggyInvestment[] = [];
  for (const conn of connections) {
    try {
      const invPage = await client.fetchInvestments(conn.itemId);
      for (const inv of invPage.results || []) {
        const current = inv.balance ?? inv.amount ?? 0;
        if (current <= 0) continue; // pula ativos com saldo zero ou negativo
        const profit = inv.amountProfit ?? (current - (inv.amountOriginal ?? 0));
        investments.push({
          id: inv.id,
          itemId: conn.itemId,
          name: inv.name,
          type: inv.type,
          subtype: inv.subtype,
          institution: inv.institution?.name || undefined,
          amount: current,
          amountOriginal: inv.amountOriginal,
          amountProfit: profit,
          acquisitionDate: inv.purchaseDate ? normalizePluggyDate(inv.purchaseDate) : undefined,
          annualRate: inv.annualRate ?? inv.fixedAnnualRate ?? inv.rate ?? undefined,
          monthProfit: inv.lastMonthRate,
        });
      }
    } catch (e: any) {
      if (isPluggyNotFound(e)) {
        console.warn(`[Pluggy] Investimentos: item ${conn.itemId} não encontrado — removendo conexão "${conn.connectorName}".`);
        try { await deleteConnection(conn.itemId); } catch { /* store indisponível */ }
        continue;
      }
      console.error(`[Pluggy] Investimentos: erro na conexão ${conn.itemId}:`, e.message);
    }
  }
  res.json({ investments });
}

// 5. Aprovar pendência
export async function approvePending(req: Request, res: Response) {
  const pending = await getPending(req.params.id);
  if (!pending) return res.status(404).json({ error: 'Pendência não encontrada.' });
  const o = req.body?.overrides || {};
  const updated = await updatePending(pending.id, {
    status: 'APPROVED',
    suggestedCategoryId: o.categoryId ?? pending.suggestedCategoryId,
    suggestedCategory: o.category ?? pending.suggestedCategory,
    suggestedSubcategoryId: o.subcategoryId ?? pending.suggestedSubcategoryId,
    suggestedSubcategory: o.subcategory ?? pending.suggestedSubcategory,
    suggestedTagIds: o.tagIds ?? pending.suggestedTagIds,
    amount: o.amount ?? pending.amount,
    date: o.date ?? pending.date,
  });
  res.json(updated);
}

// 6. Conciliar pendência
export async function reconcilePending(req: Request, res: Response) {
  const pending = await getPending(req.params.id);
  if (!pending) return res.status(404).json({ error: 'Pendência não encontrada.' });
  const updated = await updatePending(pending.id, {
    status: 'RECONCILED',
    suggestedReconcileTransactionId: req.body?.targetTransactionId ?? pending.suggestedReconcileTransactionId,
  });
  res.json(updated);
}

// 7. Ignorar pendência
export async function ignorePending(req: Request, res: Response) {
  const pending = await getPending(req.params.id);
  if (!pending) return res.status(404).json({ error: 'Pendência não encontrada.' });
  res.json(await updatePending(pending.id, { status: 'IGNORED' }));
}

// 8. Conexões bancárias
export async function listConnections(req: Request, res: Response) {
  const userId = String(req.query.userId || 'local');
  res.json(await listConnectionsByUser(userId));
}

export async function createConnection(req: Request, res: Response) {
  const { userId, itemId, connectorName, connectorLogoUrl } = req.body || {};
  if (!itemId || !connectorName) return res.status(400).json({ error: 'itemId e connectorName são obrigatórios.' });
  const conn = await upsertConnection({
    id: `conn_${Date.now()}`,
    userId: userId || 'local',
    itemId,
    connectorName,
    connectorLogoUrl,
    status: 'CONNECTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  res.json(conn);
}

export async function removeConnection(req: Request, res: Response) {
  const removed = await deleteConnection(req.params.itemId);
  if (!removed) return res.status(404).json({ error: 'Conexão não encontrada.' });
  res.json({ ok: true });
}

// 8.1 Contas/cartões detectados + mapeamento
export async function listAccounts(req: Request, res: Response) {
  const userId = String(req.query.userId || 'local');
  let connections: Awaited<ReturnType<typeof listConnectionsByUser>> = [];
  let mappings: Awaited<ReturnType<typeof listAccountMappingsByUser>> = [];
  try {
    [connections, mappings] = await Promise.all([
      listConnectionsByUser(userId),
      listAccountMappingsByUser(userId),
    ]);
  } catch (e: any) {
    console.warn('[Pluggy] Erro ao carregar conexões/mapeamentos:', e?.message);
  }
  const mappingByAccount = new Map(mappings.map((m) => [m.pluggyAccountId, m.appAccountId]));

  const client = getPluggyClient();
  const accounts: PluggyAccountInfo[] = [];
  const seen = new Set<string>();

  for (const conn of connections) {
    if (!client) break;
    try {
      const accs = await client.fetchAccounts(conn.itemId);
      for (const acc of accs.results || []) {
        if (seen.has(acc.id)) continue;
        seen.add(acc.id);
        accounts.push({
          pluggyAccountId: acc.id,
          itemId: conn.itemId,
          name: acc.name || acc.marketingName || `Conta ${acc.number}`,
          subtype: acc.subtype,
          mappedAppAccountId: mappingByAccount.get(acc.id) || null,
        });
      }
    } catch (e: any) {
      if (isPluggyNotFound(e)) {
        console.warn(`[Pluggy] Contas: item ${conn.itemId} não encontrado — removendo conexão "${conn.connectorName}".`);
        try { await deleteConnection(conn.itemId); } catch { /* store indisponível */ }
        continue;
      }
      console.warn('[Pluggy] Erro ao buscar contas da conexão:', e?.message);
    }
  }

  if (accounts.length === 0) {
    try {
      const pending = await listPendingByUser(userId);
      const demoNames: Record<string, string> = {
        pluggy_acc_checking: 'Conta Corrente (demo)',
        pluggy_acc_credit: 'Cartão de Crédito (demo)',
      };
      for (const p of pending) {
        if (!p.accountId || seen.has(p.accountId)) continue;
        seen.add(p.accountId);
        accounts.push({
          pluggyAccountId: p.accountId,
          itemId: p.pluggyItemId,
          name: demoNames[p.accountId] || `Conta ${p.accountId}`,
          subtype: p.accountId === 'pluggy_acc_credit' ? 'CREDIT_CARD' : 'CHECKING_ACCOUNT',
          mappedAppAccountId: mappingByAccount.get(p.accountId) || null,
        });
      }
      if (!client && accounts.length === 0) {
        for (const [accId, demoName, subtype] of [
          ['pluggy_acc_checking', 'Conta Corrente (demo)', 'CHECKING_ACCOUNT'],
          ['pluggy_acc_credit', 'Cartão de Crédito (demo)', 'CREDIT_CARD'],
        ] as const) {
          if (seen.has(accId)) continue;
          seen.add(accId);
          accounts.push({
            pluggyAccountId: accId,
            name: demoName,
            subtype,
            mappedAppAccountId: mappingByAccount.get(accId) || null,
          });
        }
      }
    } catch (e: any) {
      console.warn('[Pluggy] Erro ao carregar pendências p/ contas demo:', e?.message);
    }
  }

  res.json(accounts);
}

export async function mapAccount(req: Request, res: Response) {
  const { userId, pluggyAccountId, appAccountId } = req.body || {};
  if (!pluggyAccountId || !appAccountId) {
    return res.status(400).json({ error: 'pluggyAccountId e appAccountId são obrigatórios.' });
  }
  const mapping = await upsertAccountMapping({
    userId: userId || 'local',
    pluggyAccountId,
    appAccountId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  res.json(mapping);
}

// 9. Demo — gera pendências de exemplo
export async function generateDemoPending(req: Request, res: Response) {
  const userId = String(req.query.userId || 'local');
  const generated = await Promise.all(
    sampleBankTransactions().map((raw: RawPluggyTx) => {
      const pending = processIncomingPluggyTx(raw, { categories: [] });
      return upsertPending({ ...pending, userId });
    })
  );
  res.json({ generated: generated.length, pending: await listPendingByUser(userId) });
}

// 10. Diagnóstico interno
export async function pluggyStatus(req: Request, res: Response) {
  const userId = String(req.query.userId || 'local');
  const [pending, connections] = await Promise.all([listPendingByUser(userId), listConnectionsByUser(userId)]);
  res.json({
    configured: !!getPluggyClient(),
    pending: pending.length,
    connections,
  });
}