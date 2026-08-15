import React, { useMemo, useState } from 'react';
import { 
  BarChart3, 
  AlertTriangle,
  TrendingUp, 
  TrendingDown, 
  PieChart as PieIcon, 
  Filter, 
  Download,
  Table as TableIcon,
  ChevronDown,
  ChevronRight,
  Activity,
  LineChart as LineIcon,
  SlidersHorizontal,
  CreditCard
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
  LineChart,
  Line
} from 'recharts';
import { Transaction, Category, Account, FamilyMember, Subcategory, Subscription, Debt, CreditCard as CreditCardType, Invoice } from '../types';
import { currentMonthStr, formatMoney } from '../utils/format';
import { invoiceStatusLabel } from '../utils/invoiceEngine';

interface ReportsProps {
  transactions: Transaction[];
  categories: Category[];
  subcategories?: Subcategory[];
  accounts: Account[];
  familyMembers: FamilyMember[];
  subscriptions?: Subscription[];
  debts?: Debt[];
  creditCards?: CreditCardType[];
  invoices?: Invoice[];
  isPrivateMode?: boolean;
}

type TabKey = 'rateio' | 'comparativo' | 'comportamento' | 'projecao' | 'cartao';

export default function Reports({
  transactions,
  categories,
  subcategories = [],
  accounts,
  familyMembers,
  subscriptions = [],
  debts = [],
  creditCards = [],
  invoices = [],
  isPrivateMode = false
}: ReportsProps) {
  const activeTxs = useMemo(() => transactions.filter(t => !t.deleted_at), [transactions]);
  const [filterMonth, setFilterMonth] = useState(currentMonthStr());
  const prevMonth = useMemo(() => {
    const [y, m] = filterMonth.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [filterMonth]);
  const [filterMember, setFilterMember] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');
  const [activeTab, setActiveTab] = useState<TabKey>('rateio');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedSubcat, setExpandedSubcat] = useState<string | null>(null);
  const [year, setYear] = useState<string>(filterMonth.slice(0, 4));
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  const [skippedItems, setSkippedItems] = useState<string[]>([]);

  const filteredTxs = useMemo(() => activeTxs.filter(t => {
    const matchesMonth = t.date.startsWith(filterMonth);
    const matchesMember = filterMember === 'all' || t.memberId === filterMember;
    const matchesAccount = filterAccount === 'all' || t.accountId === filterAccount;
    return matchesMonth && matchesMember && matchesAccount;
  }), [activeTxs, filterMonth, filterMember, filterAccount]);

  const totalIncome = filteredTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = filteredTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  // ---- 3.2 Pie data + drill-down ----
  const pieData = useMemo(() => {
    const grouped: { [name: string]: number } = {};
    filteredTxs.filter(t => t.type === 'expense').forEach(t => {
      grouped[t.category] = (grouped[t.category] || 0) + t.amount;
    });
    return Object.keys(grouped).map(catName => {
      const catObj = categories.find(c => c.name === catName);
      return { name: catName, value: parseFloat(grouped[catName].toFixed(2)), color: catObj?.color || '#3B82F6' };
    }).sort((a, b) => b.value - a.value);
  }, [filteredTxs, categories]);

  const catTransactions = (catName: string, subName?: string) =>
    filteredTxs.filter(t => t.type === 'expense' && t.category === catName && (subName ? t.subcategory === subName : true));

  // ---- 3.3 Scatter / peaks ----
  const scatterData = useMemo(() => {
    const expenses = filteredTxs.filter(t => t.type === 'expense');
    const mean = expenses.length ? expenses.reduce((s, t) => s + t.amount, 0) / expenses.length : 0;
    const variance = expenses.length
      ? expenses.reduce((s, t) => s + Math.pow(t.amount - mean, 2), 0) / expenses.length
      : 0;
    const stddev = Math.sqrt(variance);
    return expenses.map(t => ({
      day: new Date(t.date + 'T00:00:00').getDate(),
      amount: t.amount,
      isOutlier: t.amount > mean + 1.5 * stddev,
      name: t.notes || t.category
    }));
  }, [filteredTxs]);

  const outlierCount = scatterData.filter(s => s.isOutlier).length;

  // ---- 3.3 Trends between months ----
  const trends = useMemo(() => {
    const cur = activeTxs.filter(t => t.type === 'expense' && t.date.startsWith(filterMonth));
    const prev = activeTxs.filter(t => t.type === 'expense' && t.date.startsWith(prevMonth));
    const curByCat = new Map<string, number>();
    const prevByCat = new Map<string, number>();
    cur.forEach(t => curByCat.set(t.category, (curByCat.get(t.category) || 0) + t.amount));
    prev.forEach(t => prevByCat.set(t.category, (prevByCat.get(t.category) || 0) + t.amount));
    const cats = new Set([...curByCat.keys(), ...prevByCat.keys()]);
    return [...cats].map(cat => {
      const c = curByCat.get(cat) || 0;
      const p = prevByCat.get(cat) || 0;
      const delta = p > 0 ? ((c - p) / p) * 100 : (c > 0 ? 100 : 0);
      return { name: cat, current: c, previous: p, delta: Math.round(delta * 10) / 10 };
    }).sort((a, b) => b.delta - a.delta);
  }, [activeTxs, filterMonth, prevMonth]);

  // ---- 3.5 12-month comparison ----
  const monthlyAgg = useMemo(() => {
    const startYear = parseInt(year);
    const months: { key: string; label: string; Receitas: number; Despesas: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(startYear, i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: `${d.getMonth() + 1}/${d.getFullYear()}`, Receitas: 0, Despesas: 0 });
    }
    activeTxs.forEach(t => {
      const m = months.find(x => x.key === t.date.slice(0, 7));
      if (!m) return;
      if (t.type === 'income') m.Receitas += t.amount;
      else m.Despesas += t.amount;
    });
    months.forEach(m => { m.Receitas = Math.round(m.Receitas * 100) / 100; m.Despesas = Math.round(m.Despesas * 100) / 100; });
    return months;
  }, [activeTxs, year]);

  // ---- 3.5 Matrix: categories x months with red highlight above average ----
  const matrix = useMemo(() => {
    const months = monthlyAgg.map(m => m.key);
    const catNames = Array.from(new Set(activeTxs.filter(t => t.type === 'expense').map(t => t.category)));
    const totals = catNames.map(cat => {
      const perMonth = months.map(m => {
        return activeTxs.filter(t => t.type === 'expense' && t.category === cat && t.date.startsWith(m)).reduce((s, t) => s + t.amount, 0);
      });
      const avg = perMonth.reduce((s, v) => s + v, 0) / months.length;
      return { name: cat, perMonth, avg, color: categories.find(c => c.name === cat)?.color || '#6366F1' };
    });
    return { months, rows: totals };
  }, [activeTxs, monthlyAgg, categories]);

  // ---- 3.4 Cash flow projection (subscriptions + debts, 30/60/90) ----
  const projection = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const days: { day: string; Saldo: number; Despesas: number }[] = [];
    const items: { id: string; label: string; date: Date; amount: number }[] = [];

    subscriptions.forEach(s => {
      if (skippedItems.includes(s.id)) return;
      const bd = String(s.billingDate || '');
      const dayStr = bd && bd.length === 2 ? bd : (bd ? bd.split('-')[2] : '1');
      const day = parseInt(dayStr) || 1;
      for (let m = 0; m <= Math.ceil(horizonDays / 28); m++) {
        const d = new Date(now.getFullYear(), now.getMonth() + m, day);
        if (d < startToday) continue;
        items.push({ id: s.id, label: s.name, date: d, amount: s.amount });
      }
    });
    debts.forEach(d => {
      if (skippedItems.includes(d.id)) return;
      let due = new Date(d.nextDueDate + 'T00:00:00');
      while (due < startToday) due.setMonth(due.getMonth() + 1);
      if (d.paidInstallments < d.installmentsCount) {
        items.push({ id: d.id, label: d.name, date: due, amount: d.installmentAmount });
      }
    });

    let running = startBalance;
    for (let i = 0; i < horizonDays; i++) {
      const day = new Date(startToday);
      day.setDate(day.getDate() + i);
      const dayKey = day.toISOString().split('T')[0];
      const due = items.filter(it => it.date.toISOString().split('T')[0] === dayKey);
      const spent = due.reduce((s, it) => s + it.amount, 0);
      running -= spent;
      days.push({ day: day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), Saldo: Math.round(running * 100) / 100, Despesas: Math.round(spent * 100) / 100 });
    }
    const minBalance = days.reduce((m, d) => Math.min(m, d.Saldo), startBalance);
    return { days, minBalance };
  }, [accounts, subscriptions, debts, horizonDays, skippedItems]);

    // ---- Credit card report ----
  const cardTransactions = useMemo(
    () => activeTxs.filter(t => !t.deleted_at && !!t.creditCardId),
    [activeTxs]
  );
  const cardSpendByCategory = useMemo(() => {
    const grouped: { [name: string]: number } = {};
    cardTransactions.forEach(t => {
      grouped[t.category] = (grouped[t.category] || 0) + t.amount;
    });
    return Object.keys(grouped).map(name => {
      const catObj = categories.find(c => c.name === name);
      return { name, value: parseFloat(grouped[name].toFixed(2)), color: catObj?.color || '#6366F1' };
    }).sort((a, b) => b.value - a.value);
  }, [cardTransactions, categories]);

  const invoiceReport = useMemo(() => {
    return (invoices || [])
      .filter(inv => inv.status !== 'PAID')
      .map(inv => {
        const card = creditCards.find(c => c.id === inv.creditCardId);
        const txTotal = cardTransactions
          .filter(t => t.invoiceId === inv.id)
          .reduce((s, t) => s + t.amount, 0);
        return {
          id: inv.id,
          cardName: card?.name || 'Cartão',
          period: `${inv.month}/${inv.year}`,
          closingDate: inv.closingDate,
          dueDate: inv.dueDate,
          status: inv.status,
          totalAmount: inv.totalAmount,
          txTotal,
        };
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [invoices, creditCards, cardTransactions]);

  const cardTotal = cardSpendByCategory.reduce((s, c) => s + c.value, 0);

const handleExportData = () => {
    const reportMeta = { month: filterMonth, totalIncome, totalExpense, netBalance: totalIncome - totalExpense, transactionsCount: filteredTxs.length, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify({ meta: reportMeta, data: filteredTxs }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio-Financeiro-${filterMonth}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<any> }[] = [
    { key: 'rateio', label: 'Rateio & Drill-down', icon: PieIcon },
    { key: 'comparativo', label: 'Comparativo 12 Meses', icon: BarChart3 },
    { key: 'comportamento', label: 'Comportamento & Tendências', icon: Activity },
    { key: 'projecao', label: 'Projeção de Fluxo de Caixa', icon: LineIcon },
    { key: 'cartao', label: 'Cartão de Crédito', icon: CreditCard },
  ];

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden" id="reports-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Relatórios Financeiros Avançados</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Analise distribuições, comportamentos e projeções de fluxo de caixa</p>
        </div>
        <button
          onClick={handleExportData}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          id="export-report-btn"
        >
          <Download size={14} /> Exportar Relatório (JSON)
        </button>
      </div>

      {/* Filter Row */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
          <Filter size={15} className="text-indigo-600" />
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Configuração do Relatório</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Mês de Referência</label>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              id="report-filter-month"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Membro de Origem</label>
            <select
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              id="report-filter-member"
            >
              <option value="all">Todos os membros</option>
              {familyMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Conta Bancária / Carteira</label>
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              id="report-filter-account"
            >
              <option value="all">Todas as contas</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Ano (Comparativo)</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="report-kpis">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Receita Filtrada</span>
            <span className="text-xl font-display font-extrabold text-slate-900 mt-1 block">{formatMoney(totalIncome, isPrivateMode)}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp size={16} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Despesa Filtrada</span>
            <span className="text-xl font-display font-extrabold text-slate-900 mt-1 block">{formatMoney(totalExpense, isPrivateMode)}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingDown size={16} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Margem de Poupança</span>
            <span className="text-xl font-display font-extrabold text-slate-900 mt-1 block">{savingsRate.toFixed(1)}%</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BarChart3 size={16} />
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === t.key ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100/50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* 3.2 Rateio & Drill-down */}
      {activeTab === 'rateio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="report-rateio">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <PieIcon size={16} className="text-indigo-600" />
                <h3 className="text-sm font-display font-bold text-slate-900">Rateio de Gastos (%)</h3>
              </div>
              {pieData.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-semibold">Nenhuma despesa para exibir no gráfico de rateio.</div>
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        onClick={(d: any) => setExpandedCategory(d.name === expandedCategory ? null : d.name)}
                        cursor="pointer"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                        formatter={(value: number) => [isPrivateMode ? 'R$ ***' : `R$ ${value.toFixed(2)}`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-2">Clique em uma fatia para detalhar subcategorias e transações.</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-7">
            <h3 className="text-sm font-display font-bold text-slate-900 mb-4">
              {expandedCategory ? `Detalhamento — ${expandedCategory}` : 'Detalhamento por Categoria'}
            </h3>

            {!expandedCategory ? (
              <div className="divide-y divide-slate-100">
                {pieData.map(p => {
                  const txs = catTransactions(p.name);
                  const subs = subcategories.filter(s => txs.some(t => t.subcategory === s.name));
                  return (
                    <button
                      key={p.name}
                      onClick={() => setExpandedCategory(p.name)}
                      className="w-full py-3 flex items-center justify-between hover:bg-slate-50/50 rounded-lg px-2 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-md" style={{ backgroundColor: p.color }} />
                        <span className="text-xs font-bold text-slate-700">{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{txs.length} transações</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-800">{formatMoney(p.value, isPrivateMode)}</span>
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setExpandedCategory(null)}
                  className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  ← Voltar às categorias
                </button>
                {subcategories
                  .filter(s => catTransactions(expandedCategory).some(t => t.subcategory === s.name))
                  .map(sub => {
                    const isOpen = expandedSubcat === sub.name;
                    const txs = catTransactions(expandedCategory, sub.name);
                    const total = txs.reduce((s, t) => s + t.amount, 0);
                    return (
                      <div key={sub.id} className="border border-slate-100 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedSubcat(isOpen ? null : sub.name)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {isOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                            <span className="text-xs font-bold text-slate-700">{sub.name}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{txs.length} lançamentos</span>
                          </div>
                          <span className="text-xs font-extrabold text-slate-800">{formatMoney(total, isPrivateMode)}</span>
                        </button>
                        {isOpen && (
                          <div className="bg-slate-50/40 divide-y divide-slate-50">
                            {txs.map(t => (
                              <div key={t.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                                <div>
                                  <span className="font-semibold text-slate-700">{t.notes || t.category}</span>
                                  <span className="text-[9px] text-slate-400 block">{new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                </div>
                                <span className="font-extrabold text-slate-900">{formatMoney(t.amount, isPrivateMode)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                {!subcategories.some(s => catTransactions(expandedCategory).some(t => t.subcategory === s.name)) && (
                  <div className="text-[11px] text-slate-500 font-semibold">Sem subcategorias. Transações diretas da categoria:</div>
                )}
                <div className="divide-y divide-slate-50">
                  {catTransactions(expandedCategory).filter(t => !t.subcategory).slice(0, 8).map(t => (
                    <div key={t.id} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-700">{t.notes || t.category}</span>
                        <span className="text-[9px] text-slate-400 block">{new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                      <span className="font-extrabold text-slate-900">{formatMoney(t.amount, isPrivateMode)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3.5 Comparativo 12 meses */}
      {activeTab === 'comparativo' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-indigo-600" />
              <h3 className="text-sm font-display font-bold text-slate-900">Receitas vs Despesas — {year}</h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyAgg} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                    formatter={(value: number) => [isPrivateMode ? 'R$ ***' : `R$ ${value.toFixed(2)}`, '']}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
                  <Bar dataKey="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/15">
              <TableIcon size={16} className="text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Matriz Categoria × Mês (vermelho = acima da média histórica)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-50 text-left bg-slate-50/10">
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-50">Categoria</th>
                    {matrix.months.map(m => (
                      <th key={m} className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{m.slice(5)}/{m.slice(2, 4)}</th>
                    ))}
                    <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Média</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrix.rows.map(row => (
                    <tr key={row.name} className="hover:bg-slate-50/50">
                      <td className="px-6 py-2.5 text-xs font-bold text-slate-700 flex items-center gap-2 sticky left-0 bg-white">
                        <span className="w-2.5 h-2.5 rounded-md" style={{ backgroundColor: row.color }} /> {row.name}
                      </td>
                      {row.perMonth.map((v, i) => {
                        const above = row.avg > 0 && v > row.avg * 1.05;
                        return (
                          <td key={i} className={`px-3 py-2.5 text-[11px] font-semibold text-right whitespace-nowrap ${above ? 'text-rose-600 bg-rose-50 font-extrabold' : 'text-slate-600'}`}>
                            {isPrivateMode ? '***' : `R$ ${v.toFixed(0)}`}
                            {above && <span className="block text-[8px] font-bold uppercase">acima média</span>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-[11px] font-bold text-slate-500 text-right whitespace-nowrap">
                        {isPrivateMode ? '***' : `R$ ${row.avg.toFixed(0)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3.3 Comportamento & Tendências */}
      {activeTab === 'comportamento' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-7">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={16} className="text-indigo-600" />
              <h3 className="text-sm font-display font-bold text-slate-900">Dispersão de Gastos (Picos)</h3>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">Pontos vermelhos = compras atípicas acima de 1,5 desvio padrão da média ({outlierCount} encontrado{outlierCount === 1 ? '' : 's'}).</p>
            {scatterData.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">Sem gastos no período.</div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis type="number" dataKey="day" name="Dia" stroke="#94A3B8" fontSize={11} tickLine={false} label={{ value: 'Dia do mês', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#94A3B8' }} />
                    <YAxis type="number" dataKey="amount" name="Valor" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <ZAxis range={[40, 40]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                      formatter={(value: any, name: string) => [name === 'Valor' ? (isPrivateMode ? 'R$ ***' : `R$ ${value.toFixed(2)}`) : value, name]}
                    />
                    <Scatter name="Gastos" data={scatterData.map(s => ({ day: s.day, amount: s.amount }))} fill="#6366F1" />
                    <Scatter name="Picos atípicos" data={scatterData.filter(s => s.isOutlier).map(s => ({ day: s.day, amount: s.amount }))} fill="#EF4444" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-indigo-600" />
              <h3 className="text-sm font-display font-bold text-slate-900">Tendências ({filterMonth} vs {prevMonth})</h3>
            </div>
            {trends.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-semibold">Sem categorias para comparar.</div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {trends.map(t => (
                  <div key={t.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`p-1 rounded-md ${t.delta > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {t.delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      </span>
                      <span className="text-xs font-bold text-slate-700 truncate">{t.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-extrabold ${t.delta > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {t.delta > 0 ? '+' : ''}{t.delta.toFixed(1)}%
                      </span>
                      <span className="block text-[9px] text-slate-400 font-semibold">
                        {isPrivateMode ? '***' : `R$ ${t.current.toFixed(0)}`} (antes {isPrivateMode ? '***' : `R$ ${t.previous.toFixed(0)}`})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3.4 Projeção de Fluxo de Caixa */}
      {activeTab === 'projecao' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-3">
              <div className="flex items-center gap-2">
                <LineIcon size={16} className="text-indigo-600" />
                <h3 className="text-sm font-display font-bold text-slate-900">Projeção de Fluxo de Caixa</h3>
              </div>
              <div className="flex items-center gap-1.5">
                {([30, 60, 90] as const).map(h => (
                  <button
                    key={h}
                    onClick={() => setHorizonDays(h)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${horizonDays === h ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                  >
                    {h} dias
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Saldo atual <span className="font-bold text-slate-600">{formatMoney(accounts.reduce((s, a) => s + a.balance, 0), isPrivateMode)}</span> + receitas/despesas previstas (assinaturas e parcelas).
            </p>
            {projection.minBalance < 0 && (
              <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertTriangle size={14} /> Seu saldo pode ficar negativo em algum dia do horizonte (mínimo {formatMoney(projection.minBalance, isPrivateMode)}).
              </div>
            )}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projection.days} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="day" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                    formatter={(value: number, name) => [isPrivateMode ? 'R$ ***' : `R$ ${value.toFixed(2)}`, name]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
                  <Line type="monotone" dataKey="Saldo" stroke="#6366F1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-4">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal size={15} className="text-indigo-600" />
              <h3 className="text-sm font-display font-bold text-slate-900">Simulação de Cenários</h3>
            </div>
            <p className="text-[11px] text-slate-400 mb-4">Desative itens para simular "e se essa conta não for paga?" e veja o impacto no saldo projetado.</p>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {subscriptions.map(s => {
                const off = skippedItems.includes(s.id);
                return (
                  <label key={s.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${off ? 'opacity-50 border-slate-100 bg-slate-50' : 'border-slate-100 bg-white'}`}>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-700 block truncate">{s.name}</span>
                      <span className="text-[9px] text-slate-400 font-semibold capitalize">Assinatura {isPrivateMode ? '***' : `R$ ${s.amount.toFixed(2)}`}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!off}
                      onChange={() => setSkippedItems(prev => off ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                      className="accent-indigo-600 cursor-pointer"
                    />
                  </label>
                );
              })}
              {debts.map(d => {
                const off = skippedItems.includes(d.id);
                return (
                  <label key={d.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${off ? 'opacity-50 border-slate-100 bg-slate-50' : 'border-slate-100 bg-white'}`}>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-700 block truncate">{d.name}</span>
                      <span className="text-[9px] text-slate-400 font-semibold capitalize">Parcela {isPrivateMode ? '***' : `R$ ${d.installmentAmount.toFixed(2)}`}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!off}
                      onChange={() => setSkippedItems(prev => off ? prev.filter(id => id !== d.id) : [...prev, d.id])}
                      className="accent-indigo-600 cursor-pointer"
                    />
                  </label>
                );
              })}
              {subscriptions.length + debts.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">Nenhum item recorrente configurado.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3.6 Cartão de Crédito */}
      {activeTab === 'cartao' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="report-cartao">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-7">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard size={16} className="text-indigo-600" />
              <h3 className="text-sm font-display font-bold text-slate-900">Gastos no Cartão por Categoria</h3>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Total no cartão: <span className="font-bold text-slate-600">{formatMoney(cardTotal, isPrivateMode)}</span> — todas as faturas ativas (abertas, fechadas e em atraso).
            </p>
            {cardSpendByCategory.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">Nenhuma compra no cartão registrada.</div>
            ) : (
              <>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cardSpendByCategory} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                      <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <YAxis type="category" dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} width={90} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                        formatter={(value: number) => [isPrivateMode ? 'R$ ***' : `R$ ${value.toFixed(2)}`, '']}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                        {cardSpendByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-1.5">
                  {cardSpendByCategory.slice(0, 8).map(c => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-semibold text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                      <span className="font-bold text-slate-800">
                        {formatMoney(c.value, isPrivateMode)} <span className="text-[10px] text-slate-400 font-semibold">({cardTotal > 0 ? ((c.value / cardTotal) * 100).toFixed(1) : 0}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-5">
            <div className="flex items-center gap-2 mb-4">
              <PieIcon size={16} className="text-indigo-600" />
              <h3 className="text-sm font-display font-bold text-slate-900">Faturas Ativas</h3>
            </div>
            {invoiceReport.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-semibold">Nenhuma fatura ativa.</div>
            ) : (
              <div className="space-y-3">
                {invoiceReport.map(inv => (
                  <div key={inv.id} className={`rounded-xl border p-3.5 ${inv.status === 'OVERDUE' ? 'bg-rose-50 border-rose-100' : inv.status === 'CLOSED' ? 'bg-cyan-50 border-cyan-100' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 truncate">{inv.cardName} • {inv.period}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${inv.status === 'OVERDUE' ? 'bg-rose-100 text-rose-700' : inv.status === 'CLOSED' ? 'bg-cyan-100 text-cyan-700' : 'bg-amber-100 text-amber-700'}`}>
                        {invoiceStatusLabel[inv.status]}
                      </span>
                    </div>
                    <div className="mt-1.5 text-lg font-black text-slate-800">{formatMoney(inv.totalAmount, isPrivateMode)}</div>
                    <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                      <span>Venc. {new Date(inv.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      <span>Fech. {new Date(inv.closingDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="mt-1 text-[10px] font-semibold text-slate-400">
                      {formatMoney(inv.txTotal, isPrivateMode)} em lançamentos diretos
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}