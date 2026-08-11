import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  PiggyBank, 
  AlertTriangle,
  Calendar,
  CheckCircle,
  HelpCircle,
  Clock
} from 'lucide-react';
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
  Cell 
} from 'recharts';
import { Transaction, Account, Budget, Goal, Category } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  categories: Category[];
  setActiveView: (view: string) => void;
}

export default function Dashboard({ 
  transactions, 
  accounts, 
  budgets, 
  goals, 
  categories,
  setActiveView 
}: DashboardProps) {

  // Current Month calculation (for simulation e.g. "2026-08")
  const currentMonthStr = "2026-08";

  // Filter current month transactions
  const currentMonthTransactions = transactions.filter(t => t.date.startsWith(currentMonthStr));

  // Compute stats
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  const monthIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthExpense = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSavedInGoals = goals.reduce((sum, g) => sum + g.currentAmount, 0);

  // Compute Recharts Area Chart Data (Daily Cumulative Income and Expenses)
  // Let's list days 1 to 28 for simulation
  const getChartData = () => {
    const dailyDataMap: { [day: number]: { income: number; expense: number } } = {};
    for (let i = 1; i <= 28; i++) {
      dailyDataMap[i] = { income: 0, expense: 0 };
    }

    // Populate day values
    currentMonthTransactions.forEach(t => {
      const day = new Date(t.date).getDate();
      if (day >= 1 && day <= 28) {
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
    
    // Group expenses
    transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(currentMonthStr))
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

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* Welcome Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">Olá, Família! 👋</h1>
          <p className="text-slate-500 text-xs mt-0.5">Aqui está o balanço das finanças familiares para agosto de 2026.</p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200/50 text-slate-600 text-xs font-semibold">
            <Calendar size={14} className="text-indigo-600" /> Agosto/2026
          </span>
          <button 
            onClick={() => setActiveView('ai-advisor')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
            id="dash-consult-ia-btn"
          >
            Consultar IA ✨
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-kpi-grid">
        {/* Total Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Patrimônio Líquido</span>
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-indigo-600 flex items-center justify-center border border-slate-200/50">
              <Wallet size={18} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className={`text-2xl font-display font-extrabold tracking-tight ${totalBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">Soma de todas as contas cadastradas</p>
          </div>
        </div>

        {/* Month Income */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Receitas do Mês</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/50">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-display font-extrabold tracking-tight text-slate-900">
              R$ {monthIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">Total creditado em agosto</p>
          </div>
        </div>

        {/* Month Expense */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Despesas do Mês</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100/50">
              <ArrowDownRight size={18} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-display font-extrabold tracking-tight text-slate-900">
              R$ {monthExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">Débitos e compras em agosto</p>
          </div>
        </div>

        {/* Total Goal Savings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reserva de Metas</span>
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100/50">
              <PiggyBank size={18} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-display font-extrabold tracking-tight text-slate-900">
              R$ {totalSavedInGoals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">Montante total guardado em metas</p>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-charts-grid">
        {/* Area Evolution Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-display font-bold text-slate-900">Fluxo de Caixa Acumulado</h2>
              <p className="text-xs text-slate-400">Relação diária de receitas acumuladas e despesas</p>
            </div>
          </div>
          <div className="h-72 w-full">
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

        {/* Expenses by Category Column */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-4 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-display font-bold text-slate-900 mb-1">Despesas por Categoria</h2>
            <p className="text-xs text-slate-400 mb-4">Maiores ralos financeiros de agosto</p>
            
            {barChartData.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                Nenhuma despesa registrada este mês.
              </div>
            ) : (
              <div className="h-44 w-full">
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
          </div>

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
      </div>

      {/* Budgets Tracking and Goals progress Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="dashboard-budgets-goals-row">
        {/* Budgets warnings */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-display font-bold text-slate-900">Alinhamento do Orçamento</h2>
              <p className="text-xs text-slate-400">Acompanhamento dos tetos de gastos ativos</p>
            </div>
            <button 
              onClick={() => setActiveView('budgets')}
              className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
              id="dash-ver-orcamentos-btn"
            >
              Ver Detalhes
            </button>
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
                    {/* Progress Bar Container */}
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

        {/* Goals Progress */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-display font-bold text-slate-900">Metas Financeiras</h2>
              <p className="text-xs text-slate-400">Progresso de realização dos sonhos</p>
            </div>
            <button 
              onClick={() => setActiveView('goals')}
              className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
              id="dash-ver-metas-btn"
            >
              Ver Detalhes
            </button>
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
                    {/* Progress Bar Container */}
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
      </div>

      {/* Bottom section: Recent Transactions & Account quick look */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-recent-row">
        {/* Recent Transactions List */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-display font-bold text-slate-900">Últimas Transações</h2>
                <p className="text-xs text-slate-400">Atividades financeiras registradas recentemente</p>
              </div>
              <button 
                onClick={() => setActiveView('transactions')}
                className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                id="dash-ver-transacoes-btn"
              >
                Gerenciar Transações
              </button>
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
        </div>

        {/* Accounts breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-4 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-display font-bold text-slate-900 mb-1">Contas e Saldos</h2>
            <p className="text-xs text-slate-400 mb-4">Sua liquidez em carteira e cartões</p>

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
        </div>
      </div>
    </div>
  );
}
