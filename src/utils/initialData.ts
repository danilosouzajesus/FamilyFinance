import { Category, FamilyMember, Account, Budget, Goal, Transaction, FinancialState, Subscription, Debt, Investment, AutomationRule } from '../types';

export const defaultCategories: Category[] = [
  // Receitas
  {
    id: 'cat_salario',
    name: 'Salário',
    type: 'income',
    icon: 'Briefcase',
    color: '#10B981', // emerald-500
    subcategories: ['Salário Fixo', 'Bônus', 'Participação nos Lucros'],
  },
  {
    id: 'cat_investimentos',
    name: 'Investimentos',
    type: 'income',
    icon: 'TrendingUp',
    color: '#06B6D4', // cyan-500
    subcategories: ['Dividendos', 'Renda Fixa', 'Criptoativos'],
  },
  {
    id: 'cat_freelance',
    name: 'Freelance',
    type: 'income',
    icon: 'Laptop',
    color: '#8B5CF6', // violet-500
    subcategories: ['Consultoria', 'Aulas Particulares', 'Desenvolvimento'],
  },
  {
    id: 'cat_rec_outros',
    name: 'Outras Receitas',
    type: 'income',
    icon: 'DollarSign',
    color: '#F59E0B', // amber-500
    subcategories: ['Reembolsos', 'Presentes', 'Vendas de Usados'],
  },
  // Despesas
  {
    id: 'cat_moradia',
    name: 'Moradia',
    type: 'expense',
    icon: 'Home',
    color: '#3B82F6', // blue-500
    subcategories: ['Aluguel/Financiamento', 'Condomínio', 'Energia Elétrica', 'Água', 'Internet', 'Manutenção'],
  },
  {
    id: 'cat_alimentacao',
    name: 'Alimentação',
    type: 'expense',
    icon: 'Utensils',
    color: '#EF4444', // red-500
    subcategories: ['Supermercado', 'Restaurantes', 'Delivery', 'Feira/Padaria'],
  },
  {
    id: 'cat_transporte',
    name: 'Transporte',
    type: 'expense',
    icon: 'Car',
    color: '#F59E0B', // amber-500
    subcategories: ['Combustível', 'Uber/Táxi', 'Transporte Público', 'Seguro Auto', 'Manutenção Veículo'],
  },
  {
    id: 'cat_saude',
    name: 'Saúde',
    type: 'expense',
    icon: 'HeartPulse',
    color: '#EC4899', // pink-500
    subcategories: ['Plano de Saúde', 'Farmácia', 'Consultas', 'Dentista'],
  },
  {
    id: 'cat_lazer',
    name: 'Lazer & Viagem',
    type: 'expense',
    icon: 'Compass',
    color: '#10B981', // emerald-500
    subcategories: ['Cinema/Teatro', 'Viagens', 'Hospedagem', 'Bares & Baladas', 'Assinaturas/Netflix/Spotify'],
  },
  {
    id: 'cat_educacao',
    name: 'Educação',
    type: 'expense',
    icon: 'GraduationCap',
    color: '#6366F1', // indigo-500
    subcategories: ['Mensalidade Escola', 'Cursos/Certificações', 'Livros & Material'],
  },
  {
    id: 'cat_vestuario',
    name: 'Vestuário',
    type: 'expense',
    icon: 'Shirt',
    color: '#8B5CF6', // violet-500
    subcategories: ['Roupas', 'Calçados', 'Acessórios'],
  },
  {
    id: 'cat_desp_outros',
    name: 'Outras Despesas',
    type: 'expense',
    icon: 'HelpCircle',
    color: '#6B7280', // gray-500
    subcategories: ['Tarifas Bancárias', 'Impostos', 'Presentes dados', 'Imprevistos'],
  },
];

export const defaultFamilyMembers: FamilyMember[] = [
  { id: 'mem_pai', name: 'Carlos (Pai)', role: 'father', avatar: 'bg-blue-600 text-white' },
  { id: 'mem_mae', name: 'Mariana (Mãe)', role: 'mother', avatar: 'bg-rose-500 text-white' },
  { id: 'mem_filho', name: 'Pedro (Filho)', role: 'child', avatar: 'bg-emerald-500 text-white' },
  { id: 'mem_geral', name: 'Geral / Família', role: 'other', avatar: 'bg-purple-600 text-white' },
];

