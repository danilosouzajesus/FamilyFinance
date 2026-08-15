#!/usr/bin/env node
// Testes de integração do Pluggy contra o servidor real.
// Uso: npm run test:integration
// Se já houver um servidor FamilyFinance em :3000, ele é reutilizado;
// caso contrário o script inicia um (tsx server.ts) e o encerra ao final.

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { PluggyClient } from 'pluggy-sdk';
import 'dotenv/config';

const BASE = 'http://localhost:3000';

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

let child = null;
let reusedServer = false;

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = text; }
  return { status: res.status, body };
}

async function waitForHealth(timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { status, body } = await api('/api/health');
      if (status === 200 && body?.status === 'ok') return true;
    } catch { /* still booting */ }
    await sleep(1000);
  }
  return false;
}

// 1. Reutiliza o servidor se já estiver no ar; senão inicia
let healthUp = false;
try {
  const { status } = await api('/api/health');
  healthUp = status === 200;
} catch { /* not running */ }

if (healthUp) {
  reusedServer = true;
  console.log('>> Reutilizando servidor já ativo em :3000');
} else {
  console.log('>> Iniciando servidor (tsx server.ts)…');
  child = spawn('npx tsx server.ts', { shell: true, stdio: 'ignore' });
  healthUp = await waitForHealth();
}

if (!healthUp) {
  console.error('FATAL: servidor não respondeu em /api/health');
  if (child) child.kill();
  process.exit(1);
}

const userId = `it_test_${Date.now()}`;

