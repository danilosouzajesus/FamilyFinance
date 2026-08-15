import { describe, it, expect } from 'vitest';
import {
  assignInvoicePeriod,
  closingDateFor,
  dueDateFor,
  ensureInvoice,
  ensureInstallmentInvoices,
  computeInvoiceTotal,
  recalcInvoiceTotals,
  buildInstallmentTransactions,
  invoiceIdFor,
  parseInvoiceId,
  autoUpdateInvoiceStatuses,
} from './invoiceEngine';
import { CreditCard, Invoice, Transaction } from '../types';

const card: CreditCard = {
  id: 'card_nubank',
  name: 'Nubank',
  limitAmount: 5000,
  closingDay: 20,
  dueDay: 27,
  accountId: 'a1',
};

const makeInv = (over: Partial<Invoice> = {}): Invoice => ({
  id: invoiceIdFor(card.id, 2026, 8),
  creditCardId: card.id,
  month: 8,
  year: 2026,
  closingDate: '2026-08-20',
  dueDate: '2026-08-27',
  totalAmount: 0,
  status: 'OPEN',
  ...over,
});

const makeTx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'tx1', type: 'expense', categoryId: 'cat1', category: 'Mercado', subcategory: '', tagIds: [],
  amount: 100, date: '2026-08-10', recurring: 'none', notes: '', memberId: 'm1', accountId: 'a1',
  attachmentUrls: [], attachmentNames: [], status: 'REALIZADO', ...over,
});