export const defaultAccounts: Account[] = [
  { id: 'acc_itau', name: 'Banco Itaú', type: 'bank', balance: 6540.00, color: 'bg-orange-500 border-orange-600' },
  { id: 'acc_nubank', name: 'Nubank (Digital)', type: 'bank', balance: 3200.50, color: 'bg-purple-600 border-purple-700' },
  { id: 'acc_carteira', name: 'Dinheiro em Mão', type: 'cash', balance: 420.00, color: 'bg-emerald-600 border-emerald-700' },
  { id: 'acc_cartao', name: 'Cartão de Crédito', type: 'credit', balance: -1580.40, color: 'bg-slate-700 border-slate-800' },
];

export const defaultGoals: Goal[] = [
  { id: 'goal_viagem', name: 'Viagem de Fim de Ano', targetAmount: 15000, currentAmount: 8400, deadline: '2026-12-15', color: '#10B981' },
  { id: 'goal_reserva', name: 'Reserva de Emergência', targetAmount: 30000, currentAmount: 22000, deadline: '2027-06-30', color: '#3B82F6' },
  { id: 'goal_notebook', name: 'Notebook Novo Pedro', targetAmount: 5000, currentAmount: 1200, deadline: '2026-10-01', color: '#8B5CF6' },
];

export const defaultBudgets: Budget[] = [
  { id: 'bud_alimentacao', categoryId: 'cat_alimentacao', limit: 2500, month: '2026-08' },
  { id: 'bud_lazer', categoryId: 'cat_lazer', limit: 1200, month: '2026-08' },
  { id: 'bud_transporte', categoryId: 'cat_transporte', limit: 1000, month: '2026-08' },
  { id: 'bud_moradia', categoryId: 'cat_moradia', limit: 3500, month: '2026-08' },
];

// Gera datas dinâmicas retroativas a partir de hoje para simular transações reais
const getPastDateString = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

