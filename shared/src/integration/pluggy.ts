import { Investment } from '../domain/entities';
import type { Transaction, TransactionType } from '../domain/transaction';

// 1. Identificação do meio de pagamento a partir da descrição
export function inferPaymentMethod(description: string, trnType?: string): string {
  const d = (description || '').toUpperCase();
  if (trnType === 'CREDIT' && d.includes('PIX')) return 'PIX';
  if (trnType === 'CREDIT' && (d.includes('TED') || d.includes('DOC') || d.includes('TRANSF'))) return 'TED_DOC';
  if (d.includes('BOLETO') || d.includes('COBRANCA')) return 'BOLETO';
  if (d.includes('PIX')) return 'PIX';
  if (d.includes('CARTAO') || d.includes('IFOOD') || d.includes('CREDITO') || d.includes('PAG*') || d.includes('FATURA')) return 'CARTAO_CREDITO';
  if (d.includes('TED') || d.includes('DOC') || d.includes('TRANSF')) return 'TED_DOC';
  return 'DEBITO';
}

// 2. Normaliza o valor assinado vindo da Pluggy em tipo + valor absoluto
export function normalizePluggyAmount(amount: number, pluggyType?: string): { type: TransactionType; absAmount: number } {
  const negative = amount < 0 || pluggyType === 'DEBIT';
  return {
    type: negative ? 'expense' : 'income',
    absAmount: Math.abs(amount),
  };
}

// 3. Converte a data da Pluggy (Date ou string) para YYYY-MM-DD
export function normalizePluggyDate(date: Date | string): string {
  if (date instanceof Date && !isNaN(date.getTime())) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(date || '').slice(0, 10);
  return str || new Date().toISOString().split('T')[0];
}

// 4. Busca por transação manual não conciliada que coincide (mesmo valor + data ±3 dias)
export function findReconciliationMatch(
  transactions: Transaction[],
  opts: { amount: number; date: string; type: TransactionType }
): string | null {
  const targetTime = new Date(opts.date + 'T00:00:00').getTime();
  const window = 3 * 24 * 60 * 60 * 1000;

  let best: Transaction | null = null;
  let bestDiff = Infinity;

  for (const t of transactions) {
    if (t.deleted_at || t.type !== opts.type) continue;
    // Já conciliada ou vinculada à Pluggy não deve ser sugerida de novo
    if (t.isReconciled || t.pluggyTransactionId) continue;
    if (Math.abs(t.amount - opts.amount) > 0.01) continue;
    const tTime = new Date(t.date + 'T00:00:00').getTime();
    const diff = Math.abs(tTime - targetTime);
    if (diff <= window && diff < bestDiff) {
      best = t;
      bestDiff = diff;
    }
  }
  return best?.id || null;
}

// 4.1 Detecta "não encontrado" vindo da API da Pluggy. Itens de sandbox que
// ficam mais de 30 dias sem atualização são apagados pela Pluggy; o item_id
// gravado em pluggy_connections passa a retornar 404 (ex.: ITEM_NOT_FOUND).
// O pluggy-sdk rejeita com o corpo JSON da resposta (sem campo status HTTP),
// então a detecção olha também o code/message/statusCode defensivamente.
export function isPluggyNotFound(err: any): boolean {
  if (!err) return false;
  const status = err?.status ?? err?.statusCode ?? err?.response?.status;
  if (status === 404) return true;
  const code = String(err?.code || '');
  if (/not[_-]?found/i.test(code)) return true;
  const text = `${err?.message || ''} ${err?.codeDescription || ''}`.toLowerCase();
  return text.includes('404') || text.includes('not found');
}

// 5. Dados de demonstração: simulam transações brutas recebidas da Pluggy
export interface RawPluggyTx {
  id: string;
  accountId?: string;
  description: string;
  amount: number;
  date: string;
  paymentMethod: string;
  pluggyType?: 'DEBIT' | 'CREDIT';
}

