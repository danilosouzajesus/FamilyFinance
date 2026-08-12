import React, { useState } from 'react';
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
  ArrowRight,
  ShieldAlert,
  Sparkle
} from 'lucide-react';
import { FinancialState } from '../types';

interface PremiumFeaturesProps {
  financialState: FinancialState;
}

export default function PremiumFeatures({ financialState }: PremiumFeaturesProps) {
  // Simulator State
  const [simulatorCategory, setSimulatorCategory] = useState('Alimentação');
  const [simulatorReduction, setSimulatorReduction] = useState(20);

  // Annual Target State
  const [annualTarget, setAnnualTarget] = useState(30000);

  // Categories list for simulator
  const categoriesList = Array.from(
    new Set(financialState.transactions.map(t => t.category))
  ).filter(Boolean);

  if (!categoriesList.includes('Alimentação')) {
    categoriesList.unshift('Alimentação');
  }

  // Simulator Calculations
  const selectedCatTxs = financialState.transactions.filter(
    t => t.category.toLowerCase() === simulatorCategory.toLowerCase() && t.type === 'expense'
  );
  const totalCatExpense = selectedCatTxs.reduce((sum, t) => sum + t.amount, 0);
  const simulatedSavings = totalCatExpense * (simulatorReduction / 100);

  // Financial Risk & Health Calculation
  const totalIncome = financialState.transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = financialState.transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const debtRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
  const savingsMargin = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
  
  let riskLevel: 'Baixo' | 'Moderado' | 'Alto' = 'Baixo';
  let riskColor = 'text-emerald-600 bg-emerald-50 border-emerald-200';
  let riskMessage = 'Sua saúde financeira está excelente! Suas despesas estão abaixo de 70% das suas receitas.';

  if (debtRatio > 90) {
    riskLevel = 'Alto';
    riskColor = 'text-rose-600 bg-rose-50 border-rose-200';
    riskMessage = 'Atenção! Suas despesas ultrapassam 90% dos seus rendimentos. Recomendamos cortar custos não essenciais.';
  } else if (debtRatio > 75) {
    riskLevel = 'Moderado';
    riskColor = 'text-amber-600 bg-amber-50 border-amber-200';
    riskMessage = 'Alerta moderado. Suas despesas representam entre 75% e 90% da sua receita.';
  }

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
            Simulações financeiras avançadas, projeções anuais de metas e diagnósticos automatizados de saúde financeira para a família.
          </p>
        </div>
      </div>

      {/* Grid 1: Simulator & Financial Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Cost Reduction Simulator */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4 flex flex-col justify-between lg:col-span-2">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calculator size={18} className="text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Simulador de Economia por Categoria
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Descubra quanto sua família pode economizar ao cortar porcentagens de despesas em categorias específicas.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold uppercase">Categoria para Análise</label>
                <select
                  value={simulatorCategory}
                  onChange={(e) => setSimulatorCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold text-slate-800"
                >
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold uppercase">Meta de Redução (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={simulatorReduction}
                    onChange={(e) => setSimulatorReduction(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs font-extrabold text-indigo-600 w-10 text-right">{simulatorReduction}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2 mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Gasto Atual em {simulatorCategory}:</span>
              <span className="font-bold text-slate-800">R$ {totalCatExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-indigo-100">
              <span className="text-indigo-900 font-bold flex items-center gap-1">
                <Zap size={14} className="text-amber-500" /> Economia Projetada:
              </span>
              <span className="font-extrabold text-indigo-700 text-sm">
                R$ {simulatedSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /mês
              </span>
            </div>
            <p className="text-[10px] text-indigo-600 font-medium">
              Equivale a R$ {(simulatedSavings * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} salvos ao ano!
            </p>
          </div>
        </div>

        {/* Financial Risk & Health Assessment */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Activity size={18} className="text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Diagnóstico de Saúde
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Análise em tempo real do comprometimento de renda familiar e nível de exposição.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Receita Total</span>
                <span className="font-extrabold text-emerald-600 text-xs">R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Comprometimento</span>
                <span className="font-extrabold text-slate-800 text-xs">{debtRatio.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-xl border ${riskColor} space-y-1 mt-4`}>
            <div className="flex items-center justify-between font-bold text-xs">
              <span className="flex items-center gap-1.5">
                <ShieldAlert size={15} /> Nível de Risco:
              </span>
              <span className="uppercase text-[11px] px-2 py-0.5 rounded-md bg-white/80 font-extrabold">{riskLevel}</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90 mt-1">
              {riskMessage}
            </p>
          </div>
        </div>

      </div>

      {/* Grid 2: Annual Target Planning */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Planejamento de Metas Financeiras Anuais
            </h2>
          </div>
          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">Projeção 12 Meses</span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Defina seu objetivo financeiro acumulado para os próximos 12 meses e veja o aporte mensal exato necessário.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="space-y-1">
            <label className="block text-[10px] text-slate-400 font-bold uppercase">Meta Anual Desejada (R$)</label>
            <input
              type="number"
              value={annualTarget}
              onChange={(e) => setAnnualTarget(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-xs">
            <span className="text-slate-500 text-[10px] font-bold uppercase block">Aporte Mensal Necessário</span>
            <span className="text-lg font-extrabold text-indigo-600">
              R$ {(annualTarget / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /mês
            </span>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1 text-xs">
            <span className="text-emerald-700 text-[10px] font-bold uppercase block">Meta Diária Aprox.</span>
            <span className="text-lg font-extrabold text-emerald-600">
              R$ {(annualTarget / 365).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /dia
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
