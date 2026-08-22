import { FinancialState, Category, Subcategory } from '@ff/shared';

export const defaultBankConfig = {
  pluggyConnected: false,
  pendingTransactionsCount: 0
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_transf', name: 'Transferências', type: 'expense', icon: 'ArrowLeftRight', color: '#8B5CF6' },
  { id: 'cat_transf_inc', name: 'Transferências', type: 'income', icon: 'ArrowLeftRight', color: '#8B5CF6' },
  { id: 'cat_salario', name: 'Salário & Benefícios', type: 'income', icon: 'Briefcase', color: '#10B981' },
  { id: 'cat_outras_rec', name: 'Outras Receitas', type: 'income', icon: 'TrendingUp', color: '#059669' },
  { id: 'cat_moradia', name: 'Moradia & Contas', type: 'expense', icon: 'Home', color: '#3B82F6' },
  { id: 'cat_mercado', name: 'Mercado', type: 'expense', icon: 'ShoppingCart', color: '#10B981' },
  { id: 'cat_restaurantes', name: 'Restaurantes & Delivery', type: 'expense', icon: 'Utensils', color: '#F59E0B' },
  { id: 'cat_transporte', name: 'Transporte', type: 'expense', icon: 'Car', color: '#6366F1' },
  { id: 'cat_saude', name: 'Saúde', type: 'expense', icon: 'HeartPulse', color: '#EC4899' },
  { id: 'cat_educacao', name: 'Educação', type: 'expense', icon: 'GraduationCap', color: '#8B5CF6' },
  { id: 'cat_assinaturas', name: 'Assinaturas & Streamings', type: 'expense', icon: 'Tv', color: '#14B8A6' },
  { id: 'cat_lazer', name: 'Lazer & Cultura', type: 'expense', icon: 'Smile', color: '#F97316' },
  { id: 'cat_vestuario', name: 'Vestuário', type: 'expense', icon: 'ShoppingBag', color: '#D946EF' },
  { id: 'cat_investimentos', name: 'Investimentos', type: 'expense', icon: 'PiggyBank', color: '#06B6D4' },
  { id: 'cat_outras_desp', name: 'Outras Despesas', type: 'expense', icon: 'HelpCircle', color: '#64748B' },
];

export const DEFAULT_SUBCATEGORIES: Subcategory[] = [
  { id: 'sub_transf_1', name: 'Transferência entre Contas', categoryId: 'cat_transf' },
  { id: 'sub_transf_2', name: 'PIX Enviado / Recebido', categoryId: 'cat_transf' },
  { id: 'sub_transf_3', name: 'TED / DOC', categoryId: 'cat_transf' },
  { id: 'sub_transf_4', name: 'Aplicações / Resgates', categoryId: 'cat_transf' },
  { id: 'sub_transf_inc_1', name: 'Transferência entre Contas', categoryId: 'cat_transf_inc' },
  { id: 'sub_transf_inc_2', name: 'PIX Enviado / Recebido', categoryId: 'cat_transf_inc' },
  { id: 'sub_transf_inc_3', name: 'TED / DOC', categoryId: 'cat_transf_inc' },
  { id: 'sub_transf_inc_4', name: 'Aplicações / Resgates', categoryId: 'cat_transf_inc' },
];

export const ensureDefaultCategories = (categories: Category[] = [], subcategories: Subcategory[] = []) => {
  let cats = [...categories];
  let subs = [...subcategories];

  if (cats.length === 0) {
    cats = [...DEFAULT_CATEGORIES];
    subs = [...DEFAULT_SUBCATEGORIES];
  } else {
    const hasExpTransf = cats.some(c => (c.name.toLowerCase() === 'transferências' || c.name.toLowerCase() === 'transferencias') && c.type === 'expense');
    if (!hasExpTransf) {
      cats.push({ id: 'cat_transf', name: 'Transferências', type: 'expense', icon: 'ArrowLeftRight', color: '#8B5CF6' });
      subs.push(
        { id: 'sub_transf_1', name: 'Transferência entre Contas', categoryId: 'cat_transf' },
        { id: 'sub_transf_2', name: 'PIX Enviado / Recebido', categoryId: 'cat_transf' },
        { id: 'sub_transf_3', name: 'TED / DOC', categoryId: 'cat_transf' },
        { id: 'sub_transf_4', name: 'Aplicações / Resgates', categoryId: 'cat_transf' },
      );
    }

    const hasIncTransf = cats.some(c => (c.name.toLowerCase() === 'transferências' || c.name.toLowerCase() === 'transferencias') && c.type === 'income');
    if (!hasIncTransf) {
      cats.push({ id: 'cat_transf_inc', name: 'Transferências', type: 'income', icon: 'ArrowLeftRight', color: '#8B5CF6' });
      subs.push(
        { id: 'sub_transf_inc_1', name: 'Transferência entre Contas', categoryId: 'cat_transf_inc' },
        { id: 'sub_transf_inc_2', name: 'PIX Enviado / Recebido', categoryId: 'cat_transf_inc' },
        { id: 'sub_transf_inc_3', name: 'TED / DOC', categoryId: 'cat_transf_inc' },
        { id: 'sub_transf_inc_4', name: 'Aplicações / Resgates', categoryId: 'cat_transf_inc' },
      );
    }
  }

  return { categories: cats, subcategories: subs };
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
  let rawCats: Category[] = [];
  let rawSubs: Subcategory[] = [];
  let parsed: any = null;

  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('family_finance_state');
    if (saved) {
      try {
        parsed = JSON.parse(saved);
        if (parsed) {
          rawCats = Array.isArray(parsed.categories) ? parsed.categories : [];
          rawSubs = Array.isArray(parsed.subcategories) ? parsed.subcategories : [];
        }
      } catch (e) {
        console.error('Error loading state from localStorage:', e);
      }
    }
  }

  const { categories, subcategories } = ensureDefaultCategories(rawCats, rawSubs);

  if (parsed) {
    return {
      categories,
      subcategories,
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

  return {
    categories,
    subcategories,
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
