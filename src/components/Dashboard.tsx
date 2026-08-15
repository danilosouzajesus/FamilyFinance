import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  PiggyBank, 
  AlertTriangle,
  Calendar,
  CheckCircle,
  HelpCircle,
  Clock,
  Scale,
  TrendingUp,
  Users,
  Sparkles,
  Bell,
  CreditCard,
  GripVertical,
  RotateCcw,
  FileText,
  Repeat
} from 'lucide-react';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { Transaction, Account, Budget, Goal, Category, Subscription, Debt, FamilyMember, Invoice, CreditCard as CreditCardType } from '../types';
import { currentMonthStr, monthLabelPt, formatMoney, getMonthOptions, getMonthIndex } from '../utils/format';
import { invoiceStatusLabel } from '../utils/invoiceEngine';

interface DashboardProps {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  categories: Category[];
  subscriptions?: Subscription[];
  debts?: Debt[];
  familyMembers?: FamilyMember[];
  creditCards?: CreditCardType[];
  invoices?: Invoice[];
  isPrivateMode?: boolean;
  setActiveView: (view: string) => void;
}

type DashCardId =
  | 'balance'
  | 'income'
  | 'expense'
  | 'goalsReserve'
  | 'cashflow'
  | 'expensesCat'
  | 'budgets'
  | 'goals'
  | 'recentTxs'
  | 'accounts'
  | 'invoices'
  | 'commitments';

const DEFAULT_CARDS: DashCardId[] = [
  'balance',
  'income',
  'expense',
  'goalsReserve',
  'cashflow',
  'expensesCat',
  'budgets',
  'goals',
  'recentTxs',
  'accounts',
  'invoices',
  'commitments',
];

const CARD_LABELS: Record<DashCardId, string> = {
  balance: 'Saldo Consolidado',
  income: 'Receitas do Mês',
  expense: 'Despesas do Mês',
  goalsReserve: 'Reserva de Metas',
  cashflow: 'Fluxo de Caixa Acumulado',
  expensesCat: 'Despesas por Categoria',
  budgets: 'Alinhamento do Orçamento',
  goals: 'Metas Financeiras',
  recentTxs: 'Últimas Transações',
  accounts: 'Contas e Saldos',
  invoices: 'Faturas de Cartão',
  commitments: 'Próximos Compromissos',
};

