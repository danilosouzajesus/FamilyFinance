import { describe, it, expect } from 'vitest';
import {
  inferPaymentMethod,
  normalizePluggyAmount,
  normalizePluggyDate,
  findReconciliationMatch,
  sampleBankTransactions,
  sampleBankInvestments,
  rawInvestmentToInvestmentFields,
  isPluggyNotFound,
} from './pluggy';
import {
  categorizeTransaction,
  processIncomingPluggyTx,
  applySuggestionLive,
  buildApprovedTransaction,
} from '../engines/pluggyEngine';
import { makeCategory, makeTx, makeRule, makeSubcategory, makeAccount, emptyState } from '../test/fixtures';

describe('inferPaymentMethod', () => {
  it('identifica PIX', () => {
    expect(inferPaymentMethod('PIX *PADARIA')).toBe('PIX');
  });
  it('identifica boleto', () => {
    expect(inferPaymentMethod('BOLETO ALUGUEL')).toBe('BOLETO');
  });
  it('identifica cartão de crédito', () => {
    expect(inferPaymentMethod('PAG*IFOOD.COM')).toBe('CARTAO_CREDITO');
  });
  it('identifica TED', () => {
    expect(inferPaymentMethod('TED ENERGISA')).toBe('TED_DOC');
  });
  it('usa DEBITO como padrão', () => {
    expect(inferPaymentMethod('COMPRA NUBANK')).toBe('DEBITO');
  });
});

describe('normalizePluggyAmount', () => {
  it('despesa com valor negativo', () => {
    expect(normalizePluggyAmount(-42.9)).toEqual({ type: 'expense', absAmount: 42.9 });
  });
  it('receita com valor positivo', () => {
    expect(normalizePluggyAmount(1200)).toEqual({ type: 'income', absAmount: 1200 });
  });
  it('respeita o tipo DEBIT da Pluggy mesmo com valor positivo', () => {
    expect(normalizePluggyAmount(10, 'DEBIT')).toEqual({ type: 'expense', absAmount: 10 });
  });
});

describe('normalizePluggyDate', () => {
  it('converte Date para YYYY-MM-DD', () => {
    expect(normalizePluggyDate(new Date(2026, 7, 5))).toBe('2026-08-05');
  });
  it('aceita string ISO', () => {
    expect(normalizePluggyDate('2026-08-05T10:00:00Z')).toBe('2026-08-05');
  });
});

describe('findReconciliationMatch', () => {
  const txs = [
    makeTx({ id: 't1', type: 'expense', amount: 100, date: '2026-08-10' }),
    makeTx({ id: 't2', type: 'expense', amount: 100, date: '2026-08-13' }), // dentro de ±3 dias
    makeTx({ id: 't3', type: 'expense', amount: 100, date: '2026-08-20' }), // fora da janela
    makeTx({ id: 't4', type: 'expense', amount: 200, date: '2026-08-11' }), // valor diferente
    makeTx({ id: 't5', type: 'expense', amount: 100, date: '2026-08-11', isReconciled: true }), // já conciliada
  ];

  it('encontra a transação mais próxima na janela de ±3 dias', () => {
    expect(findReconciliationMatch(txs, { amount: 100, date: '2026-08-12', type: 'expense' })).toBe('t2');
  });
  it('retorna null quando não há correspondência', () => {
    expect(findReconciliationMatch(txs, { amount: 100, date: '2026-08-25', type: 'expense' })).toBeNull();
  });
  it('retorna null quando a correspondência é de outra data (fora da janela)', () => {
    expect(findReconciliationMatch(txs, { amount: 100, date: '2026-08-10', type: 'expense' })).toBe('t1');
  });
  it('ignora transações já conciliadas', () => {
    expect(findReconciliationMatch(txs, { amount: 100, date: '2026-08-10', type: 'expense' })).toBe('t1');
  });
  it('não casa valores diferentes', () => {
    expect(findReconciliationMatch(txs, { amount: 200, date: '2026-08-10', type: 'expense' })).toBe('t4');
  });
});