try {
  // 2. Config — chaves presentes
  const cfg = await api('/api/pluggy/config');
  check('config → configured=true', cfg.status === 200 && cfg.body.configured === true,
    cfg.body.configured ? 'chaves PLUGGY_CLIENT_ID/SECRET carregadas' : 'chaves NÃO configuradas no servidor');

  // 3. Connect token real (valida credenciais na API da Pluggy)
  const tok = await api(`/api/pluggy/connect-token?userId=${userId}`);
  const isJwt = typeof tok.body?.accessToken === 'string' && tok.body.accessToken.length > 100;
  check('connect-token → JWT válido', tok.status === 200 && isJwt,
    isJwt ? `token len=${tok.body.accessToken.length}` : (tok.body?.error || `status ${tok.status}`));

  // 4. Demo generate
  const demo = await api(`/api/pluggy/demo/generate?userId=${userId}`, { method: 'POST' });
  check('demo/generate → gera pendências', demo.status === 200 && (demo.body?.generated || 0) >= 1,
    `generated=${demo.body?.generated}`);

  // 5. Listagem da Caixa de Entrada
  const pend = await api(`/api/pluggy/pending?userId=${userId}`);
  const pendings = Array.isArray(pend.body) ? pend.body : [];
  check('pending → lista pendências', pend.status === 200 && pendings.length > 0, `count=${pendings.length}`);

  const byStatus = (s) => pendings.filter(p => p.status === s);

  // 6. Aprovar
  const toApprove = byStatus('PENDING')[0];
  if (toApprove) {
    const appr = await api(`/api/pluggy/pending/${toApprove.id}/approve`, {
      method: 'POST', body: JSON.stringify({ overrides: { category: 'Mercado' } }),
    });
    check('approve → status APPROVED', appr.status === 200 && appr.body?.status === 'APPROVED',
      `categoria=${appr.body?.suggestedCategory}`);
  } else {
    check('approve → (sem pendências disponíveis)', false);
  }

  // 7. Ignorar
  const toIgnore = byStatus('PENDING')[0];
  if (toIgnore) {
    const ign = await api(`/api/pluggy/pending/${toIgnore.id}/ignore`, { method: 'POST' });
    check('ignore → status IGNORED', ign.status === 200 && ign.body?.status === 'IGNORED');
  } else {
    check('ignore → (sem pendências disponíveis)', false);
  }

  // 8. Conciliar
  const toReconcile = byStatus('PENDING')[0];
  if (toReconcile) {
    const rec = await api(`/api/pluggy/pending/${toReconcile.id}/reconcile`, {
      method: 'POST', body: JSON.stringify({ targetTransactionId: 'manual_tx_123' }),
    });
    check('reconcile → status RECONCILED', rec.status === 200 && rec.body?.status === 'RECONCILED' &&
      rec.body?.suggestedReconcileTransactionId === 'manual_tx_123');
  } else {
    check('reconcile → (sem pendências disponíveis)', false);
  }

  // 9. Conexões CRUD
  const itemId = `item_it_${Date.now()}`;
  const conn = await api('/api/pluggy/connections', {
    method: 'POST',
    body: JSON.stringify({ userId, itemId, connectorName: 'Nubank (teste)' }),
  });
  check('connections → POST cria', conn.status === 200 && conn.body?.connectorName === 'Nubank (teste)');

  const conns = await api(`/api/pluggy/connections?userId=${userId}`);
  check('connections → GET lista', Array.isArray(conns.body) && conns.body.length >= 1, `count=${conns.body?.length}`);

  const del = await api(`/api/pluggy/connections/${itemId}`, { method: 'DELETE' });
  check('connections → DELETE remove', del.status === 200 && del.body?.ok === true);

  // 10. Webhook — responde 200 imediato (item inválido: processamento async falha e é logado, mas o endpoint não trava)
  const wh = await api('/api/pluggy/webhook', {
    method: 'POST',
    body: JSON.stringify({ event: 'transactions/created', itemId: 'item_invalido', transactionId: 'tx_invalido' }),
  });
  check('webhook → responde 200 imediato', wh.status === 200);

  // 11. Sync manual (pull) com item Sandbox real — valida o fluxo completo de ponta a ponta:
  // cria item na Pluggy (user-ok/password-ok) → registra conexão no servidor → puxa
  // transações para a Caixa de Entrada (caminho que no localhost substitui o webhook https).
  const client = new PluggyClient({
    clientId: process.env.PLUGGY_CLIENT_ID,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET,
  });
  let sandboxItemId = null;
  try {
    const connectors = await client.fetchConnectors({ sandbox: true });
    const sandbox = connectors.results?.find(c => c.name === 'Pluggy Bank')
      || connectors.results?.find(c => /^pluggy bank$/i.test(c.name))
      || connectors.results?.[0];
    if (!sandbox) {
      check('sync sandbox → conector Pluggy Bank encontrado', false, 'nenhum conector sandbox retornado');
    } else {
      const params = {};
      for (const cred of sandbox.credentials || []) {
        if (cred.optional) continue;
        if (cred.mfa) params[cred.name] = '123456';
        else if (cred.name === 'user') params[cred.name] = 'user-ok';
        else if (/pass|senha/i.test(cred.name)) params[cred.name] = 'password-ok';
        else if (/user|login|email|cpf|cns|identif|document/i.test(cred.name)) params[cred.name] = 'user-ok';
        else if (cred.type === 'text') params[cred.name] = 'user-ok';
      }
      let item = await client.createItem(sandbox.id, params);
      sandboxItemId = item.id;
      if (item.status === 'WAITING_USER_INPUT') {
        try { item = await client.updateItemMFA(item.id, { mfa: '123456' }); } catch { /* ignore */ }
      }
      // Aguarda a execução terminar (sandbox leva ~20s para UPDATED e só então expõe as transações)
      const deadline = Date.now() + 40000;
      while (Date.now() < deadline && ['UPDATING', 'WAITING_USER_ACTION', 'WAITING_USER_INPUT', 'LOGIN_OK'].includes(item.status)) {
        await sleep(2000);
        try { item = await client.fetchItem(item.id); } catch { /* retry */ }
      }
      await api('/api/pluggy/connections', {
        method: 'POST',
        body: JSON.stringify({ userId, itemId: item.id, connectorName: sandbox.name }),
      });
      const syncRes = await api(`/api/pluggy/sync?userId=${userId}`, { method: 'POST' });
      check('sync → puxa transações do Sandbox', syncRes.status === 200 && (syncRes.body?.synced || 0) >= 1,
        `synced=${syncRes.body?.synced} skipped=${syncRes.body?.skipped}`);
      const afterSync = await api(`/api/pluggy/pending?userId=${userId}`);
      const pluggyRows = Array.isArray(afterSync.body)
        ? afterSync.body.filter(p => p.pluggyTransactionId && !p.pluggyTransactionId.startsWith('demo_'))
        : [];
      check('sync → pendências com pluggyTransactionId real', pluggyRows.length > 0,
        `pendências pluggy=${pluggyRows.length} (status=${[...new Set(pluggyRows.map(p => p.status))].join(',')})`);
    }
  } catch (e) {
    check('sync sandbox → execução sem exceção', false, String(e?.message || e));
  } finally {
    if (sandboxItemId) {
      try { await client.deleteItem(sandboxItemId); } catch { /* ignore */ }
      await api(`/api/pluggy/connections/${sandboxItemId}`, { method: 'DELETE' }).catch(() => {});
    }
  }

  // Limpeza: marca o restante do usuário de teste como IGNORED
  for (const p of pendings.filter(p => p.status === 'PENDING')) {
    await api(`/api/pluggy/pending/${p.id}/ignore`, { method: 'POST' }).catch(() => {});
  }
} catch (e) {
  check('execução sem exceção', false, String(e));
}

const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} testes de integração passaram`);
if (reusedServer) {
  console.log('Servidor reutilizado — continue com seu `npm run dev` normalmente.');
} else if (child) {
  console.log('Encerrando servidor iniciado pelo teste…');
  child.kill();
}
process.exit(failed > 0 ? 1 : 0);