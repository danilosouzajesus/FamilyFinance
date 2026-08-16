import { describe, it, expect, beforeEach } from 'vitest';
import { getInitialState, saveState, defaultBankConfig } from './initialData';
import { FinancialState } from '@ff/shared';

const STATE_KEY = 'family_finance_state';
const VERSION_KEY = 'family_finance_state_version';

beforeEach(() => {
  localStorage.clear();
  // Semear a versão atual para a migração não apagar os dados de teste
  localStorage.setItem(VERSION_KEY, '2');
});

describe('getInitialState', () => {
  it('retorna estado vazio sem dados salvos', () => {
    const state = getInitialState();
    expect(state.categories).toEqual([]);
    expect(state.transactions).toEqual([]);
    expect(state.accounts).toEqual([]);
    expect(state.bankConfig).toEqual(defaultBankConfig);
  });

  it('carrega estado salvo no localStorage', () => {
    const saved: Partial<FinancialState> = {
      transactions: [{ id: 't1', type: 'expense', categoryId: 'c1', category: 'Mercado', subcategory: '', tagIds: [], amount: 50, date: '2026-08-10', recurring: 'none', notes: '', memberId: 'm1', accountId: 'a1', attachmentUrls: [], attachmentNames: [], status: 'REALIZADO' }],
      accounts: [{ id: 'a1', name: 'Banco X', type: 'bank', balance: 1000, color: 'blue-500' }],
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(saved));

    const state = getInitialState();
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].amount).toBe(50);
    expect(state.accounts).toHaveLength(1);
  });

  it('ignora campos que não são arrays e mantém banco padrão', () => {
    const saved = { transactions: 'não-array', categories: null, bankConfig: { pluggyConnected: true } };
    localStorage.setItem(STATE_KEY, JSON.stringify(saved));

    const state = getInitialState();
    expect(state.transactions).toEqual([]);
    expect(state.categories).toEqual([]);
    expect(state.bankConfig).toEqual({ pluggyConnected: true });
  });

  it('retorna estado vazio se o JSON salvo está corrompido', () => {
    localStorage.setItem(STATE_KEY, '{corrompido');
    const state = getInitialState();
    expect(state.categories).toEqual([]);
    expect(state.transactions).toEqual([]);
  });

  it('limpa estado antigo quando a versão armazenada é menor que a atual', () => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ transactions: [{ id: 'x' }] }));
    localStorage.setItem(VERSION_KEY, '1'); // versão antiga

    getInitialState();
    expect(localStorage.getItem(STATE_KEY)).toBeNull();
    expect(localStorage.getItem(VERSION_KEY)).toBe('2');
  });

  it('NÃO limpa o estado se a versão armazenada é a atual', () => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ transactions: [{ id: 'x' }] }));
    localStorage.setItem(VERSION_KEY, '2');

    getInitialState();
    expect(localStorage.getItem(STATE_KEY)).not.toBeNull();
  });
});

describe('saveState', () => {
  it('persiste o estado no localStorage', () => {
    const state = getInitialState();
    saveState(state);
    const raw = localStorage.getItem(STATE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).categories).toEqual([]);
  });

  it('round-trip: saveState + getInitialState retorna mesmo conteúdo', () => {
    const state = getInitialState();
    state.transactions = [{ id: 't1', type: 'income', categoryId: 'c1', category: 'Salário', subcategory: '', tagIds: [], amount: 5000, date: '2026-08-01', recurring: 'none', notes: '', memberId: 'm1', accountId: 'a1', attachmentUrls: [], attachmentNames: [], status: 'REALIZADO' }];
    saveState(state);
    const loaded = getInitialState();
    expect(loaded.transactions).toEqual(state.transactions);
  });
});