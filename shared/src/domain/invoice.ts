export type InvoiceStatus = 'OPEN' | 'CLOSED' | 'PAID' | 'OVERDUE';

export interface CreditCard {
  id: string;
  name: string;
  limitAmount: number;
  closingDay: number; // dia de fechamento (1-31)
  dueDay: number; // dia de vencimento (1-31)
  accountId: string; // conta bancária padrão para pagamento da fatura
  color?: string;
}

export interface Invoice {
  id: string;
  creditCardId: string;
  month: number; // 1-12
  year: number;
  closingDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  totalAmount: number;
  status: InvoiceStatus;
  paidAt?: string;
}