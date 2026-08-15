import express from "express";
import { GoogleGenAI } from "@google/genai";
import { PluggyClient } from "pluggy-sdk";
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
} from "./pluggyStore";
import { processIncomingPluggyTx } from "../utils/pluggyEngine";
import { inferPaymentMethod, normalizePluggyDate, sampleBankTransactions, RawPluggyTx, sampleBankInvestments, RawPluggyInvestment } from "../utils/pluggy";
import { PluggyAccountInfo } from "../types";

// Helper to safely initialize GoogleGenAI client only when requested
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please configure it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Helper to safely initialize Pluggy client (only when configured)
let pluggyClient: PluggyClient | null = null;

function getPluggyClient(): PluggyClient | null {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (!pluggyClient) {
    pluggyClient = new PluggyClient({ clientId, clientSecret });
  }
  return pluggyClient;
}

// Busca a transação na Pluggy e a converte em pendência classificada
async function processWebhookEvent(itemId: string, transactionId: string) {
  const client = getPluggyClient();
  if (!client) {
    console.warn("[Pluggy] Webhook ignorado: chaves não configuradas.");
    return;
  }
  const tx = await client.fetchTransaction(transactionId);
  const item = await client.fetchItem(itemId);
  const userId = item.clientUserId || "local";

  const raw: RawPluggyTx = {
    id: tx.id,
    accountId: tx.accountId,
    description: tx.description || tx.descriptionRaw || "",
    amount: tx.amount,
    date: normalizePluggyDate(tx.date),
    paymentMethod: tx.paymentData?.paymentMethod || inferPaymentMethod(tx.description || ""),
    pluggyType: tx.type,
  };

  const pending = processIncomingPluggyTx(raw, { categories: [] });
  await upsertPending({ ...pending, userId, pluggyItemId: item.id });

  if (item.connector) {
    await upsertConnection({
      id: `conn_${Date.now()}`,
      userId,
      itemId: item.id,
      connectorName: item.connector.name || "Banco",
      connectorLogoUrl: item.connector.imageUrl,
      status: item.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

// Monta o app Express com todas as rotas de API.
// O entry local (server.ts) adiciona o middleware do Vite/estático e o listen;
// a função serverless do Vercel (api/index.ts) exporta o resultado diretamente.
export function createExpressApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "FamilyFinance backend running successfully!" });
  });

  // AI Advisor / Advisor Chat Endpoint
  app.post("/api/ai/advisor", async (req, res) => {
    try {
      const { systemState, chatHistory, userMessage } = req.body;

      if (!systemState) {
        return res.status(400).json({ error: "Missing system financial state" });
      }

      let client: GoogleGenAI;
      try {
        client = getGeminiClient();
      } catch (err: any) {
        console.warn("Gemini client initialization failed (API Key missing). Using fallback offline advisor response.");
        const offlineResponse = generateOfflineAdvisory(systemState, userMessage);
        return res.json({
          text: offlineResponse,
          isOfflineFallback: true
        });
      }

      const { transactions, accounts, budgets, goals, familyMembers, categories } = systemState;

      const categoryNameById = (categories || []).reduce((acc: any, c: any) => {
        acc[c.id] = c.name;
        return acc;
      }, {});

      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const monthOf = (dateStr: string) => (dateStr || '').slice(0, 7);
      const curTxs = transactions.filter((t: any) => monthOf(t.date) === currentMonth);

      const totalIncome = curTxs
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

      const totalExpense = curTxs
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

      const netBalance = totalIncome - totalExpense;

      const categoryTotals = curTxs
        .filter((t: any) => t.type === 'expense')
        .reduce((acc: any, t: any) => {
          acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
          return acc;
        }, {});

      const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const prevExpense = transactions
        .filter((t: any) => t.type === 'expense' && monthOf(t.date) === prevMonth)
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

      const activeBudgets = budgets.map((b: any) => {
        const catName = categoryNameById[b.categoryId] || b.categoryId || b.category;
        const spent = curTxs
          .filter((t: any) => t.type === 'expense' && (t.category === catName || t.categoryId === b.categoryId))
          .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        return { category: catName, limit: b.limit, spent, month: b.month || currentMonth };
      });

      const activeGoals = goals.map((g: any) => ({
        name: g.name,
        target: g.targetAmount,
        current: g.currentAmount,
        deadline: g.deadline,
        pct: Math.round((g.currentAmount / g.targetAmount) * 100)
      }));

      const activeAccounts = accounts.map((a: any) => ({
        name: a.name,
        type: a.type,
        balance: a.balance
      }));

      const activeMembers = familyMembers.map((m: any) => ({
        name: m.name,
        role: m.role
      }));

      const contextPrompt = `
Você é o "Serenity AI", um consultor financeiro pessoal e familiar altamente sofisticado, empático e inteligente. Seu objetivo é ajudar a família a organizar suas finanças, economizar dinheiro, bater metas e gastar de forma consciente.

Aqui está o estado financeiro atual da família:
- Mês de Referência: ${currentMonth} (dados do mês vigente; mês anterior: ${prevMonth})
- Membros da Família: ${JSON.stringify(activeMembers)}
- Contas e Saldos: ${JSON.stringify(activeAccounts)}
- Receitas Totais no Período: R$ ${totalIncome.toFixed(2)}
- Despesas Totais no Período: R$ ${totalExpense.toFixed(2)}
- Despesas no Mês Anterior: R$ ${prevExpense.toFixed(2)} (use para comparação e tendências)
- Saldo Líquido: R$ ${netBalance.toFixed(2)} (Se negativo, recomende urgentemente cortes de gastos. Se positivo, sugira investimentos ou aportes para as metas).
- Gastos por Categoria: ${JSON.stringify(categoryTotals)}
- Orçamentos de Categorias (Teto de Gastos): ${JSON.stringify(activeBudgets)}
- Metas Financeiras Ativas: ${JSON.stringify(activeGoals)}

Histórico de Conversa Recente:
${(chatHistory || []).map((msg: any) => `${msg.role === 'user' ? 'Usuário' : 'Conselheiro'}: ${msg.content}`).join('\n')}

Nova mensagem do usuário: "${userMessage || 'Por favor, faça uma análise geral da minha saúde financeira e me dê 3 conselhos práticos em tópicos.'}"

Diretrizes de resposta:
1. Responda em português brasileiro fluído, profissional, acolhedor e direto.
2. Use formatação Markdown elegante (títulos, listas em tópicos, negrito).
3. Nunca invente informações. Analise estritamente o estado provido.
4. Identifique se algum orçamento foi estourado ou se as despesas excedem as receitas.
5. Se o usuário fizer uma pergunta geral, faça uma análise e sugira ações. Se ele fizer uma pergunta específica (ex: "Consigo comprar um carro?", "Quanto o Pedro gastou?"), responda diretamente cruzando os dados do estado financeiro.
6. Mantenha os conselhos práticos e perfeitamente aplicáveis para a realidade familiar demonstrada.
`;

      const response = await client.models.generateContent({
        model: "gemini-3.6-flash",
        contents: contextPrompt,
        config: {
          systemInstruction: "Você é o Serenity AI, um conselheiro financeiro especializado em planejamento pessoal e familiar brasileiro. Ajude as famílias a alcançarem a liberdade financeira de forma construtiva e realista.",
          temperature: 0.7,
        },
      });

      res.json({
        text: response.text || "Desculpe, não consegui processar os conselhos no momento.",
        isOfflineFallback: false
      });

    } catch (error: any) {
      console.error("AI Advisor error:", error);
      res.status(500).json({ error: error.message || "Erro interno ao consultar o conselheiro IA." });
    }
  });

  // ===== Pluggy (Open Finance / Bank Integration) =====

  // 1. Config — indica se as chaves da Pluggy estão configuradas no servidor
  app.get("/api/pluggy/config", (req, res) => {
    res.json({
      configured: !!getPluggyClient(),
      webhookUrl: process.env.PLUGGY_WEBHOOK_URL || `${req.protocol}://${req.get("host")}/api/pluggy/webhook`,
    });
  });

  // 2. Connect token — abre o widget de conexão bancária
  app.get("/api/pluggy/connect-token", async (req, res) => {
    try {
      const client = getPluggyClient();
      if (!client) {
        return res.status(400).json({ error: "Pluggy não configurado. Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no servidor." });
      }
      const userId = String(req.query.userId || "local");
      // O webhookUrl precisa ser HTTPS. Em produção/Vercel (req.secure) ou via
      // PLUGGY_WEBHOOK_URL ele é enviado; em localhost (http) fica de fora.
      const options: { clientUserId: string; webhookUrl?: string } = { clientUserId: userId };
      const webhookUrl = process.env.PLUGGY_WEBHOOK_URL || (req.secure ? `${req.protocol}://${req.get("host")}/api/pluggy/webhook` : "");
      if (webhookUrl) options.webhookUrl = webhookUrl;
      const { accessToken } = await client.createConnectToken(undefined, options);
      res.json({ accessToken });
    } catch (err: any) {
      console.error("[Pluggy] Erro ao gerar connect token:", err);
      res.status(500).json({ error: err.message || "Erro ao gerar connect token." });
    }
  });

  // 3. Webhook — Pluggy notifica eventos de transações; processa inline e responde 200
  // (no serverless do Vercel não há processo em background, então aguardamos o processamento)
  app.post("/api/pluggy/webhook", async (req, res) => {
    const { event, itemId, transactionId } = req.body || {};
    try {
      if ((event === "transactions/created" || event === "transactions/updated") && transactionId) {
        await processWebhookEvent(itemId, transactionId);
      }
    } catch (e) {
      console.error("[Pluggy] Webhook error:", e);
    }
    res.status(200).send("OK");
  });

  // 4. Sincronização manual (pull) — essencial no localhost, onde a Pluggy não
  // entrega webhook (exige HTTPS). Busca as transações das conexões do usuário
  // e as converte em pendências, ignorando as já importadas. Aceita um
  // accountId opcional para sincronizar apenas uma conta/cartão específica.
  app.post("/api/pluggy/sync", async (req, res) => {
    const userId = String(req.query.userId || "local");
    const shouldWait = req.query.wait === "1";
    const onlyAccountId = req.query.accountId ? String(req.query.accountId) : null;
    // Data inicial opcional (YYYY-MM-DD): sincroniza apenas transações a partir dela
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

    // Sem client Pluggy (modo demo): sincroniza a partir das transações de exemplo,
    // filtrando pela conta/data quando solicitado — mantém o fluxo testável.
    if (!client) {
      const samples = sampleBankTransactions().filter(t => {
        if (onlyAccountId && t.accountId !== onlyAccountId) return false;
        if (fromDate && t.date < fromDate) return false;
        return true;
      });
      const { synced, skipped } = await ingestTxs(samples);
      return res.json({ synced, skipped, pending: await listPendingByUser(userId) });
    }

    const connections = await listConnectionsByUser(userId);
    let synced = 0;
    let skipped = 0;
    for (const conn of connections) {
      try {
        let item = await client.fetchItem(conn.itemId);
        if (shouldWait) {
          // Recém-conectado o item fica UPDATING ~20s; aguarda a execução terminar
          const deadline = Date.now() + 30000;
          while (Date.now() < deadline && ["UPDATING", "WAITING_USER_ACTION", "WAITING_USER_INPUT", "LOGIN_OK"].includes(item.status)) {
            await new Promise(r => setTimeout(r, 2000));
            try { item = await client.fetchItem(conn.itemId); } catch { break; }
          }
        }
        const accounts = await client.fetchAccounts(conn.itemId);
        for (const account of accounts.results || []) {
          if (onlyAccountId && account.id !== onlyAccountId) continue;
          const txs = await client.fetchAllTransactions(account.id, fromDate ? { dateFrom: fromDate } : undefined);
          const raws: RawPluggyTx[] = txs.map(tx => ({
            id: tx.id,
            accountId: tx.accountId,
            description: tx.description || tx.descriptionRaw || "",
            amount: tx.amount,
            date: normalizePluggyDate(tx.date),
            paymentMethod: tx.paymentData?.paymentMethod || inferPaymentMethod(tx.description || ""),
            pluggyType: tx.type,
          }));
          const r = await ingestTxs(raws, conn.itemId);
          synced += r.synced;
          skipped += r.skipped;
        }
        await upsertConnection({ ...conn, status: item.status, updatedAt: new Date().toISOString() });
      } catch (e: any) {
        console.error(`[Pluggy] Sync: erro na conexão ${conn.itemId}:`, e.message);
      }
    }
    res.json({ synced, skipped, pending: await listPendingByUser(userId) });
  });

  // 5. Caixa de Entrada (pendências)
  app.get("/api/pluggy/pending", async (req, res) => {
    const userId = String(req.query.userId || "local");
    res.json(await listPendingByUser(userId));
  });

  // 5.1 Investimentos: busca os ativos da carteira nas conexões do usuário
  // (carteira de investimentos) e os retorna no formato bruto para o app.
  // Em modo demo (sem chaves Pluggy), retorna uma carteira de exemplo.
  app.get("/api/pluggy/investments", async (req, res) => {
    const userId = String(req.query.userId || "local");
    const client = getPluggyClient();

    if (!client) {
      return res.json({ investments: sampleBankInvestments() });
    }

    const connections = await listConnectionsByUser(userId);
    const investments: RawPluggyInvestment[] = [];
    for (const conn of connections) {
      try {
        const invPage = await client.fetchInvestments(conn.itemId);
        for (const inv of invPage.results || []) {
          const current = inv.balance ?? inv.amount ?? 0;
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
        console.error(`[Pluggy] Investimentos: erro na conexão ${conn.itemId}:`, e.message);
      }
    }
    res.json({ investments });
  });

  // 5. Aprovar pendência — grava overrides escolhidos pelo usuário e marca APPROVED
  app.post("/api/pluggy/pending/:id/approve", async (req, res) => {
    const pending = await getPending(req.params.id);
    if (!pending) return res.status(404).json({ error: "Pendência não encontrada." });
    const o = req.body?.overrides || {};
    const updated = await updatePending(pending.id, {
      status: "APPROVED",
      suggestedCategoryId: o.categoryId ?? pending.suggestedCategoryId,
      suggestedCategory: o.category ?? pending.suggestedCategory,
      suggestedSubcategoryId: o.subcategoryId ?? pending.suggestedSubcategoryId,
      suggestedSubcategory: o.subcategory ?? pending.suggestedSubcategory,
      suggestedTagIds: o.tagIds ?? pending.suggestedTagIds,
      amount: o.amount ?? pending.amount,
      date: o.date ?? pending.date,
    });
    res.json(updated);
  });

  // 6. Conciliar pendência com uma transação manual existente
  app.post("/api/pluggy/pending/:id/reconcile", async (req, res) => {
    const pending = await getPending(req.params.id);
    if (!pending) return res.status(404).json({ error: "Pendência não encontrada." });
    const updated = await updatePending(pending.id, {
      status: "RECONCILED",
      suggestedReconcileTransactionId: req.body?.targetTransactionId ?? pending.suggestedReconcileTransactionId,
    });
    res.json(updated);
  });

  // 7. Ignorar pendência
  app.post("/api/pluggy/pending/:id/ignore", async (req, res) => {
    const pending = await getPending(req.params.id);
    if (!pending) return res.status(404).json({ error: "Pendência não encontrada." });
    res.json(await updatePending(pending.id, { status: "IGNORED" }));
  });

  // 8. Conexões bancárias
  app.get("/api/pluggy/connections", async (req, res) => {
    const userId = String(req.query.userId || "local");
    res.json(await listConnectionsByUser(userId));
  });

  app.post("/api/pluggy/connections", async (req, res) => {
    const { userId, itemId, connectorName, connectorLogoUrl } = req.body || {};
    if (!itemId || !connectorName) return res.status(400).json({ error: "itemId e connectorName são obrigatórios." });
    const conn = await upsertConnection({
      id: `conn_${Date.now()}`,
      userId: userId || "local",
      itemId,
      connectorName,
      connectorLogoUrl,
      status: "CONNECTED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.json(conn);
  });

  app.delete("/api/pluggy/connections/:itemId", async (req, res) => {
    const removed = await deleteConnection(req.params.itemId);
    if (!removed) return res.status(404).json({ error: "Conexão não encontrada." });
    res.json({ ok: true });
  });

  // 8.1 Contas/cartões detectados na Pluggy + mapeamento para contas do app
  app.get("/api/pluggy/accounts", async (req, res) => {
    const userId = String(req.query.userId || "local");
    let connections: Awaited<ReturnType<typeof listConnectionsByUser>> = [];
    let mappings: Awaited<ReturnType<typeof listAccountMappingsByUser>> = [];
    // Torna o endpoint resiliente: se a tabela pluggy_account_mappings ainda não
    // existir no banco, a listagem de contas não pode falhar por causa disso.
    try {
      [connections, mappings] = await Promise.all([
        listConnectionsByUser(userId),
        listAccountMappingsByUser(userId),
      ]);
    } catch (e: any) {
      console.warn("[Pluggy] Erro ao carregar conexões/mapeamentos:", e?.message);
    }
    const mappingByAccount = new Map(mappings.map(m => [m.pluggyAccountId, m.appAccountId]));

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
        console.warn("[Pluggy] Erro ao buscar contas da conexão:", e?.message);
      }
    }

    // Caso não haja client Pluggy (modo demo), usa os ids de conta das pendências.
    // Se não houver pendências ainda, ainda assim expõe as contas demo de exemplo
    // para permitir associar antes mesmo de sincronizar.
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
        // Modo demo sem conexões e sem pendências: mostra as duas contas exemplo
        // para permitir o mapeamento antes de sincronizar.
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
        console.warn("[Pluggy] Erro ao carregar pendências p/ contas demo:", e?.message);
      }
    }

    res.json(accounts);
  });

  app.post("/api/pluggy/accounts/map", async (req, res) => {
    const { userId, pluggyAccountId, appAccountId } = req.body || {};
    if (!pluggyAccountId || !appAccountId) {
      return res.status(400).json({ error: "pluggyAccountId e appAccountId são obrigatórios." });
    }
    const mapping = await upsertAccountMapping({
      userId: userId || "local",
      pluggyAccountId,
      appAccountId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.json(mapping);
  });

  // 9. Demo — gera pendências de exemplo (útil para testar sem chaves reais)
  app.post("/api/pluggy/demo/generate", async (req, res) => {
    const userId = String(req.query.userId || "local");
    const generated = await Promise.all(
      sampleBankTransactions().map((raw: RawPluggyTx) => {
        const pending = processIncomingPluggyTx(raw, { categories: [] });
        return upsertPending({ ...pending, userId });
      })
    );
    res.json({ generated: generated.length, pending: await listPendingByUser(userId) });
  });

  // 10. Diagnóstico interno (status das conexões)
  app.get("/api/pluggy/status", async (req, res) => {
    const userId = String(req.query.userId || "local");
    const [pending, connections] = await Promise.all([listPendingByUser(userId), listConnectionsByUser(userId)]);
    res.json({
      configured: !!getPluggyClient(),
      pending: pending.length,
      connections,
    });
  });

  return app;
}

// Generates an offline fallback response based on basic local mathematical evaluation of state
function generateOfflineAdvisory(state: any, userQuery: string): string {
  const { transactions, budgets, goals, categories } = state;

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const monthOf = (dateStr: string) => (dateStr || '').slice(0, 7);
  const curTxs = transactions.filter((t: any) => monthOf(t.date) === currentMonth);

  const totalIncome = curTxs
    .filter((t: any) => t.type === 'income')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const totalExpense = curTxs
    .filter((t: any) => t.type === 'expense')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const net = totalIncome - totalExpense;
  const pctSavings = totalIncome > 0 ? ((net / totalIncome) * 100).toFixed(1) : "0";

  const categoryNameById = (categories || []).reduce((acc: any, c: any) => {
    acc[c.id] = c.name;
    return acc;
  }, {});

  const overBudgets = budgets.map((b: any) => {
    const catName = categoryNameById[b.categoryId] || b.categoryId || b.category;
    const spent = curTxs
      .filter((t: any) => t.type === 'expense' && (t.category === catName || t.categoryId === b.categoryId))
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
    return { name: catName, limit: b.limit, spent };
  }).filter((b: any) => b.spent > b.limit);

  let advice = `### 🤖 Serenity AI — Modo Consultoria Local

*Nota: Para habilitar a análise inteligente avançada e profunda baseada em IA generativa, por favor, configure uma chave **GEMINI_API_KEY** no painel lateral de Configurações (Secrets) do seu AI Studio.*

Com base nos dados matemáticos do seu aplicativo, aqui está o seu **relatório financeiro de saúde familiar**:

#### 📊 Resumo da Balança (${currentMonth})
* **Receitas Totais:** R$ ${totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Despesas Totais:** R$ ${totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Saldo Líquido:** R$ ${net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${net >= 0 ? "Saldo Positivo! 🎉" : "Atenção: Saldo Negativo! ⚠️"})
* **Taxa de Poupança:** ${net > 0 ? `${pctSavings}% das suas receitas foram poupadas.` : "Você está gastando mais do que ganha!"}

`;

  if (overBudgets.length > 0) {
    advice += `#### 🚨 Alerta de Orçamentos Estourados
Você tem **${overBudgets.length}** categorias onde ultrapassou o teto planejado:
${overBudgets.map((ob: any) => `* **${ob.name}**: Limite de R$ ${ob.limit} | Gasto R$ ${ob.spent.toFixed(2)} (*Estouro de R$ ${(ob.spent - ob.limit).toFixed(2)}*)`).join('\n')}
*Sugestão:* Congele compras não-essenciais nestas categorias pelos próximos 10 dias.

`;
  } else {
    advice += `#### ✅ Orçamentos sob Controle
Parabéns! Todas as suas categorias de despesas monitoradas estão dentro dos limites orçamentários estabelecidos para este mês. Continue assim!

`;
  }

  if (goals.length > 0) {
    advice += `#### 🎯 Progresso de Metas de Poupança
Suas metas ativas estão progredindo:
${goals.map((g: any) => {
      const pct = Math.round((g.currentAmount / g.targetAmount) * 100);
      return `* **${g.name}**: ${pct}% concluída (R$ ${g.currentAmount} de R$ ${g.targetAmount})`;
    }).join('\n')}

`;
  }

  advice += `#### 💡 Conselhos Práticos Locais
1. **Foco no Saldo Líquido:** Priorize guardar pelo menos 15% das receitas logo no início do mês (regra "Pague-se Primeiro").
2. **Revisão Semanal:** Reúna a família por 15 minutos no fim de semana para alinhar as despesas registradas e evitar surpresas na fatura.
3. **Controle o Cartão:** O limite do cartão de crédito não é extensão do salário. Monitore os parcelamentos ativos!

*Se tiver alguma dúvida específica sobre despesas, digite sua pergunta acima. Tentarei responder com meus algoritmos locais!*`;

  return advice;
}