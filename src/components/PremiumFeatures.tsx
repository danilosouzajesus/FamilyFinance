import React, { useMemo, useState } from 'react';
import { 
  Sparkles, 
  Calculator, 
  Activity, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Crown, 
  Target,
  ShieldAlert,
  HeartPulse,
  Gauge,
  PiggyBank,
  Flame
} from 'lucide-react';
import { FinancialState } from '../types';
import { currentMonthStr } from '../utils/format';

interface PremiumFeaturesProps {
  financialState: FinancialState;
}

export default function PremiumFeatures({ financialState }: PremiumFeaturesProps) {
  const { transactions, accounts, budgets, subscriptions, debts, goals } = financialState;

  // 7.2 Simulator State
  const [horizon, setHorizon] = useState<1 | 5 | 10>(5);
  const [yieldRate, setYieldRate] = useState(8.5);
  const [scenarios, setScenarios] = useState<Record<string, number>>({});

  // Categories list for simulator
  const categoriesList = useMemo(() =>
    Array.from(new Set(transactions.filter(t => t.type === 'expense').map(t => t.category))).filter(Boolean),
    [transactions]
  );

  const currentMonth = currentMonthStr();
  const monthOf = (d: string) => (d || '').slice(0, 7);

  // ---- 7.1 Financial Health Score (0-1000) ----
  const health = useMemo(() => {
    const curTxs = transactions.filter(t => !t.deleted_at && monthOf(t.date) === currentMonth);
    const income = curTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = curTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const margin = income > 0 ? ((income - expense) / income) * 100 : 0;

    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevExpense = transactions.filter(t => !t.deleted_at && monthOf(t.date) === prevMonth && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const trend = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0;

    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const curExpense = curTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const localReserveMonths = curExpense > 0 ? totalBalance / curExpense : 0;

    let score = 0;
    score += Math.max(0, Math.min(300, 300 + margin * 3));                     // savings margin up to 300
    score += prevExpense > 0 ? Math.max(0, 150 - trend * 3) : 100;             // trend penalty up to 150
    score += Math.min(200, (totalBalance > 0 ? 100 : 0) + Math.max(0, Math.min(100, localReserveMonths * 40))); // reserve up to 200

    const overrunCount = budgets.filter(b => {
      if (b.limit <= 0) return false;
      const spent = curTxs.filter(t => t.type === 'expense' && t.categoryId === b.categoryId).reduce((s, t) => s + t.amount, 0);
      return spent > b.limit;
    }).length;
    score -= overrunCount * 40;                                               // budget overruns

    const fixedPerMonth = (subscriptions || []).reduce((s, x) => s + x.amount, 0)
      + (debts || []).reduce((s, d) => s + d.installmentAmount, 0);
    const fixedRatio = income > 0 ? (fixedPerMonth / income) * 100 : 100;
    if (fixedRatio > 50) score -= 80;
    else if (fixedRatio > 35) score -= 40;

    score = Math.max(0, Math.min(1000, Math.round(score)));

    const category = score >= 800 ? 'Excelente' : score >= 600 ? 'Boa' : score >= 400 ? 'Regular' : 'Crítica';
    const categoryColor = score >= 800 ? 'text-emerald-600' : score >= 600 ? 'text-indigo-600' : score >= 400 ? 'text-amber-600' : 'text-rose-600';
    const categoryBg = score >= 800 ? 'bg-emerald-50 border-emerald-200' : score >= 600 ? 'bg-indigo-50 border-indigo-200' : score >= 400 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';

    const recommendations: string[] = [];
    if (margin < 10) recommendations.push('Aumente sua margem de poupança para pelo menos 10% da receita (regra "pague-se primeiro").');
    if (trend > 15) recommendations.push('Seus gastos subiram mais de 15% em relação ao mês anterior — revise as categorias que mais cresceram.');
    if (localReserveMonths < 3) recommendations.push('Construa uma reserva de emergência de 3 a 6 meses de despesas fixas.');
    if (overrunCount > 0) recommendations.push('Reduza ou revise os orçamentos das categorias que estouraram o teto.');
    if (fixedRatio > 35) recommendations.push('Suas despesas fixas consomem mais de 35% da receita — considere renegociar assinaturas ou dívidas.');
    if (recommendations.length === 0) recommendations.push('Continue mantendo o ritmo! Reavalie suas metas e considere investir o excedente.');

    return { score, category, categoryColor, categoryBg, margin, trend, fixedRatio, overrunCount, recommendations };
  }, [transactions, budgets, subscriptions, debts, currentMonth, accounts]);

  // ---- 7.3 Annual Heat Map ----
  const heatmap = useMemo(() => {
    const year = parseInt(currentMonth.slice(0, 4));
    const months: { key: string; label: string; total: number; avg: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(year, i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const total = transactions.filter(t => !t.deleted_at && t.type === 'expense' && monthOf(t.date) === key).reduce((s, t) => s + t.amount, 0);
      months.push({ key, label: d.toLocaleDateString('pt-BR', { month: 'short' }), total, avg: 0 });
    }
    const avg = months.reduce((s, m) => s + m.total, 0) / 12;
    months.forEach(m => (m.avg = avg));
    return { months, avg };
  }, [transactions, currentMonth]);

  const heatColor = (total: number, avg: number) => {
    if (avg <= 0) return 'bg-slate-100 text-slate-400';
    const ratio = total / avg;
    if (ratio < 0.8) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (ratio <= 1.0) return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    if (ratio <= 1.2) return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-rose-50 text-rose-700 border-rose-100';
  };

  // ---- 7.4 Risk Analysis ----
  const risk = useMemo(() => {
    const curTxs = transactions.filter(t => !t.deleted_at && monthOf(t.date) === currentMonth);
    const income = curTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const avgExpense = heatmap.avg || curTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const fixed = (subscriptions || []).reduce((s, x) => s + x.amount, 0)
      + (debts || []).reduce((s, d) => s + d.installmentAmount, 0);
    const fixedRatio = income > 0 ? (fixed / income) * 100 : 100;

    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const reserveMonthsVal = avgExpense > 0 ? totalBalance / avgExpense : 0;

    const remainingInstallments = (debts || []).reduce((s, d) => s + (d.installmentsCount - d.paidInstallments) * d.installmentAmount, 0);
    const totalInterest = (debts || []).reduce((s, d) => {
      const remaining = d.installmentsCount - d.paidInstallments;
      const principalPerInstallment = d.totalAmount / d.installmentsCount;
      const interestPerInstallment = d.installmentAmount - principalPerInstallment;
      return s + Math.max(0, remaining * interestPerInstallment);
    }, 0);

    return { fixed, fixedRatio, reserveMonthsVal, remainingInstallments, totalInterest, totalBalance };
  }, [transactions, subscriptions, debts, accounts, currentMonth, heatmap.avg]);

  // ---- 7.2 Multi-category Scenario Simulator ----
  const simulated = useMemo(() => {
    const baseMonthlyExpense = transactions
      .filter(t => !t.deleted_at && monthOf(t.date) === currentMonth && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const totalReductionPct = Object.values(scenarios).reduce((s, v) => s + v, 0);
    const effectivePct = Math.min(totalReductionPct, 80);
    const monthlySaving = baseMonthlyExpense * (effectivePct / 100);
    const periods = horizon * 12;
    const r = yieldRate / 100 / 12;
    const futureValue = r > 0
      ? monthlySaving * ((Math.pow(1 + r, periods) - 1) / r)
      : monthlySaving * periods;
    const totalContributed = monthlySaving * periods;
    const earnedInterest = futureValue - totalContributed;
    return { baseMonthlyExpense, monthlySaving, futureValue, totalContributed, earnedInterest, effectivePct };
  }, [transactions, scenarios, horizon, yieldRate, currentMonth]);

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden" id="premium-features-container">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 rounded-2xl shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-2">
            <Crown size={12} /> Recursos PRO Exclusivos
          </div>
          <h1 className="text-2xl font-display font-extrabold tracking-tight">Ferramentas de Inteligência Premium</h1>
          <p className="text-indigo-200 text-xs mt-1 max-w-xl">
            Score de saúde financeira, simulações de cenários, mapa de calor anual e análise de risco automatizada para a família.
          </p>
        </div>
      </div>

      {/* 7.1 Health Score + 7.4 Risk Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Financial Health Score (0-1000) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <HeartPulse size={18} className="text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Score de Saúde Financeira</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E2E8F0" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={health.score >= 800 ? '#10B981' : health.score >= 600 ? '#6366F1' : health.score >= 400 ? '#F59E0B' : '#EF4444'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(health.score / 1000) * 264} 264`}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Gauge size={18} className="text-slate-300" />
                <span className="text-xl font-display font-extrabold text-slate-900">{health.score}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase">/ 1000</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase border ${health.categoryBg} ${health.categoryColor}`}>
                {health.category}
              </span>
              <div className="text-[11px] text-slate-500 space-y-0.5 font-medium">
                <p className="flex items-center gap-1"><Activity size={11} className="text-indigo-500" /> Margem: {health.margin.toFixed(1)}%</p>
                <p className="flex items-center gap-1"><TrendingUp size={11} className={health.trend > 0 ? 'text-rose-500' : 'text-emerald-500'} /> Tendência: {health.trend > 0 ? '+' : ''}{health.trend.toFixed(1)}%</p>
                <p className="flex items-center gap-1"><PiggyBank size={11} className="text-amber-500" /> Reserva: {risk.reserveMonthsVal.toFixed(1)} meses</p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={11} className="text-amber-500" /> Recomendações Prioritárias
            </span>
            <ul className="space-y-1">
              {health.recommendations.slice(0, 4).map((rec, i) => (
                <li key={i} className="text-[11px] text-slate-600 leading-snug flex items-start gap-1.5">
                  <span className="text-indigo-500 font-bold mt-0.5 shrink-0">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 7.4 Risk Analysis */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldAlert size={18} className="text-rose-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Análise de Risco Financeiro</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Custos Fixos/Mês</span>
              <span className="font-extrabold text-slate-800 text-xs">R$ {risk.fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Comprometimento</span>
              <span className={`font-extrabold text-xs ${risk.fixedRatio > 50 ? 'text-rose-600' : risk.fixedRatio > 35 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {risk.fixedRatio.toFixed(1)}%
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Reserva de Emergência</span>
              <span className={`font-extrabold text-xs ${risk.reserveMonthsVal < 3 ? 'text-rose-600' : risk.reserveMonthsVal < 6 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {risk.reserveMonthsVal.toFixed(1)} meses
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Saldo Total</span>
              <span className="font-extrabold text-slate-800 text-xs">R$ {risk.totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Comprometimento de renda com despesas fixas</span>
              <span className="font-extrabold text-slate-800">{risk.fixedRatio.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${risk.fixedRatio > 50 ? 'bg-rose-500' : risk.fixedRatio > 35 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(risk.fixedRatio, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {risk.fixedRatio > 50
                ? 'Risco alto: mais da metade da renda é comprometida com contas fixas. Renegocie assinaturas e dívidas.'
                : risk.fixedRatio > 35
                ? 'Risco moderado: uma parcela significativa da renda é fixa. Avalie reduzir assinaturas não essenciais.'
                : 'Risco baixo: suas contas fixas consomem uma fatia saudável da renda.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/50 text-[11px] text-amber-800 space-y-1">
              <p className="font-extrabold uppercase tracking-wider text-[9px] flex items-center gap-1"><Flame size={11} /> Restante de Dívidas</p>
              <p className="font-bold text-sm">R$ {risk.remainingInstallments.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] opacity-80">Juros estimados ainda a pagar: R$ {risk.totalInterest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 text-[11px] text-indigo-800 space-y-1">
              <p className="font-extrabold uppercase tracking-wider text-[9px] flex items-center gap-1"><Target size={11} /> Metas em andamento</p>
              <p className="font-bold text-sm">
                {goals.filter(g => g.currentAmount < g.targetAmount).length} de {goals.length} ativas
              </p>
              <p className="text-[10px] opacity-80">Total acumulado: R$ {goals.reduce((s, g) => s + g.currentAmount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 7.2 Scenario Simulator */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Simulador de Cenários Multi-Categoria</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {([1, 5, 10] as const).map(h => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${horizon === h ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                {h} ano{h > 1 ? 's' : ''}
              </button>
            ))}
            <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase">Rentab. %/ano</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={yieldRate}
              onChange={(e) => setYieldRate(Number(e.target.value))}
              className="w-16 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Selecione reduções de gasto por categoria e veja o impacto projetado com juros compostos ({yieldRate}% a.a.).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {categoriesList.slice(0, 6).map(cat => (
              <div key={cat} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-xs font-bold text-slate-700 truncate">{cat}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="5"
                    value={scenarios[cat] || 0}
                    onChange={(e) => setScenarios(prev => ({ ...prev, [cat]: Number(e.target.value) }))}
                    className="w-28 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-[11px] font-extrabold text-indigo-600 w-9 text-right">{scenarios[cat] || 0}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Redução combinada aplicada:</span>
                <span className="font-extrabold text-indigo-700">{simulated.effectivePct.toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Economia mensal projetada:</span>
                <span className="font-extrabold text-emerald-600">R$ {simulated.monthlySaving.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-indigo-100">
                <span className="text-indigo-900 font-bold flex items-center gap-1">
                  <Zap size={14} className="text-amber-500" /> Projeção em {horizon} ano{horizon > 1 ? 's' : ''}:
                </span>
                <span className="font-extrabold text-indigo-700 text-sm">
                  R$ {simulated.futureValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[10px] text-indigo-600 font-medium">
                Aportes de {simulated.totalContributed.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} + juros de {simulated.earnedInterest.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} (compostos mensalmente).
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-500 space-y-1">
              <p className="font-extrabold text-slate-600 uppercase tracking-wider text-[9px]">Sobre a simulação</p>
              <p className="leading-snug">A projeção assume que a economia mensal é reinvestida ao final de cada mês com a taxa informada. Ajuste os controles acima para comparar cenários agressivos e conservadores.</p>
            </div>
          </div>
        </div>
      </div>

      {/* 7.3 Annual Heat Map */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Calendar size={18} className="text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Mapa de Calor Anual de Gastos</h2>
          <span className="text-[11px] font-bold text-slate-400 ml-auto hidden sm:block">Vermelho = acima da média anual</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {heatmap.months.map(m => {
            const ratio = m.avg > 0 ? m.total / m.avg : 1;
            return (
              <div key={m.key} className={`p-3 rounded-xl border text-center space-y-1 ${heatColor(m.total, m.avg)}`}>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block">{m.label}</span>
                <span className="text-xs font-display font-extrabold block">R$ {m.total.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                <span className="text-[9px] font-bold block opacity-70">
                  {m.avg > 0 ? `${(ratio * 100).toFixed(0)}%` : 'sem dados'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-semibold pt-1">
          <span className="text-slate-400 uppercase font-bold tracking-wider mr-1">Legenda:</span>
          <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700">&lt; 80% da média</span>
          <span className="px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700">80–100%</span>
          <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-700">100–120%</span>
          <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-100 text-rose-700">&gt; 120%</span>
        </div>
      </div>
    </div>
  );
}