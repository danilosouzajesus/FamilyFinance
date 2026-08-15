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

export interface CreditCard {
  id: string;
  name: string;
  limitAmount: number;
  closingDay: number; // dia de fechamento (1-31)
  dueDay: number; // dia de vencimento (1-31)
  accountId: string; // conta bancária padrão para pagamento da fatura
  color?: string;
}

export type InvoiceStatus = 'OPEN' | 'CLOSED' | 'PAID' | 'OVERDUE';

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

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  parentId?: string; // null = categoria pai, GUID = subcategoria
  subcategories?: string[]; // deprecated: kept for backward compat, use separate Subcategory entity
  isShared?: boolean; // categoria compartilhada entre os membros da família (consolida gastos)
}

export interface Subcategory {
  id: string;
  name: string;
  categoryId: string; // parent category GUID
  icon?: string;
  color?: string;
}

export interface Tag {
  id: string;
  name: string; // sanitizada, única por família
  color: string; // Hex
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit' | 'investment';
  balance: number;
  color: string;
}

export interface Budget {
  id: string;
  categoryId: string; // references Category.id (usually expense categories)
  limit: number;
  month: string; // YYYY-MM
  notifyAtPercent?: number; // alertar ao atingir X% do limite (ex: 80)
  rollover?: boolean; // saldo não gasto do mês acumula para o próximo mês
}

export interface MonthlyGoal {
  id: string;
  name: string; // ex: "Meta de gastos do mês"
  month: string; // YYYY-MM
  limit: number;
  categoryIds?: string[]; // se vazio = global (todas as categorias de despesa)
  notifyAtPercent?: number; // ex: 80
}

export interface GoalContribution {
  memberId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: 'deposit' | 'withdraw';
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // YYYY-MM-DD
  color: string;
  categoryId?: string; // categoria associada (ex: Investimentos)
  accountId?: string; // conta onde o valor reservado fica (cash | bank | investment)
  monthlyContribution?: number; // regra opcional de contribuição automática (R$/mês)
  contributions?: GoalContribution[]; // ledger de aportes por membro da família
}

export interface FamilyMember {
  id: string;
  name: string;
  role: 'father' | 'mother' | 'child' | 'other';
  avatar: string; // Tailwind color or avatar code
  accessRole?: 'admin' | 'member'; // hierarquia de perfis (RBAC)
  notifyChannels?: ('push' | 'email' | 'whatsapp')[]; // canais de alerta preferidos
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'yearly';
  category: string;
  billingDate: string; // YYYY-MM-DD or DD
  autoNotify: boolean;
  memberId: string;
  paymentMethod?: 'credit_card' | 'debit' | 'pix' | 'boleto';
  notifyChannel?: 'push' | 'email' | 'whatsapp';
  notifyDays?: number; // dias de antecedência para aviso (ex: 3)
  accountId?: string; // conta de débito das mensalidades (extrato geral)
}

export interface AmortizationRow {
  installment: number;
  dueDate: string; // YYYY-MM-DD
  installmentAmount: number;
  amortization: number; // valor que abate do principal
  interest: number; // juros da parcela
  balance: number; // saldo devedor após pagamento
}

export interface Debt {
  id: string;
  name: string;
  creditor?: string;
  totalAmount: number;
  installmentsCount: number;
  installmentAmount: number;
  interestRate: number; // e.g. 1.5%
  nextDueDate: string; // YYYY-MM-DD
  category: string;
  paidInstallments: number;
  accountId?: string; // conta de onde as parcelas são debitadas
  amortizationTable?: AmortizationRow[];
}

export interface Investment {
  id: string;
  type: string; // 'POUPANCA' | 'CDB' | 'LCI_LCA' | 'TESOURO_DIRETO' | 'ACOES' | etc
  name: string;
  initialAmount: number;
  currentAmount: number;
  startDate: string; // YYYY-MM-DD
  simpleYield: number; // percentage, e.g. 8.5
  contributionsCount: number;
  withdrawalsCount?: number;
  // Vínculo com a conta de investimento
  accountId?: string;
  // Proveniência dos dados (Pluggy)
  origin?: 'MANUAL' | 'PLUGGY' | 'OFX';
  pluggyInvestmentId?: string;
  pluggyItemId?: string;
  isReconciled?: boolean;
}

