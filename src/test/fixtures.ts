import {
  Transaction, Category, Subcategory, Tag, Account, Budget, MonthlyGoal, Goal,
  FamilyMember, Subscription, Debt, Investment, AutomationRule, AppNotification,
  FinancialState,
} from '../types';

export const noop = () => {};

export const makeTx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'tx1', type: 'expense', categoryId: 'cat1', category: 'Mercado', subcategory: '', tagIds: [],
  amount: 100, date: '2026-08-10', recurring: 'none', notes: '', memberId: 'm1', accountId: 'a1',
  attachmentUrls: [], attachmentNames: [], status: 'REALIZADO', ...over,
});

export const makeCategory = (over: Partial<Category> = {}): Category => ({
  id: 'cat1', name: 'Mercado', type: 'expense', icon: 'Cart', color: '#10B981',
  subcategories: [], parentId: undefined, ...over,
});

export const makeSubcategory = (over: Partial<Subcategory> = {}): Subcategory => ({
  id: 'sub1', name: 'Restaurante', categoryId: 'cat1', ...over,
});

export const makeTag = (over: Partial<Tag> = {}): Tag => ({
  id: 'tag1', name: 'essencial', color: '#10B981', ...over,
});

export const makeAccount = (over: Partial<Account> = {}): Account => ({
  id: 'a1', name: 'Banco Itaú', type: 'bank', balance: 1250.5, color: 'blue-500', ...over,
});

export const makeBudget = (over: Partial<Budget> = {}): Budget => ({
  id: 'b1', categoryId: 'cat1', limit: 1000, month: '2026-08', notifyAtPercent: 80, rollover: false, ...over,
});

export const makeMonthlyGoal = (over: Partial<MonthlyGoal> = {}): MonthlyGoal => ({
  id: 'mg1', name: 'Meta de gastos', month: '2026-08', limit: 3000, categoryIds: [], notifyAtPercent: 80, ...over,
});

export const makeGoal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1', name: 'Viagem', targetAmount: 5000, currentAmount: 1000, deadline: '2026-12-31',
  color: 'emerald-500', ...over,
});

export const makeMember = (over: Partial<FamilyMember> = {}): FamilyMember => ({
  id: 'm1', name: 'Ana', role: 'mother', avatar: 'bg-pink-500 text-white', ...over,
});

export const makeSubscription = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's1', name: 'Netflix', amount: 39.9, frequency: 'monthly', category: 'Streaming',
  billingDate: '22', autoNotify: true, memberId: 'm1', paymentMethod: 'credit_card',
  notifyChannel: 'push', notifyDays: 3, ...over,
});

export const makeDebt = (over: Partial<Debt> = {}): Debt => ({
  id: 'd1', name: 'Financiamento do carro', totalAmount: 10000, installmentsCount: 12,
  installmentAmount: 833.33, interestRate: 1.5, nextDueDate: '2026-09-01', category: 'Veículo',
  paidInstallments: 2, ...over,
});

export const makeInvestment = (over: Partial<Investment> = {}): Investment => ({
  id: 'i1', type: 'CDB', name: 'CDB 110%', initialAmount: 1000, currentAmount: 1100,
  startDate: '2025-01-01', simpleYield: 10, contributionsCount: 1, ...over,
});

export const makeRule = (over: Partial<AutomationRule> = {}): AutomationRule => ({
  id: 'r1', conditionField: 'text_contains', conditionValue: 'iFood',
  actionField: 'category', actionValue: 'Alimentação', ...over,
});

export const makeNotification = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1', type: 'budget', title: 'Orçamento', message: 'Você usou 90% do limite de Mercado',
  createdAt: '2026-08-10T10:00:00Z', ...over,
});

export const emptyState = (): FinancialState => ({
  transactions: [], categories: [], subcategories: [], tags: [], accounts: [], budgets: [],
  monthlyGoals: [], goals: [], familyMembers: [], subscriptions: [], debts: [], investments: [],
  automationRules: [], auditLogs: [], bankConfig: { pluggyConnected: false, pendingTransactionsCount: 0 },
});

export const sampleState = (): FinancialState => ({
  ...emptyState(),
  transactions: [makeTx()],
  categories: [makeCategory()],
  subcategories: [makeSubcategory()],
  tags: [makeTag()],
  accounts: [makeAccount()],
  budgets: [makeBudget()],
  monthlyGoals: [makeMonthlyGoal()],
  goals: [makeGoal()],
  familyMembers: [makeMember()],
  subscriptions: [makeSubscription()],
  debts: [makeDebt()],
  investments: [makeInvestment()],
  automationRules: [makeRule()],
});