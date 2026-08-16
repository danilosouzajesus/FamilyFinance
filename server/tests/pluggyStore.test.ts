import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { upsertPending, listPendingByUser, updatePending, upsertConnection, listConnectionsByUser, deleteConnection, upsertAccountMapping, listAccountMappingsByUser } from '../src/repositories/pluggyStore';
import { PluggyPendingTx, PluggyConnection, PluggyAccountMapping } from '@ff/shared';

// ------------------------------------------------------------------
// Fake Supabase client
// ------------------------------------------------------------------
const { tableData, upsertCalls } = vi.hoisted(() => ({
  tableData: {} as Record<string, any[]>,
  upsertCalls: [] as { table: string; payload: any }[],
}));

function makeQuery(table: string) {
  const rows = () => {
    if (!tableData[table]) tableData[table] = [];
    return tableData[table];
  };
  let lastFilter: { col: string; val: any } | null = null;
  let updatePayload: any = null;

  const findOne = () => {
    if (updatePayload) {
      const row = rows().find(r => lastFilter && r[lastFilter!.col] === lastFilter!.val);
      if (row) Object.assign(row, updatePayload);
      updatePayload = null;
    }
    return rows().find(r => lastFilter && r[lastFilter!.col] === lastFilter!.val) ?? null;
  };

  const q: any = {
    then: (resolve: any) => {
      let data = rows();
      if (lastFilter) data = data.filter(r => r[lastFilter!.col] === lastFilter!.val);
      resolve({ data, error: null });
    },
    select: () => q,
    order: () => q,
    eq: (col: string, val: any) => {
      lastFilter = { col, val };
      return q;
    },
    maybeSingle: () => ({ then: (resolve: any) => resolve({ data: findOne(), error: null }) }),
    single: () => ({ then: (resolve: any) => resolve({ data: findOne(), error: null }) }),
    upsert: (payload: any, opts?: any) => {
      upsertCalls.push({ table, payload });
      const key = table === 'pluggy_connections' ? 'item_id'
        : table === 'pluggy_account_mappings' ? 'pluggy_account_id'
        : 'pluggy_transaction_id';
      const idx = rows().findIndex(r => r[key] === payload[key]);
      if (idx !== -1) rows()[idx] = payload;
      else rows().unshift(payload);
      return { select: () => ({ single: () => ({ then: (resolve: any) => resolve({ data: payload, error: null }) }) }) };
    },
    update: (payload: any) => {
      updatePayload = payload;
      return q;
    },
    delete: () => ({
      eq: (col: string, val: any) => {
        tableData[table] = rows().filter(r => r[col] !== val);
        return { then: (resolve: any) => resolve({ data: null, error: null }) };
      },
    }),
  };
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => makeQuery(table),
  })),
}));

beforeEach(() => {
  Object.keys(tableData).forEach(k => delete tableData[k]);
  upsertCalls.length = 0;
  vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const makePending = (over: Partial<PluggyPendingTx> = {}): PluggyPendingTx => ({
  id: 'pend_1',
  userId: 'user1',
  rawDescription: 'PIX *PADARIA',
  amount: 18.5,
  date: '2026-08-10',
  type: 'expense',
  paymentMethod: 'PIX',
  pluggyTransactionId: 'pluggy_1',
  suggestedCategory: 'Mercado',
  suggestedSubcategory: '',
  suggestedTagIds: [],
  aiConfidence: 92,
  status: 'PENDING',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

const makeConnection = (over: Partial<PluggyConnection> = {}): PluggyConnection => ({
  id: 'conn_1',
  userId: 'user1',
  itemId: 'item_1',
  connectorName: 'Banco Itaú',
  status: 'CONNECTED',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

const makeMapping = (over: Partial<PluggyAccountMapping> = {}): PluggyAccountMapping => ({
  userId: 'user1',
  pluggyAccountId: 'pluggy_acc_1',
  appAccountId: 'a1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

describe('pluggyStore (Supabase)', () => {
  it('upsertPending grava em pending_transactions sem duplicar pela pluggy_transaction_id', async () => {
    await upsertPending(makePending());
    await upsertPending(makePending({ suggestedCategory: 'Padaria' }));
    expect(upsertCalls[0].table).toBe('pending_transactions');
    expect(tableData['pending_transactions']).toHaveLength(1);
    expect(tableData['pending_transactions'][0].suggested_category).toBe('Padaria');
  });

  it('listPendingByUser filtra por usuário', async () => {
    await upsertPending(makePending());
    await upsertPending(makePending({ id: 'pend_2', userId: 'user2', pluggyTransactionId: 'pluggy_2' }));
    const user1 = await listPendingByUser('user1');
    const user2 = await listPendingByUser('user2');
    expect(user1).toHaveLength(1);
    expect(user1[0].userId).toBe('user1');
    expect(user2).toHaveLength(1);
    expect(user2[0].userId).toBe('user2');
  });

  it('updatePending altera o status', async () => {
    await upsertPending(makePending());
    const updated = await updatePending('pend_1', { status: 'APPROVED' });
    expect(updated?.status).toBe('APPROVED');
    expect((await listPendingByUser('user1'))[0].status).toBe('APPROVED');
  });

  it('updatePending retorna null para id inexistente', async () => {
    expect(await updatePending('nope', { status: 'IGNORED' })).toBeNull();
  });

  it('upsertConnection e deleteConnection funcionam em pluggy_connections', async () => {
    await upsertConnection(makeConnection());
    expect(upsertCalls[0].table).toBe('pluggy_connections');
    expect(await listConnectionsByUser('user1')).toHaveLength(1);
    expect(await deleteConnection('item_1')).toBe(true);
    expect(await listConnectionsByUser('user1')).toHaveLength(0);
  });

  it('upsertAccountMapping grava e atualiza o mapeamento por conta Pluggy', async () => {
    await upsertAccountMapping(makeMapping());
    await upsertAccountMapping(makeMapping({ appAccountId: 'a2' }));
    expect(upsertCalls[0].table).toBe('pluggy_account_mappings');
    expect(tableData['pluggy_account_mappings']).toHaveLength(1);
    expect(tableData['pluggy_account_mappings'][0].app_account_id).toBe('a2');
  });

  it('listAccountMappingsByUser filtra por usuário', async () => {
    await upsertAccountMapping(makeMapping());
    await upsertAccountMapping(makeMapping({ userId: 'user2', pluggyAccountId: 'pluggy_acc_2' }));
    const user1 = await listAccountMappingsByUser('user1');
    const user2 = await listAccountMappingsByUser('user2');
    expect(user1).toHaveLength(1);
    expect(user1[0].pluggyAccountId).toBe('pluggy_acc_1');
    expect(user2).toHaveLength(1);
    expect(user2[0].pluggyAccountId).toBe('pluggy_acc_2');
  });
});