describe('invoiceEngine', () => {
  describe('closingDateFor / dueDateFor', () => {
    it('calcula fechamento e vencimento com clamp para fim do mês', () => {
      expect(closingDateFor(card, 2026, 8)).toBe('2026-08-20');
      expect(dueDateFor(card, 2026, 8)).toBe('2026-08-27');
    });

    it('faz clamp do dia de fechamento quando o mês tem menos dias', () => {
      const card31 = { ...card, closingDay: 31, dueDay: 5 };
      expect(closingDateFor(card31, 2026, 2)).toBe('2026-02-28');
      expect(dueDateFor(card31, 2026, 2)).toBe('2026-03-05');
    });
  });

  describe('assignInvoicePeriod', () => {
    it('compra antes do fechamento vai para a fatura do mês atual', () => {
      expect(assignInvoicePeriod(card, '2026-08-19')).toEqual({ year: 2026, month: 8 });
    });

    it('compra no dia do fechamento ou depois vai para a fatura do mês seguinte', () => {
      expect(assignInvoicePeriod(card, '2026-08-20')).toEqual({ year: 2026, month: 9 });
      expect(assignInvoicePeriod(card, '2026-08-21')).toEqual({ year: 2026, month: 9 });
    });

    it('compra de dezembro após fechamento vai para a fatura de janeiro do ano seguinte', () => {
      expect(assignInvoicePeriod(card, '2026-12-25')).toEqual({ year: 2027, month: 1 });
    });
  });

  describe('ensureInvoice / ensureInstallmentInvoices', () => {
    it('cria fatura nova com dados do ciclo', () => {
      const inv = ensureInvoice([], card, 2026, 8);
      expect(inv).toMatchObject({ id: 'card_nubank_2026-08', closingDate: '2026-08-20', dueDate: '2026-08-27', status: 'OPEN', totalAmount: 0 });
    });

    it('reutiliza fatura existente', () => {
      const existing = makeInv();
      const inv = ensureInvoice([existing], card, 2026, 8);
      expect(inv).toBe(existing);
    });

    it('cria faturas das parcelas futuras sem duplicar', () => {
      const created = ensureInstallmentInvoices([], card, { year: 2026, month: 8 }, 3);
      expect(created).toHaveLength(3);
      expect(created.map(i => i.id)).toEqual([
        'card_nubank_2026-08',
        'card_nubank_2026-09',
        'card_nubank_2026-10',
      ]);
      // Não duplica quando já existem
      const again = ensureInstallmentInvoices(created, card, { year: 2026, month: 8 }, 3);
      expect(again).toHaveLength(0);
    });
  });

  describe('computeInvoiceTotal / recalcInvoiceTotals', () => {
    it('soma apenas transações ativas da fatura', () => {
      const txs = [
        makeTx({ id: 't1', invoiceId: 'card_nubank_2026-08', amount: 100 }),
        makeTx({ id: 't2', invoiceId: 'card_nubank_2026-08', amount: 50 }),
        makeTx({ id: 't3', invoiceId: 'card_nubank_2026-08', amount: 80, deleted_at: '2026-08-15' }),
        makeTx({ id: 't4', invoiceId: 'card_nubank_2026-09', amount: 999 }),
      ];
      expect(computeInvoiceTotal(txs, 'card_nubank_2026-08')).toBe(150);
    });

    it('recalcula os totais nas faturas não pagas', () => {
      const inv = makeInv({ totalAmount: 0 });
      const txs = [makeTx({ id: 't1', invoiceId: inv.id, amount: 300 })];
      const updated = recalcInvoiceTotals(txs, [inv]);
      expect(updated[0].totalAmount).toBe(300);
    });

    it('não altera fatura paga', () => {
      const inv = makeInv({ status: 'PAID', totalAmount: 500 });
      const txs = [makeTx({ id: 't1', invoiceId: inv.id, amount: 300 })];
      const updated = recalcInvoiceTotals(txs, [inv]);
      expect(updated[0].totalAmount).toBe(500);
    });
  });

  describe('parseInvoiceId', () => {
    it('extrai year/month mesmo quando o id do cartão contém underscore', () => {
      expect(parseInvoiceId('card_1786738320178_2026-08')).toEqual({ year: 2026, month: 8 });
      expect(parseInvoiceId('nu_roxo_2027-12')).toEqual({ year: 2027, month: 12 });
    });
  });

  describe('autoUpdateInvoiceStatuses', () => {
    const today = new Date(2026, 7, 25); // 25/08/2026

    it('marca CLOSED quando passou o fechamento e há valor', () => {
      const inv = makeInv({ closingDate: '2026-08-10', dueDate: '2026-09-05', totalAmount: 300 });
      const [updated] = autoUpdateInvoiceStatuses([inv], today);
      expect(updated.status).toBe('CLOSED');
    });

    it('marca OVERDUE quando passou o vencimento', () => {
      const inv = makeInv({ closingDate: '2026-07-20', dueDate: '2026-07-27', totalAmount: 300 });
      const [updated] = autoUpdateInvoiceStatuses([inv], today);
      expect(updated.status).toBe('OVERDUE');
    });

    it('não altera fatura paga', () => {
      const inv = makeInv({ status: 'PAID', closingDate: '2026-07-20', dueDate: '2026-07-27', totalAmount: 300 });
      const [updated] = autoUpdateInvoiceStatuses([inv], today);
      expect(updated.status).toBe('PAID');
    });

    it('não fecha fatura sem lançamentos', () => {
      const inv = makeInv({ closingDate: '2026-08-10', dueDate: '2026-09-05', totalAmount: 0 });
      const [updated] = autoUpdateInvoiceStatuses([inv], today);
      expect(updated.status).toBe('OPEN');
    });
  });

  describe('buildInstallmentTransactions', () => {
    it('gera N transações apontando para faturas dos meses subsequentes', () => {
      const base = makeTx({ amount: 100 }) as Omit<Transaction, 'id'>;
      base.creditCardId = card.id;
      const rows = buildInstallmentTransactions(base, { year: 2026, month: 8 }, 3);
      expect(rows).toHaveLength(3);
      expect(rows.map(r => r.invoiceId)).toEqual([
        'card_nubank_2026-08',
        'card_nubank_2026-09',
        'card_nubank_2026-10',
      ]);
      expect(rows.map(r => r.installmentNumber)).toEqual([1, 2, 3]);
      expect(rows.map(r => r.totalInstallments)).toEqual([3, 3, 3]);
    });
  });
});