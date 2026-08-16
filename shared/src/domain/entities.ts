import type { TransactionType } from './transaction';

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