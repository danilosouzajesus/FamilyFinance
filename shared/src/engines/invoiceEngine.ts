import type { CreditCard, Invoice, InvoiceStatus } from '../domain/invoice';
import type { Transaction } from '../domain/transaction';

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function invoiceIdFor(creditCardId: string, year: number, month: number): string {
  return `${creditCardId}_${year}-${pad2(month)}`;
}

/** Extrai { year, month } do id da fatura (formato `${creditCardId}_YYYY-MM`). */
export function parseInvoiceId(invoiceId: string): { year: number; month: number } {
  const lastUnderscore = invoiceId.lastIndexOf('_');
  const ym = invoiceId.slice(lastUnderscore + 1).split('-').map(Number);
  return { year: ym[0], month: ym[1] };
}

/** Retorna o último dia do mês (considerando anos bissextos). */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Calcula a data de fechamento da fatura de um mês (clamping do dia para o último dia do mês). */
export function closingDateFor(card: CreditCard, year: number, month: number): string {
  const day = Math.min(card.closingDay, lastDayOfMonth(year, month));
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Calcula a data de vencimento: dia de vencimento no mesmo mês do fechamento (se >= fechamento) ou no mês seguinte. */
export function dueDateFor(card: CreditCard, year: number, month: number): string {
  const dueInSameMonth = card.dueDay >= card.closingDay;
  const dueYear = dueInSameMonth ? year : (month === 12 ? year + 1 : year);
  const dueMonth = dueInSameMonth ? month : (month === 12 ? 1 : month + 1);
  const day = Math.min(card.dueDay, lastDayOfMonth(dueYear, dueMonth));
  return `${dueYear}-${pad2(dueMonth)}-${pad2(day)}`;
}

/**
 * Atribuição automática de fatura:
 * Se data da compra < data de fechamento do mês atual → fatura do mês atual.
 * Senão → fatura do mês seguinte.
 */
export function assignInvoicePeriod(card: CreditCard, purchaseDate: string): { year: number; month: number } {
  const [y, m, d] = purchaseDate.split('-').map(Number);
  const closing = closingDateFor(card, y, m);
  const [cy, cm, cd] = closing.split('-').map(Number);
  const purchase = new Date(y, m - 1, d);
  const closingDt = new Date(cy, cm - 1, cd);
  if (purchase < closingDt) {
    return { year: y, month: m };
  }
  const next = new Date(y, m, 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}

/** Garante a existência de uma fatura (criando se necessário). Retorna a fatura ativa. */
export function ensureInvoice(
  invoices: Invoice[],
  card: CreditCard,
  year: number,
  month: number
): Invoice {
  const id = invoiceIdFor(card.id, year, month);
  const existing = invoices.find(i => i.id === id);
  if (existing) return existing;
  return {
    id,
    creditCardId: card.id,
    month,
    year,
    closingDate: closingDateFor(card, year, month),
    dueDate: dueDateFor(card, year, month),
    totalAmount: 0,
    status: 'OPEN',
  };
}

/** Cria a fatura atual e as N-1 faturas futuras de um parcelamento (sem duplicar). */
export function ensureInstallmentInvoices(
  invoices: Invoice[],
  card: CreditCard,
  firstPeriod: { year: number; month: number },
  totalInstallments: number
): Invoice[] {
  const result: Invoice[] = [];
  const existing = new Set(invoices.map(i => i.id));
  for (let i = 0; i < totalInstallments; i++) {
    const dt = new Date(firstPeriod.year, firstPeriod.month - 1 + i, 1);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const inv = ensureInvoice(invoices, card, y, m);
    if (!existing.has(inv.id)) result.push(inv);
  }
  return result;
}

/** Recálculo do total da fatura a partir das transações ativas vinculadas. */
export function computeInvoiceTotal(transactions: Transaction[], invoiceId: string): number {
  return transactions
    .filter(t => !t.deleted_at && t.invoiceId === invoiceId)
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Aplica o recálculo do total em todas as faturas que possuem transações. */
export function recalcInvoiceTotals(transactions: Transaction[], invoices: Invoice[]): Invoice[] {
  return invoices.map(inv => {
    if (inv.status === 'PAID') return inv;
    const total = computeInvoiceTotal(transactions, inv.id);
    if (total !== inv.totalAmount) {
      return { ...inv, totalAmount: total };
    }
    return inv;
  });
}

/** Gera os registros (transações) de um parcelamento para as faturas de cada mês. */
export function buildInstallmentTransactions(
  base: Omit<Transaction, 'id'>,
  firstPeriod: { year: number; month: number },
  totalInstallments: number
): Omit<Transaction, 'id'>[] {
  const result: Omit<Transaction, 'id'>[] = [];
  for (let i = 0; i < totalInstallments; i++) {
    const dt = new Date(firstPeriod.year, firstPeriod.month - 1 + i, 1);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    result.push({
      ...base,
      invoiceId: invoiceIdFor(base.creditCardId || '', y, m),
      installmentNumber: i + 1,
      totalInstallments,
    });
  }
  return result;
}

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  OPEN: 'Aberta',
  CLOSED: 'Fechada',
  PAID: 'Paga',
  OVERDUE: 'Em atraso',
};

/**
 * Automação de status das faturas:
 *  - OPEN → CLOSED quando a data de fechamento já passou (e há lançamentos).
 *  - CLOSED/OPEN → OVERDUE quando o vencimento já passou e a fatura não foi paga.
 * Faturas PAID nunca mudam. Retorna a lista atualizada (apenas faturas alteradas são novas referências).
 */
export function autoUpdateInvoiceStatuses(invoices: Invoice[], today = new Date()): Invoice[] {
  const todayIso = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  return invoices.map(inv => {
    if (inv.status === 'PAID') return inv;
    let status = inv.status;
    if (status === 'OPEN' && inv.closingDate < todayIso && inv.totalAmount > 0) {
      status = 'CLOSED';
    }
    if (inv.dueDate < todayIso && inv.totalAmount > 0) {
      status = 'OVERDUE';
    }
    if (status !== inv.status) {
      return { ...inv, status };
    }
    return inv;
  });
}