export function sampleBankTransactions(): RawPluggyTx[] {
  const today = new Date();
  const day = (offset: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dd}`;
  };

  // Contas de exemplo: conta corrente e cartão de crédito (mesmo item de conexão)
  const CHECKING = 'pluggy_acc_checking';
  const CREDIT = 'pluggy_acc_credit';

  return [
    { id: 'demo_0001', accountId: CHECKING, description: 'PIX *PADARIA SÃO JOSÉ', amount: -18.5, date: day(0), paymentMethod: 'PIX' },
    { id: 'demo_0002', accountId: CREDIT, description: 'PAG*IFOOD.COM', amount: -42.9, date: day(1), paymentMethod: 'CARTAO_CREDITO' },
    { id: 'demo_0003', accountId: CHECKING, description: 'PIX RECEBIDO MARIA', amount: 1200, date: day(1), paymentMethod: 'PIX', pluggyType: 'CREDIT' },
    { id: 'demo_0004', accountId: CHECKING, description: 'TED ENERGISA ENERGIA', amount: -189.32, date: day(2), paymentMethod: 'TED_DOC' },
    { id: 'demo_0005', accountId: CHECKING, description: 'BOLETO ALUGUEL IMOBILIARIA', amount: -1450, date: day(3), paymentMethod: 'BOLETO' },
    { id: 'demo_0006', accountId: CREDIT, description: 'DROGARIA SAO PAULO', amount: -64.1, date: day(3), paymentMethod: 'CARTAO_CREDITO' },
    { id: 'demo_0007', accountId: CREDIT, description: 'UBER *TRIP', amount: -27.8, date: day(4), paymentMethod: 'CARTAO_CREDITO' },
    { id: 'demo_0008', accountId: CREDIT, description: 'NETFLIX.COM', amount: -55.9, date: day(5), paymentMethod: 'CARTAO_CREDITO' },
  ];
}

export const buildDemoPendingId = (rawId: string): string => `pend_${rawId}`;

// 6. Constrói uma pendência bruta (antes da classificação) a partir de um raw da Pluggy
export function rawToPendingFields(raw: RawPluggyTx): Pick<
  any,
  'id' | 'accountId' | 'rawDescription' | 'amount' | 'date' | 'type' | 'paymentMethod' | 'pluggyTransactionId' | 'pluggyItemId'
> {
  const { type, absAmount } = normalizePluggyAmount(raw.amount, raw.pluggyType);
  return {
    id: buildDemoPendingId(raw.id),
    accountId: raw.accountId,
    rawDescription: raw.description,
    amount: absAmount,
    date: raw.date,
    type,
    paymentMethod: raw.paymentMethod || inferPaymentMethod(raw.description),
    pluggyTransactionId: raw.id,
    pluggyItemId: 'demo_item_0001',
  };
}

// 7. Dados brutos de investimento vindos da Pluggy (ativos da carteira)
export interface RawPluggyInvestment {
  id: string;
  itemId?: string;
  name: string;
  type: string; // MUTUAL_FUND | SECURITY | EQUITY | COE | FIXED_INCOME | ETF | OTHER
  subtype?: string;
  institution?: string;
  amount: number; // valor atual (saldo)
  amountOriginal?: number; // valor aplicado original
  amountProfit?: number;
  acquisitionDate?: string;
  annualRate?: number; // taxa anual (%)
  monthProfit?: number;
  yearProfit?: number;
}

export function sampleBankInvestments(): RawPluggyInvestment[] {
  const today = new Date();
  const start = (monthsAgo: number) => {
    const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, today.getDate());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return [
    {
      id: 'demo_inv_0001',
      itemId: 'demo_item_0001',
      name: 'Tesouro Selic 2029',
      type: 'FIXED_INCOME',
      subtype: 'TREASURY',
      institution: 'Tesouro Direto',
      amount: 12450.8,
      amountOriginal: 11000,
      amountProfit: 1450.8,
      acquisitionDate: start(24),
      annualRate: 11.25,
      monthProfit: 96.4,
      yearProfit: 1180.2,
    },
    {
      id: 'demo_inv_0002',
      itemId: 'demo_item_0001',
      name: 'CDB Banco XP 115% CDI',
      type: 'FIXED_INCOME',
      subtype: 'CDB',
      institution: 'XP Investimentos',
      amount: 8750.25,
      amountOriginal: 8000,
      amountProfit: 750.25,
      acquisitionDate: start(12),
      annualRate: 14.95,
      monthProfit: 88.1,
      yearProfit: 620.4,
    },
    {
      id: 'demo_inv_0003',
      itemId: 'demo_item_0001',
      name: 'Fundo Multimercado XP Horizon',
      type: 'MUTUAL_FUND',
      subtype: 'MULTIMARKET',
      institution: 'XP Investimentos',
      amount: 15230.5,
      amountOriginal: 15000,
      amountProfit: 230.5,
      acquisitionDate: start(6),
      annualRate: 8.2,
      monthProfit: 45.3,
      yearProfit: 210.8,
    },
    {
      id: 'demo_inv_0004',
      itemId: 'demo_item_0001',
      name: 'Ações Itaú PN (ITUB4)',
      type: 'EQUITY',
      subtype: 'STOCK',
      institution: 'XP Investimentos',
      amount: 5840.9,
      amountOriginal: 6200,
      amountProfit: -359.1,
      acquisitionDate: start(18),
      annualRate: -5.8,
      monthProfit: -40.2,
      yearProfit: -310.5,
    },
  ];
}

// 8. Mapeia campos da Pluggy para o formato interno de investimento (tipo/valor/rendimento)
export function rawInvestmentToInvestmentFields(
  raw: RawPluggyInvestment
): Pick<Investment, 'type' | 'name' | 'initialAmount' | 'currentAmount' | 'startDate' | 'simpleYield'> {
  const subtype = raw.subtype || raw.type || 'OTHER';
  return {
    type: subtype,
    name: raw.name || subtype,
    initialAmount: raw.amountOriginal ?? raw.amount ?? 0,
    currentAmount: raw.amount ?? 0,
    startDate: raw.acquisitionDate || new Date().toISOString().split('T')[0],
    simpleYield: raw.annualRate ?? 0,
  };
}