export interface AutomationRule {
  id: string;
  conditionField: 'text_contains' | 'amount_greater' | 'source_account';
  conditionValue: string;
  actionField: 'category' | 'subcategory' | 'tag' | 'recurrence' | 'mark_paid';
  actionValue: string;
}

export interface AppNotification {
  id: string;
  type: 'due_date' | 'budget' | 'goal' | 'average' | 'system';
  title: string;
  message: string;
  createdAt: string; // ISO
  read?: boolean;
}

export interface AuditLog {
  id: string;
  transactionId: string;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  changedBy?: string;
  changeReason: string;
  createdAt: string;
}

export interface BankIntegrationConfig {
  pluggyConnected: boolean;
  lastSyncDate?: string;
  bankName?: string;
  pendingTransactionsCount: number;
  connections?: PluggyConnection[];
}

export type PluggyPendingStatus = 'PENDING' | 'APPROVED' | 'RECONCILED' | 'IGNORED';

export interface PluggyPendingTx {
  id: string;
  userId: string;
  accountId?: string;
  rawDescription: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  paymentMethod: string; // PIX | CARTAO_CREDITO | DEBITO | TED_DOC | BOLETO
  pluggyTransactionId: string;
  pluggyItemId?: string;
  suggestedCategoryId?: string;
  suggestedCategory: string;
  suggestedSubcategoryId?: string;
  suggestedSubcategory: string;
  suggestedTagIds: string[];
  aiConfidence: number;
  suggestedReconcileTransactionId?: string | null;
  status: PluggyPendingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PluggyConnection {
  id: string;
  userId: string;
  itemId: string;
  connectorName: string;
  connectorLogoUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Mapeamento manual entre uma conta/cartão da Pluggy e uma conta do app
export interface PluggyAccountMapping {
  userId: string;
  pluggyAccountId: string;
  appAccountId: string;
  createdAt: string;
  updatedAt: string;
}

// Conta bancária/cartão detectado na Pluggy, com o mapeamento aplicado
export interface PluggyAccountInfo {
  pluggyAccountId: string;
  itemId?: string;
  name: string;
  subtype?: string;
  mappedAppAccountId?: string | null;
}

export interface FinancialState {
  transactions: Transaction[];
  categories: Category[];
  subcategories: Subcategory[];
  tags: Tag[];
  accounts: Account[];
  budgets: Budget[];
  monthlyGoals?: MonthlyGoal[];
  goals: Goal[];
  familyMembers: FamilyMember[];
  subscriptions?: Subscription[];
  debts?: Debt[];
  investments?: Investment[];
  automationRules?: AutomationRule[];
  auditLogs?: AuditLog[];
  bankConfig?: BankIntegrationConfig;
  notifications?: AppNotification[];
  creditCards?: CreditCard[];
  invoices?: Invoice[];
}

// ─────────────────────────────────────────
// Período de visualização do Controle de Transações
// ─────────────────────────────────────────
export type PeriodMode = 'day' | 'month' | 'year' | 'range' | 'cycle';

export interface PeriodPreference {
  mode: PeriodMode;
  // day: data exata (YYYY-MM-DD)
  day?: string;
  // month: mês de referência (YYYY-MM) — quando padrão, sempre o mês atual
  month?: string;
  // year: ano de referência (YYYY)
  year?: number;
  // range: período personalizado
  start?: string;
  end?: string;
  // cycle: período cíclico dia→dia (ex: 15 de um mês até 15 do seguinte)
  cycleStartDay?: number;
  cycleEndDay?: number;
  cycleMonth?: string; // mês de referência (YYYY-MM)
}