export const defaultTransactions: Transaction[] = [
  // Receitas
  {
    id: 'tx_1',
    type: 'income',
    category: 'Salário',
    subcategory: 'Salário Fixo',
    tags: ['Carlos', 'Trabalho'],
    amount: 8500.00,
    date: getPastDateString(28),
    recurring: 'monthly',
    notes: 'Salário mensal Carlos',
    memberId: 'mem_pai',
    accountId: 'acc_itau',
  },
  {
    id: 'tx_2',
    type: 'income',
    category: 'Salário',
    subcategory: 'Salário Fixo',
    tags: ['Mariana', 'Trabalho'],
    amount: 7200.00,
    date: getPastDateString(28),
    recurring: 'monthly',
    notes: 'Salário mensal Mariana',
    memberId: 'mem_mae',
    accountId: 'acc_nubank',
  },
  {
    id: 'tx_3',
    type: 'income',
    category: 'Freelance',
    subcategory: 'Consultoria',
    tags: ['Carlos', 'Extra'],
    amount: 1800.00,
    date: getPastDateString(15),
    recurring: 'none',
    notes: 'Consultoria de TI para cliente X',
    memberId: 'mem_pai',
    accountId: 'acc_nubank',
  },
  {
    id: 'tx_4',
    type: 'income',
    category: 'Investimentos',
    subcategory: 'Dividendos',
    tags: ['Rendimento'],
    amount: 320.50,
    date: getPastDateString(10),
    recurring: 'monthly',
    notes: 'Rendimentos fundo imobiliário',
    memberId: 'mem_geral',
    accountId: 'acc_itau',
  },

  // Despesas
  {
    id: 'tx_5',
    type: 'expense',
    category: 'Moradia',
    subcategory: 'Aluguel/Financiamento',
    tags: ['Fixo', 'Moradia'],
    amount: 2800.00,
    date: getPastDateString(25),
    recurring: 'monthly',
    notes: 'Financiamento do apartamento',
    memberId: 'mem_geral',
    accountId: 'acc_itau',
  },
  {
    id: 'tx_6',
    type: 'expense',
    category: 'Moradia',
    subcategory: 'Condomínio',
    tags: ['Fixo', 'Moradia'],
    amount: 650.00,
    date: getPastDateString(25),
    recurring: 'monthly',
    notes: 'Condomínio mensal',
    memberId: 'mem_geral',
    accountId: 'acc_itau',
  },
  {
    id: 'tx_7',
    type: 'expense',
    category: 'Moradia',
    subcategory: 'Internet',
    tags: ['Fixo', 'Serviço'],
    amount: 149.90,
    date: getPastDateString(24),
    recurring: 'monthly',
    notes: 'Internet Vivo Fibra',
    memberId: 'mem_geral',
    accountId: 'acc_itau',
  },
  {
    id: 'tx_8',
    type: 'expense',
    category: 'Alimentação',
    subcategory: 'Supermercado',
    tags: ['Essencial'],
    amount: 845.20,
    date: getPastDateString(20),
    recurring: 'none',
    notes: 'Compras do mês no Pão de Açúcar',
    memberId: 'mem_mae',
    accountId: 'acc_cartao',
  },
  {
    id: 'tx_9',
    type: 'expense',
    category: 'Alimentação',
    subcategory: 'Supermercado',
    tags: ['Essencial'],
    amount: 320.10,
    date: getPastDateString(8),
    recurring: 'none',
    notes: 'Feira e reposição semanal',
    memberId: 'mem_pai',
    accountId: 'acc_carteira',
  },
  {
    id: 'tx_10',
    type: 'expense',
    category: 'Alimentação',
    subcategory: 'Delivery',
    tags: ['Lazer', 'Fim de Semana'],
    amount: 184.00,
    date: getPastDateString(14),
    recurring: 'none',
    notes: 'Sushi família sábado',
    memberId: 'mem_geral',
    accountId: 'acc_cartao',
  },
  {
    id: 'tx_11',
    type: 'expense',
    category: 'Transporte',
    subcategory: 'Combustível',
    tags: ['Carro'],
    amount: 220.00,
    date: getPastDateString(18),
    recurring: 'none',
    notes: 'Abastecimento SUV Carlos',
    memberId: 'mem_pai',
    accountId: 'acc_cartao',
  },
  {
    id: 'tx_12',
    type: 'expense',
    category: 'Transporte',
    subcategory: 'Uber/Táxi',
    tags: ['Mobilidade'],
    amount: 45.50,
    date: getPastDateString(16),
    recurring: 'none',
    notes: 'Corrida Pedro ida ao curso',
    memberId: 'mem_filho',
    accountId: 'acc_nubank',
  },
  {
    id: 'tx_13',
    type: 'expense',
    category: 'Saúde',
    subcategory: 'Plano de Saúde',
    tags: ['Fixo', 'Essencial'],
    amount: 1200.00,
    date: getPastDateString(24),
    recurring: 'monthly',
    notes: 'Plano Bradesco Saúde Família',
    memberId: 'mem_geral',
    accountId: 'acc_itau',
  },
  {
    id: 'tx_14',
    type: 'expense',
    category: 'Saúde',
    subcategory: 'Farmácia',
    tags: ['Remédios'],
    amount: 114.30,
    date: getPastDateString(12),
    recurring: 'none',
    notes: 'Remédios de uso contínuo Mariana',
    memberId: 'mem_mae',
    accountId: 'acc_cartao',
  },
  {
    id: 'tx_15',
    type: 'expense',
    category: 'Lazer & Viagem',
    subcategory: 'Assinaturas/Netflix/Spotify',
    tags: ['Entretenimento'],
    amount: 55.90,
    date: getPastDateString(22),
    recurring: 'monthly',
    notes: 'Assinatura Netflix Premium',
    memberId: 'mem_geral',
    accountId: 'acc_cartao',
  },
  {
    id: 'tx_16',
    type: 'expense',
    category: 'Lazer & Viagem',
    subcategory: 'Cinema/Teatro',
    tags: ['Fim de Semana'],
    amount: 120.00,
    date: getPastDateString(5),
    recurring: 'none',
    notes: 'Ingressos cinema Carlos e Mariana',
    memberId: 'mem_pai',
    accountId: 'acc_cartao',
  },
  {
    id: 'tx_17',
    type: 'expense',
    category: 'Educação',
    subcategory: 'Mensalidade Escola',
    tags: ['Educação', 'Pedro'],
    amount: 1500.00,
    date: getPastDateString(23),
    recurring: 'monthly',
    notes: 'Mensalidade Colégio Pedro',
    memberId: 'mem_filho',
    accountId: 'acc_itau',
  },
  {
    id: 'tx_18',
    type: 'expense',
    category: 'Vestuário',
    subcategory: 'Roupas',
    tags: ['Shopping'],
    amount: 350.00,
    date: getPastDateString(4),
    recurring: 'none',
    notes: 'Casaco frio Pedro',
    memberId: 'mem_filho',
    accountId: 'acc_cartao',
  },
];