export default function Dashboard({ 
  transactions, 
  accounts, 
  budgets, 
  goals, 
  categories,
  subscriptions,
  debts,
  familyMembers,
  creditCards,
  invoices,
  isPrivateMode,
  setActiveView 
}: DashboardProps) {

  // Selected month (drives charts and stats)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
  const monthOptions = getMonthOptions();

  // Free-form card grid (drag + resize), persisted to localStorage (auto-saved)
  type CardBox = { x: number; y: number; w: number; h: number; minW?: number; minH?: number };

  const DEFAULT_GRID: Record<DashCardId, CardBox> = {
    balance: { x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    income: { x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    expense: { x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    goalsReserve: { x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    cashflow: { x: 0, y: 4, w: 8, h: 10, minW: 4, minH: 6 },
    expensesCat: { x: 8, y: 4, w: 4, h: 10, minW: 3, minH: 6 },
    budgets: { x: 0, y: 14, w: 6, h: 8, minW: 4, minH: 5 },
    goals: { x: 6, y: 14, w: 6, h: 8, minW: 4, minH: 5 },
    recentTxs: { x: 0, y: 22, w: 8, h: 8, minW: 4, minH: 5 },
    accounts: { x: 8, y: 22, w: 4, h: 8, minW: 3, minH: 5 },
    invoices: { x: 0, y: 30, w: 6, h: 7, minW: 4, minH: 4 },
    commitments: { x: 6, y: 30, w: 6, h: 7, minW: 4, minH: 4 },
  };

  const [gridLayout, setGridLayout] = useState<Record<DashCardId, CardBox>>(() => {
    try {
      const saved = localStorage.getItem('dash_grid_layout');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const merged: Record<DashCardId, CardBox> = { ...DEFAULT_GRID };
          for (const id of DEFAULT_CARDS) {
            if (parsed[id] && typeof parsed[id].x === 'number') {
              merged[id] = { ...DEFAULT_GRID[id], ...parsed[id] };
            }
          }
          return merged;
        }
      }
    } catch {
      // ignore malformed saved layout
    }
    return DEFAULT_GRID;
  });

  useEffect(() => {
    localStorage.setItem('dash_grid_layout', JSON.stringify(gridLayout));
  }, [gridLayout]);

  // Measure the container so react-grid-layout can compute column widths.
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(1200);
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setGridWidth(w);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const handleGridLayoutChange = (layout: Layout[]) => {
    setGridLayout(prev => {
      const next = { ...prev };
      for (const item of layout) {
        if (item.i in next) {
          next[item.i as DashCardId] = { ...next[item.i as DashCardId], x: item.x, y: item.y, w: item.w, h: item.h };
        }
      }
      return next;
    });
  };

  const resetGridLayout = () => {
    localStorage.removeItem('dash_grid_layout');
    setGridLayout(DEFAULT_GRID);
  };

  // Filter current month transactions
  const currentMonthTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));

  // Compute stats
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  const monthIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthExpense = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSavedInGoals = goals.reduce((sum, g) => sum + g.currentAmount, 0);

  // Próximas parcelas de dívidas/financiamentos + assinaturas (gastos futuros) para o extrato geral
  const nextDebtInstallments = (debts || []).map(d => {
    const remaining = d.installmentsCount - (d.paidInstallments || 0);
    return {
      id: d.id,
      name: d.name,
      installmentAmount: d.installmentAmount,
      dueDay: new Date(d.nextDueDate).getDate(),
      remaining,
      paidInstallments: d.paidInstallments || 0,
      nextDueDate: d.nextDueDate,
      kind: 'debt' as const
    };
  }).filter(d => d.remaining > 0).sort((a, b) => a.dueDay - b.dueDay);

  const nextSubBillings = (subscriptions || []).map(s => {
    const billingDate = String(s.billingDate);
    const day = Number(billingDate.slice(-2)) || 1;
    const amount = s.frequency === 'weekly' ? s.amount * 4 : s.frequency === 'yearly' ? s.amount / 12 : s.amount;
    return {
      id: s.id,
      name: s.name,
      installmentAmount: amount,
      dueDay: day,
      remaining: 1,
      paidInstallments: 0,
      nextDueDate: billingDate,
      kind: 'subscription' as const
    };
  }).sort((a, b) => a.dueDay - b.dueDay);

  const nextInstallments = [...nextDebtInstallments, ...nextSubBillings];
  const nextInstallmentsTotal = nextInstallments.reduce((s, d) => s + d.installmentAmount, 0);

  // Compute Recharts Area Chart Data (Daily Cumulative Income and Expenses)
  const getChartData = () => {
    const daysInMonth = new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate();
    const dailyDataMap: { [day: number]: { income: number; expense: number } } = {};
    for (let i = 1; i <= daysInMonth; i++) {
      dailyDataMap[i] = { income: 0, expense: 0 };
    }

    currentMonthTransactions.forEach(t => {
      const day = new Date(t.date).getDate();
      if (dailyDataMap[day]) {
        if (t.type === 'income') {
          dailyDataMap[day].income += t.amount;
        } else {
          dailyDataMap[day].expense += t.amount;
        }
      }
    });

    let cumulativeIncome = 0;
    let cumulativeExpense = 0;

    return Object.keys(dailyDataMap).map(dayStr => {
      const day = Number(dayStr);
      cumulativeIncome += dailyDataMap[day].income;
      cumulativeExpense += dailyDataMap[day].expense;
      return {
        day: `Dia ${day}`,
        Receitas: cumulativeIncome,
        Despesas: cumulativeExpense,
      };
    });
  };

  const areaChartData = getChartData();

  // Compute Recharts Bar Chart Data (Expenses by Category)
  const expenseByCategoryData = () => {
    const categoryTotals: { [name: string]: number } = {};
    
    transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(selectedMonth))
      .forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      });

    return Object.keys(categoryTotals).map(catName => {
      const catObj = categories.find(c => c.name === catName);
      return {
        name: catName,
        Valor: categoryTotals[catName],
        color: catObj?.color || '#6B7280'
      };
    }).sort((a, b) => b.Valor - a.Valor);
  };

  const barChartData = expenseByCategoryData();

  // Compute budgets with current month spending
  const budgetAlerts = budgets.map(b => {
    const spent = currentMonthTransactions
      .filter(t => t.type === 'expense' && t.category === b.categoryId)
      .reduce((sum, t) => sum + t.amount, 0);
    const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    return {
      ...b,
      spent,
      pct,
    };
  });

  // Active (non-paid) invoices for the summary card
  const activeInvoices = (invoices || []).filter(inv => inv.status !== 'PAID');
  const monthLabel = monthLabelPt(selectedMonth);

  // Which cards actually have content (invoices/commitments hide when empty)
  const visibleCards = DEFAULT_CARDS.filter(id => {
    if (id === 'invoices') return activeInvoices.length > 0;
    if (id === 'commitments') return nextInstallments.length > 0;
    return true;
  });

  const renderCardControls = (id: DashCardId) => (
    <div
      className="dash-card-drag-handle flex items-center gap-1 p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-grab select-none"
      title={`Arraste para reposicionar ${CARD_LABELS[id]}`}
      aria-label={`Arraste para reposicionar ${CARD_LABELS[id]}`}
    >
      <GripVertical size={13} />
    </div>
  );

  const renderCard = (id: DashCardId) => {
    switch (id) {
      case 'balance':
        return (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between gap-4 hover:border-slate-300 transition-all">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Saldo Consolidado</span>
              <h3 className={`mt-2 text-2xl font-display font-extrabold tracking-tight ${totalBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                {isPrivateMode ? 'R$ ***' : `R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              </h3>
              <p className="text-[11px] font-semibold text-slate-400 mt-1">Soma de todas as contas cadastradas</p>
              {totalSavedInGoals > 0 && (
                <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-cyan-50 border border-cyan-100/70">
                  <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider flex items-center gap-1">
                    <PiggyBank size={11} /> Reservado em metas
                  </span>
                  <span className="text-[10px] font-extrabold text-cyan-800">
                    {isPrivateMode ? 'R$ ***' : `R$ ${totalSavedInGoals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    {totalBalance !== 0 && (
                      <span className="text-cyan-600 font-bold"> ({Math.round((totalSavedInGoals / totalBalance) * 100)}%)</span>
                    )}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="w-10 h-10 rounded-xl bg-slate-50 text-indigo-600 flex items-center justify-center border border-slate-200/50">
                <Wallet size={18} />
              </div>
              {renderCardControls('balance')}
            </div>
          </div>
        );

      case 'income':
        return (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between gap-4 hover:border-slate-300 transition-all">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Receitas do Mês</span>
              <h3 className="mt-2 text-2xl font-display font-extrabold tracking-tight text-slate-900">
                {isPrivateMode ? 'R$ ***' : `R$ ${monthIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              </h3>
              <p className="text-[11px] font-semibold text-slate-400 mt-1">Total creditado em {monthLabel}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/50">
                <ArrowUpRight size={18} />
              </div>
              {renderCardControls('income')}
            </div>
          </div>
        );

      case 'expense':
        return (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between gap-4 hover:border-slate-300 transition-all">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Despesas do Mês</span>
              <h3 className="mt-2 text-2xl font-display font-extrabold tracking-tight text-slate-900">
                {isPrivateMode ? 'R$ ***' : `R$ ${monthExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              </h3>
              <p className="text-[11px] font-semibold text-slate-400 mt-1">Débitos e compras em {monthLabel}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100/50">
                <ArrowDownRight size={18} />
              </div>
              {renderCardControls('expense')}
            </div>
          </div>
        );

      case 'goalsReserve':
        return (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between gap-4 hover:border-slate-300 transition-all">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Reserva de Metas</span>
              <h3 className="mt-2 text-2xl font-display font-extrabold tracking-tight text-slate-900">
                {isPrivateMode ? 'R$ ***' : `R$ ${totalSavedInGoals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              </h3>
              <p className="text-[11px] font-semibold text-slate-400 mt-1">Montante total guardado em metas</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100/50">
                <PiggyBank size={18} />
              </div>
              {renderCardControls('goalsReserve')}
            </div>
          </div>
        );

      case 'cashflow':
        return (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-display font-bold text-slate-900">Fluxo de Caixa Acumulado</h2>
                <p className="text-xs text-slate-400">Relação diária de receitas acumuladas e despesas</p>
              </div>
              {renderCardControls('cashflow')}
            </div>
            <div className="flex-1 min-h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, '']}
                  />
                  <Area type="monotone" dataKey="Receitas" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="Despesas" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'expensesCat':
        return (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-display font-bold text-slate-900">Despesas por Categoria</h2>
              {renderCardControls('expensesCat')}
            </div>
            <p className="text-xs text-slate-400 mb-4">Maiores ralos financeiros de {monthLabel}</p>

            {barChartData.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                Nenhuma despesa registrada neste mês.
              </div>
            ) : (
              <div className="flex-1 min-h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData.slice(0, 5)} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                    />
                    <Bar dataKey="Valor" radius={[4, 4, 0, 0]}>
                      {barChartData.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
              {barChartData.slice(0, 3).map((item, index) => (
                <div key={index} className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 font-medium">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">R$ {item.Valor.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'budgets':
        return (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-display font-bold text-slate-900">Alinhamento do Orçamento</h2>
                <p className="text-xs text-slate-400">Acompanhamento dos tetos de gastos ativos</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('budgets')}
                  className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                  id="dash-ver-orcamentos-btn"
                >
                  Ver Detalhes
                </button>
                {renderCardControls('budgets')}
              </div>
            </div>

            <div className="space-y-4" id="dashboard-budgets-list">
              {budgetAlerts.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                  Nenhum limite de orçamento configurado.
                </div>
              ) : (
                budgetAlerts.map(b => {
                  const catObj = categories.find(c => c.name === b.categoryId || c.id === b.categoryId);
                  const limitExceeded = b.spent > b.limit;
                  const limitWarning = !limitExceeded && b.pct >= 80;
                  
                  return (
                    <div key={b.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">{catObj?.name || b.categoryId}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium">
                            R$ {b.spent.toFixed(2)} / R$ {b.limit.toFixed(0)}
                          </span>
                          {limitExceeded && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 font-bold text-[10px]">
                              <AlertTriangle size={10} /> Estourado
                            </span>
                          )}
                          {limitWarning && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 font-bold text-[10px]">
                              <AlertTriangle size={10} /> Alerta (80%)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            limitExceeded 
                              ? 'bg-rose-500' 
                              : limitWarning 
                                ? 'bg-amber-500' 
                                : 'bg-indigo-600'
                          }`}
                          style={{ width: `${Math.min(b.pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-display font-bold text-slate-900">Metas Financeiras</h2>
                <p className="text-xs text-slate-400">Progresso de realização dos sonhos</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('goals')}
                  className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                  id="dash-ver-metas-btn"
                >
                  Ver Detalhes
                </button>
                {renderCardControls('goals')}
              </div>
            </div>

            <div className="space-y-4" id="dashboard-goals-list">
              {goals.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                  Nenhuma meta criada. Comece a poupar agora!
                </div>
              ) : (
                goals.map(g => {
                  const pct = Math.round((g.currentAmount / g.targetAmount) * 100);
                  const isCompleted = g.currentAmount >= g.targetAmount;
                  
                  return (
                    <div key={g.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          {g.name}
                          {isCompleted && (
                            <CheckCircle size={14} className="text-emerald-500 inline" />
                          )}
                        </span>
                        <span className="text-slate-500 font-bold">{pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden relative">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: g.color }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                        <span>R$ {g.currentAmount.toLocaleString('pt-BR')} guardados</span>
                        <span>Alvo: R$ {g.targetAmount.toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );

      case 'recentTxs':
        return (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-display font-bold text-slate-900">Últimas Transações</h2>
                <p className="text-xs text-slate-400">Atividades financeiras registradas recentemente</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('transactions')}
                  className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                  id="dash-ver-transacoes-btn"
                >
                  Gerenciar Transações
                </button>
                {renderCardControls('recentTxs')}
              </div>
            </div>

            <div className="divide-y divide-slate-100" id="dashboard-recent-txs-list">
              {transactions.slice(0, 5).map(t => (
                <div key={t.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 rounded-lg px-2 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                      t.type === 'income' 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' 
                        : 'bg-rose-50 text-rose-600 border border-rose-100/50'
                    }`}>
                      {t.type === 'income' ? '+' : '-'}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{t.notes || t.category}</h4>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        {t.category} &bull; {new Date(t.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-extrabold ${
                      t.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                    }`}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                      {t.recurring !== 'none' ? 'Recorrente' : 'Única'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'accounts':
        return (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-display font-bold text-slate-900 mb-1">Contas e Saldos</h2>
                <p className="text-xs text-slate-400">Sua liquidez em carteira e cartões</p>
              </div>
              {renderCardControls('accounts')}
            </div>

            <div className="space-y-3" id="dashboard-accounts-list">
              {accounts.map(acc => (
                <div key={acc.id} className="p-3 border border-slate-100 hover:border-slate-200 rounded-xl bg-slate-50/30 flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full ${acc.color}`} />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{acc.name}</h4>
                      <p className="text-[9px] text-slate-400 capitalize font-bold">{acc.type}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-extrabold ${acc.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                    R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'invoices':
        return activeInvoices.length > 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm" id="dashboard-invoices-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-display font-bold text-slate-900 mb-1">Faturas de Cartão</h2>
                <p className="text-xs text-slate-400">Faturas em Aberto</p>
              </div>
              {renderCardControls('invoices')}
            </div>

            <div className="space-y-3">
              {activeInvoices.map(inv => {
                const card = (creditCards || []).find(c => c.id === inv.creditCardId);
                const isOverdue = inv.status === 'OVERDUE';
                return (
                  <div key={inv.id} className={`p-3 border rounded-xl flex items-center justify-between transition-colors ${
                    isOverdue ? 'border-rose-200 bg-rose-50/50' : 'border-slate-100 bg-slate-50/30'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                        isOverdue ? 'bg-rose-50 text-rose-600 border-rose-100/50' : 'bg-indigo-50 text-indigo-600 border-indigo-100/50'
                      }`}>
                        <CreditCard size={15} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{card?.name || inv.creditCardId}</h4>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          {monthLabelPt(`${inv.year}-${String(inv.month).padStart(2, '0')}`)} &bull;{' '}
                          <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                            {invoiceStatusLabel[inv.status]}
                          </span>
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-extrabold ${isOverdue ? 'text-rose-600' : 'text-slate-900'}`}>
                      R$ {inv.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null;

      case 'commitments':
        return nextInstallments.length > 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm" id="dashboard-next-installments-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-display font-bold text-slate-900 mb-1">Próximos Compromissos</h2>
                <p className="text-xs text-slate-400">
                  {nextInstallments.length} {nextInstallments.length === 1 ? 'compromisso' : 'compromissos'} futuros &bull;{' '}
                  {isPrivateMode ? 'R$ ***' : `R$ ${nextInstallmentsTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`}
                </p>
              </div>
              {renderCardControls('commitments')}
            </div>

            <div className="space-y-3">
              {nextInstallments.map(d => (
                <div key={`${d.kind}-${d.id}`} className="p-3 border border-slate-100 bg-slate-50/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${d.kind === 'debt' ? 'bg-rose-50 text-rose-600 border-rose-100/50' : 'bg-indigo-50 text-indigo-600 border-indigo-100/50'}`}>
                      {d.kind === 'debt' ? <CreditCard size={15} /> : <Repeat size={15} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{d.name}</h4>
                      {d.kind === 'debt' ? (
                        <p className="text-[10px] text-slate-400 font-semibold">
                          Vence dia {d.dueDay} &bull; {d.remaining} {d.remaining === 1 ? 'parcela restante' : 'parcelas restantes'} ({d.paidInstallments} pagas)
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-semibold">
                          Assinatura &bull; Vence dia {d.dueDay}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-rose-600">
                    {isPrivateMode ? 'R$ ***' : `R$ ${d.installmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null;
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden" id="dashboard-container">
      {/* Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">Olá, Família! 👋</h1>
          <p className="text-slate-500 text-xs mt-0.5">Aqui está o balanço das finanças familiares para {monthLabel}.</p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/50 text-slate-600 text-xs font-semibold">
            <Calendar size={14} className="text-indigo-600" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent outline-none cursor-pointer font-semibold text-slate-700"
              id="dash-month-select"
            >
              {monthOptions.map(mo => (
                <option key={mo.value} value={mo.value}>{mo.label}/2026</option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => setActiveView('ai-advisor')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
            id="dash-consult-ia-btn"
          >
            Consultar IA ✨
          </button>
          <button
            onClick={resetGridLayout}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-600 font-bold rounded-xl text-xs transition-all cursor-pointer"
            id="dash-reset-layout-btn"
            title="Voltar ao layout padrão"
          >
            <RotateCcw size={13} />
            Restaurar Layout
          </button>
        </div>
      </div>

      {/* Free-form draggable + resizable cards */}
      <div ref={gridContainerRef} className="w-full">
        <GridLayout
          className="dash-grid"
          layout={visibleCards.map(id => ({ i: id, ...gridLayout[id] }))}
          cols={12}
          rowHeight={40}
          width={gridWidth}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          compactType="vertical"
          preventCollision={false}
          draggableHandle=".dash-card-drag-handle"
          isDraggable
          isResizable
          onLayoutChange={handleGridLayoutChange}
        >
          {visibleCards.map(id => (
            <div key={id} className="h-full">
              {renderCard(id)}
            </div>
          ))}
        </GridLayout>
      </div>
    </div>
  );
}