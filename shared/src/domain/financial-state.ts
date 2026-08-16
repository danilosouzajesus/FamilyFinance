import type {
  Account,
  Budget,
  MonthlyGoal,
  Goal,
  FamilyMember,
  Subscription,
  Debt,
  Investment,
  AutomationRule,
  AuditLog,
  AppNotification,
} from './entities';
import type { Category, Subcategory, Tag } from './category';
import type { CreditCard, Invoice } from './invoice';
import type { Transaction } from './transaction';
import type { PluggyConnection } from '../integration/pluggy-types';

export interface BankIntegrationConfig {
  pluggyConnected: boolean;
  lastSyncDate?: string;
  bankName?: string;
  pendingTransactionsCount: number;
  connections?: PluggyConnection[];
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