export const defaultSubscriptions: Subscription[] = [
  { id: 'sub_1', name: 'Netflix Premium', amount: 55.90, frequency: 'monthly', category: 'Lazer & Viagem', billingDate: '22', autoNotify: true, memberId: 'mem_geral' },
  { id: 'sub_2', name: 'Spotify Familiar', amount: 34.90, frequency: 'monthly', category: 'Lazer & Viagem', billingDate: '05', autoNotify: true, memberId: 'mem_geral' },
  { id: 'sub_3', name: 'Academia BlueFit', amount: 129.90, frequency: 'monthly', category: 'Saúde', billingDate: '10', autoNotify: false, memberId: 'mem_pai' },
  { id: 'sub_4', name: 'Amazon Prime', amount: 19.90, frequency: 'monthly', category: 'Lazer & Viagem', billingDate: '15', autoNotify: true, memberId: 'mem_mae' }
];

export const defaultDebts: Debt[] = [
  { id: 'debt_1', name: 'Financiamento Automóvel', totalAmount: 48000, installmentsCount: 48, installmentAmount: 1250, interestRate: 1.8, nextDueDate: '2026-08-20', category: 'Transporte', paidInstallments: 12 },
  { id: 'debt_2', name: 'Parcelamento Geladeira', totalAmount: 3200, installmentsCount: 10, installmentAmount: 320, interestRate: 0.0, nextDueDate: '2026-08-15', category: 'Moradia', paidInstallments: 4 }
];

export const defaultInvestments: Investment[] = [
  { id: 'inv_1', type: 'Renda Fixa', name: 'Tesouro Selic 2029', initialAmount: 10000, currentAmount: 11450, startDate: '2025-01-10', simpleYield: 11.25, contributionsCount: 4 },
  { id: 'inv_2', type: 'Ações', name: 'Carteira de Dividendos (B3)', initialAmount: 15000, currentAmount: 16800, startDate: '2025-03-15', simpleYield: 12.0, contributionsCount: 6 },
  { id: 'inv_3', type: 'Criptoativos', name: 'Bitcoin (BTC)', initialAmount: 2000, currentAmount: 3100, startDate: '2025-06-20', simpleYield: 55.0, contributionsCount: 2 }
];

export const defaultAutomationRules: AutomationRule[] = [
  { id: 'rule_1', conditionField: 'text_contains', conditionValue: 'Uber', actionField: 'category', actionValue: 'Transporte' },
  { id: 'rule_2', conditionField: 'text_contains', conditionValue: 'Supermercado', actionField: 'category', actionValue: 'Alimentação' },
  { id: 'rule_3', conditionField: 'amount_greater', conditionValue: '1000', actionField: 'tag', actionValue: 'Investimento-Alto' }
];

export const defaultBankConfig = {
  pluggyConnected: false,
  pendingTransactionsCount: 0
};

export const getInitialState = (): FinancialState => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('family_finance_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) {
          return {
            categories: Array.isArray(parsed.categories) ? parsed.categories : [],
            familyMembers: Array.isArray(parsed.familyMembers) ? parsed.familyMembers : [],
            accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
            transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
            budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
            goals: Array.isArray(parsed.goals) ? parsed.goals : [],
            subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
            debts: Array.isArray(parsed.debts) ? parsed.debts : [],
            investments: Array.isArray(parsed.investments) ? parsed.investments : [],
            automationRules: Array.isArray(parsed.automationRules) ? parsed.automationRules : [],
            bankConfig: parsed.bankConfig || defaultBankConfig,
          };
        }
      } catch (e) {
        console.error('Error loading state from localStorage:', e);
      }
    }
  }
  return {
    categories: [],
    familyMembers: [],
    accounts: [],
    transactions: [],
    budgets: [],
    goals: [],
    subscriptions: [],
    debts: [],
    investments: [],
    automationRules: [],
    bankConfig: defaultBankConfig,
  };
};


export const saveState = (state: FinancialState) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('family_finance_state', JSON.stringify(state));
  }
};
