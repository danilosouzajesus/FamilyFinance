export type TransactionType = 'income' | 'expense';

export type RecurrenceType = 'none' | 'weekly' | 'monthly' | 'yearly';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  subcategory: string;
  tags: string[];
  amount: number;
  date: string; // YYYY-MM-DD
  recurring: RecurrenceType;
  notes: string;
  memberId: string; // references FamilyMember.id
  accountId: string; // references Account.id
  attachmentName?: string; // name of simulated attached file
  attachmentUrl?: string; // base64 or simulated URL
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string; // Lucide icon name
  color: string; // Hex color code or Tailwind color base (e.g. 'indigo-500')
  subcategories: string[];
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit';
  balance: number;
  color: string;
}

export interface Budget {
  id: string;
  categoryId: string; // references Category.id (usually expense categories)
  limit: number;
  month: string; // YYYY-MM
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // YYYY-MM-DD
  color: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  role: 'father' | 'mother' | 'child' | 'other';
  avatar: string; // Tailwind color or avatar code
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
}

export interface Debt {
  id: string;
  name: string;
  totalAmount: number;
  installmentsCount: number;
  installmentAmount: number;
  interestRate: number; // e.g. 1.5%
  nextDueDate: string; // YYYY-MM-DD
  category: string;
  paidInstallments: number;
}

export interface Investment {
  id: string;
  type: string; // 'Renda Fixa' | 'Ações' | 'Fundos' | 'Previdência' etc
  name: string;
  initialAmount: number;
  currentAmount: number;
  startDate: string; // YYYY-MM-DD
  simpleYield: number; // percentage, e.g. 8.5
  contributionsCount: number;
}

export interface AutomationRule {
  id: string;
  conditionField: 'text_contains' | 'amount_greater' | 'source_account';
  conditionValue: string;
  actionField: 'category' | 'tag' | 'recurrence';
  actionValue: string;
}

export interface BankIntegrationConfig {
  pluggyConnected: boolean;
  lastSyncDate?: string;
  bankName?: string;
  pendingTransactionsCount: number;
}

export interface FinancialState {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  familyMembers: FamilyMember[];
  subscriptions?: Subscription[];
  debts?: Debt[];
  investments?: Investment[];
  automationRules?: AutomationRule[];
  bankConfig?: BankIntegrationConfig;
}
