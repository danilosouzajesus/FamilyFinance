import { FinancialState } from '../types';

export const defaultBankConfig = {
  pluggyConnected: false,
  pendingTransactionsCount: 0
};

const STATE_VERSION_KEY = 'family_finance_state_version';
const CURRENT_STATE_VERSION = 2;

const runStateMigrations = () => {
  if (typeof window === 'undefined') return;
  try {
    const storedVersion = Number(localStorage.getItem(STATE_VERSION_KEY) || 0);
    if (storedVersion < CURRENT_STATE_VERSION) {
      localStorage.removeItem('family_finance_state');
      localStorage.setItem(STATE_VERSION_KEY, String(CURRENT_STATE_VERSION));
    }
  } catch (e) {
    console.error('Error running state migration:', e);
  }
};

export const getInitialState = (): FinancialState => {
  runStateMigrations();
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('family_finance_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) {
          return {
            categories: Array.isArray(parsed.categories) ? parsed.categories : [],
            subcategories: Array.isArray(parsed.subcategories) ? parsed.subcategories : [],
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
            familyMembers: Array.isArray(parsed.familyMembers) ? parsed.familyMembers : [],
            accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
            transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
            budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
            monthlyGoals: Array.isArray(parsed.monthlyGoals) ? parsed.monthlyGoals : [],
            goals: Array.isArray(parsed.goals) ? parsed.goals : [],
            subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
            debts: Array.isArray(parsed.debts) ? parsed.debts : [],
            investments: Array.isArray(parsed.investments) ? parsed.investments : [],
            automationRules: Array.isArray(parsed.automationRules) ? parsed.automationRules : [],
            auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
            bankConfig: parsed.bankConfig || defaultBankConfig,
            creditCards: Array.isArray(parsed.creditCards) ? parsed.creditCards : [],
            invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
          };
        }
      } catch (e) {
        console.error('Error loading state from localStorage:', e);
      }
    }
  }
  return {
    categories: [],
    subcategories: [],
    tags: [],
    familyMembers: [],
    accounts: [],
    transactions: [],
    budgets: [],
    monthlyGoals: [],
    goals: [],
    subscriptions: [],
    debts: [],
    investments: [],
    automationRules: [],
    auditLogs: [],
    bankConfig: defaultBankConfig,
    notifications: [],
    creditCards: [],
    invoices: [],
  };
};


export const saveState = (state: FinancialState) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('family_finance_state', JSON.stringify(state));
  }
};
