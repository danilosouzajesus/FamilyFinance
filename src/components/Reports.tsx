import React, { useState } from 'react';
import { 
  BarChart3, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieIcon, 
  Filter, 
  Download,
  Table as TableIcon
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
  CartesianGrid 
} from 'recharts';
import { Transaction, Category, Account, FamilyMember } from '../types';

interface ReportsProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  familyMembers: FamilyMember[];
}

export default function Reports({
  transactions,
  categories,
  accounts,
  familyMembers
}: ReportsProps) {
  // Filter states
  const [filterMonth, setFilterMonth] = useState('2026-08');
  const [filterMember, setFilterMember] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');

  // Filter transactions
  const filteredTxs = transactions.filter(t => {
    const matchesMonth = t.date.startsWith(filterMonth);
    const matchesMember = filterMember === 'all' || t.memberId === filterMember;
    const matchesAccount = filterAccount === 'all' || t.accountId === filterAccount;
    return matchesMonth && matchesMember && matchesAccount;
  });

  // Calculate high-level stats
  const totalIncome = filteredTxs
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = filteredTxs
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  // Pie Chart Data (Expenses by Category)
  const getPieChartData = () => {
    const grouped: { [name: string]: number } = {};
    filteredTxs
      .filter(t => t.type === 'expense')
      .forEach(t => {
        grouped[t.category] = (grouped[t.category] || 0) + t.amount;
      });

    return Object.keys(grouped).map(catName => {
      const catObj = categories.find(c => c.name === catName);
      return {
        name: catName,
        value: parseFloat(grouped[catName].toFixed(2)),
        color: catObj?.color || '#3B82F6'
      };
    }).sort((a, b) => b.value - a.value);
  };

  const pieData = getPieChartData();

  // Bar Chart Data (Inflow vs. Outflow comparison over weeks)
  const getComparisonData = () => {
    // Let's divide the month into 4 weeks
    const weeksMap = {
      'Semana 1': { income: 0, expense: 0 },
      'Semana 2': { income: 0, expense: 0 },
      'Semana 3': { income: 0, expense: 0 },
      'Semana 4': { income: 0, expense: 0 },
    };

    filteredTxs.forEach(t => {
      const day = new Date(t.date).getDate();
      let weekKey: keyof typeof weeksMap = 'Semana 4';
      if (day <= 7) weekKey = 'Semana 1';
      else if (day <= 14) weekKey = 'Semana 2';
      else if (day <= 21) weekKey = 'Semana 3';

      if (t.type === 'income') {
        weeksMap[weekKey].income += t.amount;
      } else {
        weeksMap[weekKey].expense += t.amount;
      }
    });

    return Object.keys(weeksMap).map(weekName => ({
      name: weekName,
      Receitas: parseFloat(weeksMap[weekName as keyof typeof weeksMap].income.toFixed(2)),
      Despesas: parseFloat(weeksMap[weekName as keyof typeof weeksMap].expense.toFixed(2))
    }));
  };

  const comparisonData = getComparisonData();

  // Export current report as simulated JSON/CSV
  const handleExportData = () => {
    const reportMeta = {
      month: filterMonth,
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      transactionsCount: filteredTxs.length,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify({ meta: reportMeta, data: filteredTxs }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio-Financeiro-${filterMonth}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden" id="reports-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Relatórios Financeiros Avançados</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Analise distribuições de despesas e compare fluxos consolidados</p>
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Month */}
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

          {/* Member */}
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

          {/* Account */}
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
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="report-kpis">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Receita Filtrada</span>
            <span className="text-xl font-display font-extrabold text-slate-900 mt-1 block">R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp size={16} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Despesa Filtrada</span>
            <span className="text-xl font-display font-extrabold text-slate-900 mt-1 block">R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="report-charts">
        {/* Weekly comparison Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-7">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-indigo-600" />
            <h3 className="text-sm font-display font-bold text-slate-900">Fluxos de Caixa Semanais</h3>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, '']}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
                <Bar dataKey="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses distribution Pie Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <PieIcon size={16} className="text-indigo-600" />
              <h3 className="text-sm font-display font-bold text-slate-900">Rateio de Gastos (%)</h3>
            </div>

            {pieData.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                Nenhuma despesa para exibir no gráfico de rateio.
              </div>
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {pieData.slice(0, 4).map((entry, index) => (
              <div key={index} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-slate-600 font-medium truncate max-w-[120px]">{entry.name}</span>
                </div>
                <span className="font-bold text-slate-700">R$ {entry.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabular Analysis view */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden" id="report-table">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/15">
          <TableIcon size={16} className="text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detalhamento Consolidado por Categoria</h3>
        </div>

        {pieData.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">Sem dados consolidados para o período filtrado.</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-50 text-left bg-slate-50/10">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transações</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor Acumulado</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Representação (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pieData.map((p, i) => {
                const txsCount = filteredTxs.filter(t => t.category === p.name).length;
                const pctOfExpense = totalExpense > 0 ? (p.value / totalExpense) * 100 : 0;
                
                return (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5 text-xs font-bold text-slate-700 flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500 font-semibold">{txsCount} registros</td>
                    <td className="px-6 py-3.5 text-xs font-extrabold text-slate-800">R$ {p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-3.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-600 w-10 text-right">{pctOfExpense.toFixed(1)}%</span>
                        {/* Small mini-progress-bar */}
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pctOfExpense}%`, backgroundColor: p.color }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
