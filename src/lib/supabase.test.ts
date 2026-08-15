import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSupabaseCredentials,
  getSupabaseClient,
  testSupabaseConnection,
  runSupabaseDiagnostics,
  fetchStateFromSupabase,
  syncSubscription,
  syncTransaction,
  syncCategory,
} from './supabase';

// ------------------------------------------------------------------
// Fake Supabase client
// ------------------------------------------------------------------
const tableData: Record<string, any[]> = {};
const tableError: Record<string, any | null> = {};
const upsertCalls: { table: string; payload: any }[] = [];
const deleteCalls: { table: string; col: string; val: any }[] = [];
let signOutCalls = 0;

function makeQuery(table: string) {
  const resolveData = () => ({ data: tableData[table] || [], error: tableError[table] || null });
  const q: any = {
    then: (resolve: any) => resolve(resolveData()),
    select: (cols?: any, opts?: any) => {
      if (opts && opts.count === 'exact') {
        return {
          then: (resolve: any) => resolve({ data: [], count: (tableData[table] || []).length, error: tableError[table] || null }),
        };
      }
      return q;
    },
    order: () => q,
    eq: () => q,
    limit: () => q,
    single: () => ({ then: (resolve: any) => resolve({ data: (tableData[table] || [])[0] ?? null, error: null }) }),
    upsert: (payload: any) => {
      upsertCalls.push({ table, payload });
      return { then: (resolve: any) => resolve({ data: null, error: null }) };
    },
    delete: () => ({
      eq: (col: string, val: any) => {
        deleteCalls.push({ table, col, val });
        return { then: (resolve: any) => resolve({ data: null, error: null }) };
      },
    }),
  };
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(async () => { signOutCalls += 1; }),
    },
    from: (table: string) => makeQuery(table),
  })),
}));