describe('sampleBankTransactions', () => {
  it('gera 8 transações de demonstração', () => {
    expect(sampleBankTransactions()).toHaveLength(8);
  });

  it('distribui as transações entre conta corrente e cartão de crédito (mapeamento de contas)', () => {
    const txs = sampleBankTransactions();
    const accounts = new Set(txs.map(t => t.accountId));
    expect(accounts).toEqual(new Set(['pluggy_acc_checking', 'pluggy_acc_credit']));
    const credit = txs.filter(t => t.accountId === 'pluggy_acc_credit');
    const checking = txs.filter(t => t.accountId === 'pluggy_acc_checking');
    expect(credit.length).toBeGreaterThan(0);
    expect(checking.length).toBeGreaterThan(0);
  });
});

describe('categorizeTransaction', () => {
  it('classifica mercado', () => {
    const r = categorizeTransaction('PIX *PADARIA SÃO JOSÉ', 'expense', []);
    expect(r.categoryName).toBe('Mercado');
    expect(r.confidence).toBeGreaterThanOrEqual(90);
  });
  it('classifica streaming', () => {
    const r = categorizeTransaction('NETFLIX.COM', 'expense', []);
    expect(r.categoryName).toBe('Assinaturas & Streamings');
  });
  it('classifica transporte', () => {
    const r = categorizeTransaction('UBER *TRIP', 'expense', []);
    expect(r.categoryName).toBe('Transporte');
  });
  it('usa fallback de despesa', () => {
    const r = categorizeTransaction('COMPRA ALEATÓRIA', 'expense', []);
    expect(r.categoryName).toBe('Outras Despesas');
  });
  it('usa fallback de receita', () => {
    const r = categorizeTransaction('PIX RECEBIDO MARIA', 'income', []);
    expect(r.categoryName).toBe('Outras Receitas');
  });
  it('mapeia para categoria do usuário quando existe', () => {
    const cat = makeCategory({ id: 'cat1', name: 'Mercado' });
    const r = categorizeTransaction('PADARIA', 'expense', [cat]);
    expect(r.categoryId).toBe('cat1');
    expect(r.categoryName).toBe('Mercado');
  });
});

describe('processIncomingPluggyTx', () => {
  it('gera pendência classificada', () => {
    const ctx = {
      categories: [makeCategory({ name: 'Mercado' })],
      subcategories: [makeSubcategory({ name: 'Padaria', categoryId: 'cat1' })],
      transactions: [makeTx({ id: 'mt1', amount: 18.5, date: '2026-08-10' })],
    };
    const pending = processIncomingPluggyTx(
      { id: 'demo_0001', description: 'PIX *PADARIA SÃO JOSÉ', amount: -18.5, date: '2026-08-10', paymentMethod: 'PIX' },
      ctx
    );
    expect(pending.type).toBe('expense');
    expect(pending.amount).toBe(18.5);
    expect(pending.suggestedCategory).toBe('Mercado');
    expect(pending.suggestedSubcategory).toBe('Padaria');
    expect(pending.status).toBe('PENDING');
    expect(pending.suggestedReconcileTransactionId).toBe('mt1');
  });
});

describe('applySuggestionLive', () => {
  it('aplica regra de automação por cima da heurística', () => {
    const pending = { rawDescription: 'IFOOD.COM', type: 'expense' as const, amount: 42.9, date: '2026-08-10', suggestedCategory: 'Restaurantes & Delivery', suggestedTagIds: [], aiConfidence: 90 };
    const rule = makeRule({ id: 'r1', conditionField: 'text_contains', conditionValue: 'ifood', actionField: 'category', actionValue: 'Mercado' });
    const suggestion = applySuggestionLive(pending, {
      categories: [makeCategory({ id: 'cat1', name: 'Mercado' })],
      automationRules: [rule],
      transactions: [],
    });
    expect(suggestion.suggestedCategory).toBe('Mercado');
    expect(suggestion.suggestedCategoryId).toBe('cat1');
    expect(suggestion.aiConfidence).toBe(96);
  });
});

