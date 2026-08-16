export type TransactionType = 'income' | 'expense' | 'invoice_payment';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export type RecurrenceEndType = 'never' | 'after_n' | 'date_limit';

export type TransactionStatus = 'PENDENTE' | 'REALIZADO' | 'EDITADO_MANUALMENTE';

export interface RecurrenceConfig {
  frequency: RecurrenceType;
  interval?: number;
  endCondition: RecurrenceEndType;
  endAfterN?: number;
  endDate?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  categoryId: string;
  category: string;
  subcategoryId?: string;
  subcategory: string;
  tagIds: string[]; // GUIDs das tags
  amount: number;
  date: string;
  recurring: RecurrenceType;
  recurrenceConfig?: RecurrenceConfig;
  recurrenceGroupId?: string;
  notes: string;
  memberId: string;
  accountId: string;
  attachmentUrls: string[];
  attachmentNames: string[];
  status: TransactionStatus;
  deleted_at?: string;
  origin?: 'MANUAL' | 'PLUGGY' | 'OFX';
  pluggyTransactionId?: string;
  isReconciled?: boolean;
  paymentMethod?: string;
  // Vínculos de Cartão de Crédito e Fatura
  creditCardId?: string;
  invoiceId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  includeInBalanceSum?: boolean; // FALSE para compras de cartão (não debitam saldo na compra)
}