beforeEach(() => {
  localStorage.clear();
  Object.keys(tableData).forEach(k => delete tableData[k]);
  Object.keys(tableError).forEach(k => delete tableError[k]);
  upsertCalls.length = 0;
  deleteCalls.length = 0;
  signOutCalls = 0;
  // Neutraliza as credenciais reais do .env para os testes controlarem o estado
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ------------------------------------------------------------------
// getSupabaseCredentials
// ------------------------------------------------------------------
describe('getSupabaseCredentials', () => {
  it('retorna vazio sem credenciais', () => {
    expect(getSupabaseCredentials()).toEqual({ url: '', anonKey: '' });
  });

  it('usa credenciais do localStorage quando não há env', () => {
    localStorage.setItem('supabase_url', 'https://x.supabase.co');
    localStorage.setItem('supabase_anon_key', 'anon-key-test');
    expect(getSupabaseCredentials()).toEqual({ url: 'https://x.supabase.co', anonKey: 'anon-key-test' });
  });
});

describe('getSupabaseClient', () => {
  it('retorna null sem credenciais', () => {
    expect(getSupabaseClient()).toBeNull();
  });

  it('cria e cacheia o cliente com credenciais', () => {
    localStorage.setItem('supabase_url', 'https://x.supabase.co');
    localStorage.setItem('supabase_anon_key', 'anon-key-test');
    const c1 = getSupabaseClient();
    const c2 = getSupabaseClient();
    expect(c1).not.toBeNull();
    expect(c1).toBe(c2);
  });
});

describe('testSupabaseConnection', () => {
  it('retorna true quando o select funciona', async () => {
    tableData['categories'] = [{ id: 'c1' }];
    const ok = await testSupabaseConnection('https://x.supabase.co', 'key');
    expect(ok).toBe(true);
  });
});

describe('runSupabaseDiagnostics', () => {
  it('conta linhas por tabela e reporta erros', async () => {
    localStorage.setItem('supabase_url', 'https://x.supabase.co');
    localStorage.setItem('supabase_anon_key', 'anon-key-test');
    tableData['categories'] = [{ id: 'c1' }, { id: 'c2' }];
    tableData['tags'] = [];
    tableError['transactions'] = { message: 'permission denied' };

    const diag = await runSupabaseDiagnostics();
    expect(diag.isConnected).toBe(true);
    expect(diag.tableCounts['categories']).toBe(2);
    expect(diag.tableCounts['tags']).toBe(0);
    expect(diag.errors['transactions']).toBe('permission denied');
  });
});

// ------------------------------------------------------------------
// fetchStateFromSupabase (mapeamento de dados)
// ------------------------------------------------------------------
describe('fetchStateFromSupabase', () => {
  it('mapeia categorias e separa subcategorias por parent_id', async () => {
    localStorage.setItem('supabase_url', 'https://x.supabase.co');
    localStorage.setItem('supabase_anon_key', 'anon-key-test');
    tableData['categories'] = [
      { id: 'cat_food', name: 'Mercado', type: 'expense', icon: 'Cart', color: '#10B981', parent_id: null },
      { id: 'sub_rest', name: 'Restaurante', type: 'expense', icon: 'Utensils', color: '#F59E0B', parent_id: 'cat_food' },
    ];

    const result = await fetchStateFromSupabase();
    expect(result?.categories).toHaveLength(2);
    expect(result?.categories?.[0].parentId).toBeUndefined();
    expect(result?.subcategories).toHaveLength(1);
    expect(result?.subcategories?.[0]).toMatchObject({ id: 'sub_rest', categoryId: 'cat_food' });
  });

  it('normaliza billing_date numérico para string', async () => {
    localStorage.setItem('supabase_url', 'https://x.supabase.co');
    localStorage.setItem('supabase_anon_key', 'anon-key-test');
    tableData['subscriptions'] = [
      { id: 'sub1', name: 'Netflix', amount: 39.9, frequency: 'monthly', category: 'Streaming', billing_date: 22, auto_notify: true, member_id: 'm1', payment_method: 'credit_card', notify_channel: 'push', notify_days: 3 },
    ];

    const result = await fetchStateFromSupabase();
    expect(result?.subscriptions?.[0].billingDate).toBe('22');
  });

  it('mapeia transações com tag_ids, status e subcategory_id', async () => {
    localStorage.setItem('supabase_url', 'https://x.supabase.co');
    localStorage.setItem('supabase_anon_key', 'anon-key-test');
    tableData['transactions'] = [
      { id: 't1', type: 'expense', category_id: 'cat_food', category_name: 'Mercado', subcategory_id: null, subcategory: '', tag_ids: ['tag1', 'tag2'], amount: 50, date: '2026-08-10', recurring: 'none', notes: 'x', member_id: 'm1', account_id: 'a1', status: 'PENDENTE', deleted_at: null },
    ];

    const result = await fetchStateFromSupabase();
    const tx = result?.transactions?.[0];
    expect(tx?.tagIds).toEqual(['tag1', 'tag2']);
    expect(tx?.status).toBe('PENDENTE');
    expect(tx?.category).toBe('Mercado');
  });

  it('retorna null sem credenciais', async () => {
    const result = await fetchStateFromSupabase();
    expect(result).toBeNull();
  });
});

// ------------------------------------------------------------------
// sync (payloads enviados ao banco)
// ------------------------------------------------------------------
describe('syncSubscription', () => {
  it('envia billing_date como número inteiro (dia)', async () => {
    localStorage.setItem('supabase_url', 'https://x.supabase.co');
    localStorage.setItem('supabase_anon_key', 'anon-key-test');
    const ok = await syncSubscription({
      id: 'sub1', name: 'Netflix', amount: 39.9, frequency: 'monthly', category: 'Streaming',
      billingDate: '2026-08-22', autoNotify: true, memberId: 'm1', paymentMethod: 'credit_card', notifyChannel: 'push', notifyDays: 3,
      accountId: 'a1',
    });
    expect(ok).toBe(true);
    expect(upsertCalls[0].table).toBe('subscriptions');
    expect(upsertCalls[0].payload.billing_date).toBe(22);
    expect(upsertCalls[0].payload.account_id).toBe('a1');
  });

  it('envia billing_date numérico puro também como número', async () => {
    localStorage.setItem('supabase_url', 'https://x.supabase.co');
    localStorage.setItem('supabase_anon_key', 'anon-key-test');
    await syncSubscription({
      id: 'sub2', name: 'Spotify', amount: 19.9, frequency: 'monthly', category: 'Streaming',
      billingDate: '5', autoNotify: true, memberId: 'm1', paymentMethod: 'pix', notifyChannel: 'push', notifyDays: 3,
    });
    expect(upsertCalls[0].payload.billing_date).toBe(5);
  });
});

describe('syncTransaction', () => {
  it('faz delete por id quando isDelete é true', async () => {
    localStorage.setItem('supabase_url', 'https://x.supabase.co');
    localStorage.setItem('supabase_anon_key', 'anon-key-test');
    const ok = await syncTransaction({ id: 't1' } as any, true);
    expect(ok).toBe(true);
    expect(deleteCalls[0]).toMatchObject({ table: 'transactions', col: 'id', val: 't1' });
  });

  it('faz upsert com payload normalizado', async () => {
    localStorage.setItem('supabase_url', 'https://x.supabase.co');
    localStorage.setItem('supabase_anon_key', 'anon-key-test');
    const ok = await syncTransaction({
      id: 't1', type: 'expense', categoryId: '', category: 'Mercado', subcategoryId: undefined, subcategory: '',
      tagIds: ['tag1'], amount: 50, date: '2026-08-10', recurring: 'none', notes: '', memberId: 'm1', accountId: 'a1',
      attachmentUrls: [], attachmentNames: [], status: 'REALIZADO',
    });
    expect(ok).toBe(true);
    expect(upsertCalls[0].payload.tag_ids).toEqual(['tag1']);
    expect(upsertCalls[0].payload.status).toBe('REALIZADO');
  });
});

describe('syncCategory', () => {
  it('envia parent_id para subcategoria', async () => {
    localStorage.setItem('supabase_url', 'https://x.supabase.co');
    localStorage.setItem('supabase_anon_key', 'anon-key-test');
    await syncCategory({ id: 'sub_rest', name: 'Restaurante', categoryId: 'cat_food', type: 'expense' } as any);
    expect(upsertCalls[0].payload.parent_id).toBe('cat_food');
  });
});