describe('buildApprovedTransaction', () => {
  it('monta transação com origem PLUGGY', () => {
    const pending = {
      rawDescription: 'NETFLIX.COM', amount: 55.9, date: '2026-08-10', type: 'expense' as const,
      suggestedCategoryId: '', suggestedCategory: 'Assinaturas & Streamings',
      suggestedSubcategoryId: undefined, suggestedSubcategory: '',
      suggestedTagIds: [], aiConfidence: 90, pluggyTransactionId: 'demo_0008', pluggyItemId: 'item1',
      paymentMethod: 'CARTAO_CREDITO',
    };
    const tx = buildApprovedTransaction(pending, { categories: [], accounts: [makeAccount()] });
    expect(tx.origin).toBe('PLUGGY');
    expect(tx.pluggyTransactionId).toBe('demo_0008');
    expect(tx.isReconciled).toBe(true);
    expect(tx.amount).toBe(55.9);
    expect(tx.accountId).toBe('a1');
  });

  it('respeita overrides do usuário', () => {
    const pending = {
      rawDescription: 'UBER *TRIP', amount: 27.8, date: '2026-08-10', type: 'expense' as const,
      suggestedCategoryId: '', suggestedCategory: 'Transporte',
      suggestedSubcategoryId: undefined, suggestedSubcategory: '',
      suggestedTagIds: [], aiConfidence: 90, pluggyTransactionId: 'demo_0007', pluggyItemId: 'item1',
      paymentMethod: 'CARTAO_CREDITO',
    };
    const tx = buildApprovedTransaction(pending, { categories: [makeCategory({ id: 'c9', name: 'Lazer & Cultura' })] }, {
      category: 'Lazer & Cultura', notes: 'Passei no lazer',
    });
    expect(tx.category).toBe('Lazer & Cultura');
    expect(tx.categoryId).toBe('c9');
    expect(tx.notes).toBe('Passei no lazer');
  });
});

describe('isPluggyNotFound', () => {
  it('reconhece code ITEM_NOT_FOUND (corpo JSON do SDK)', () => {
    expect(isPluggyNotFound({ code: 'ITEM_NOT_FOUND', message: 'Item not found' })).toBe(true);
  });

  it('reconhece status HTTP 404 em diferentes formas', () => {
    expect(isPluggyNotFound({ status: 404 })).toBe(true);
    expect(isPluggyNotFound({ statusCode: 404 })).toBe(true);
    expect(isPluggyNotFound({ response: { status: 404 } })).toBe(true);
  });

  it('reconhece mensagem com not found / 404', () => {
    expect(isPluggyNotFound({ message: 'Account not found' })).toBe(true);
    expect(isPluggyNotFound({ codeDescription: 'Resource 404' })).toBe(true);
  });

  it('ignora erros de autenticação, 5xx e valores nulos', () => {
    expect(isPluggyNotFound({ status: 401, message: 'Unauthorized' })).toBe(false);
    expect(isPluggyNotFound({ status: 500, message: 'Internal server error' })).toBe(false);
    expect(isPluggyNotFound({ code: 'INVALID_CREDENTIALS' })).toBe(false);
    expect(isPluggyNotFound(null)).toBe(false);
    expect(isPluggyNotFound(undefined)).toBe(false);
  });
});

describe('sampleBankInvestments', () => {
  it('gera uma carteira de exemplo com ativos e valores', () => {
    const invs = sampleBankInvestments();
    expect(invs.length).toBeGreaterThan(0);
    expect(invs.every(i => i.amount !== undefined && i.name)).toBe(true);
  });
});

describe('rawInvestmentToInvestmentFields', () => {
  it('mapeia um ativo bruto da Pluggy para os campos internos', () => {
    const fields = rawInvestmentToInvestmentFields({
      id: 'inv_1',
      name: 'Tesouro Selic 2029',
      type: 'FIXED_INCOME',
      subtype: 'TREASURY',
      amount: 12450.8,
      amountOriginal: 11000,
      acquisitionDate: '2026-01-01',
      annualRate: 11.25,
    });
    expect(fields.type).toBe('TREASURY');
    expect(fields.name).toBe('Tesouro Selic 2029');
    expect(fields.initialAmount).toBe(11000);
    expect(fields.currentAmount).toBe(12450.8);
    expect(fields.startDate).toBe('2026-01-01');
    expect(fields.simpleYield).toBe(11.25);
  });

  it('usa o saldo como valor inicial quando não há valor original', () => {
    const fields = rawInvestmentToInvestmentFields({
      id: 'inv_2',
      name: 'Fundo XP',
      type: 'MUTUAL_FUND',
      amount: 1000,
    });
    expect(fields.initialAmount).toBe(1000);
    expect(fields.startDate).toBeTruthy();
  });
});