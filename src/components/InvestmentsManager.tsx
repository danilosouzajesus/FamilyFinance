import React, { useState } from 'react';
import { 
  PiggyBank, 
  TrendingUp, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  TrendingDown, 
  Percent, 
  Calendar,
  CheckCircle,
  HelpCircle,
  DollarSign
} from 'lucide-react';
import { Investment, Debt, Category } from '../types';

interface InvestmentsManagerProps {
  investments: Investment[];
  debts: Debt[];
  categories: Category[];
  onAddInvestment: (inv: Omit<Investment, 'id'>) => void;
  onEditInvestment: (id: string, updated: Partial<Investment>) => void;
  onDeleteInvestment: (id: string) => void;
  onAddDebt: (debt: Omit<Debt, 'id'>) => void;
  onEditDebt: (id: string, updated: Partial<Debt>) => void;
  onDeleteDebt: (id: string) => void;
}

export default function InvestmentsManager({
  investments,
  debts,
  categories,
  onAddInvestment,
  onEditInvestment,
  onDeleteInvestment,
  onAddDebt,
  onEditDebt,
  onDeleteDebt
}: InvestmentsManagerProps) {
  const [activeTab, setActiveTab] = useState<'invs' | 'debts'>('invs');

  // Investment form states
  const [isInvFormOpen, setIsInvFormOpen] = useState(false);
  const [editingInv, setEditingInv] = useState<Investment | null>(null);
  const [invType, setInvType] = useState('Renda Fixa');
  const [invName, setInvName] = useState('');
  const [invInitial, setInvInitial] = useState('');
  const [invCurrent, setInvCurrent] = useState('');
  const [invYield, setInvYield] = useState('');
  const [invStart, setInvStart] = useState(new Date().toISOString().split('T')[0]);
  const [invContribs, setInvContribs] = useState('1');

  // Debt form states
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtName, setDebtName] = useState('');
  const [debtTotal, setDebtTotal] = useState('');
  const [debtInstallments, setDebtInstallments] = useState('12');
  const [debtInstallmentAmount, setDebtInstallmentAmount] = useState('');
  const [debtInterest, setDebtInterest] = useState('1.5');
  const [debtNextDue, setDebtNextDue] = useState(new Date().toISOString().split('T')[0]);
  const [debtCat, setDebtCat] = useState('Moradia');
  const [debtPaid, setDebtPaid] = useState('0');

  // Fast contribution deposit state
  const [contribInvId, setContribInvId] = useState<string | null>(null);
  const [contribAmount, setContribAmount] = useState('');

  // Helpers
  const investmentTypes = ['Renda Fixa', 'Ações', 'Fundos Multimercado', 'Previdência Privada', 'Criptoativos', 'Outros'];

  // Submit investment form
  const handleInvSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName.trim() || !invInitial || !invCurrent) return;

    const initial = parseFloat(invInitial);
    const current = parseFloat(invCurrent);
    const yieldRate = parseFloat(invYield) || 0;
    const contribCount = parseInt(invContribs) || 1;

    if (isNaN(initial) || initial <= 0 || isNaN(current) || current < 0) {
      alert('Valores incorretos inseridos.');
      return;
    }

    const payload = {
      type: invType,
      name: invName.trim(),
      initialAmount: initial,
      currentAmount: current,
      startDate: invStart,
      simpleYield: yieldRate,
      contributionsCount: contribCount
    };

    if (editingInv) {
      onEditInvestment(editingInv.id, payload);
    } else {
      onAddInvestment(payload);
    }
    setIsInvFormOpen(false);
  };

  // Submit rapid contribution
  const handleRapidContribSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribInvId || !contribAmount) return;
    const amount = parseFloat(contribAmount);
    if (isNaN(amount) || amount <= 0) return;

    const target = investments.find(i => i.id === contribInvId);
    if (target) {
      onEditInvestment(contribInvId, {
        currentAmount: target.currentAmount + amount,
        contributionsCount: target.contributionsCount + 1
      });
    }
    setContribInvId(null);
    setContribAmount('');
  };

  // Submit debt form
  const handleDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtName.trim() || !debtTotal || !debtInstallmentAmount) return;

    const total = parseFloat(debtTotal);
    const instCount = parseInt(debtInstallments);
    const instAmount = parseFloat(debtInstallmentAmount);
    const interest = parseFloat(debtInterest) || 0;
    const paid = parseInt(debtPaid) || 0;

    if (isNaN(total) || total <= 0 || isNaN(instAmount) || instAmount <= 0) {
      alert('Insira valores numéricos válidos maiores que zero.');
      return;
    }

    const payload = {
      name: debtName.trim(),
      totalAmount: total,
      installmentsCount: instCount,
      installmentAmount: instAmount,
      interestRate: interest,
      nextDueDate: debtNextDue,
      category: debtCat,
      paidInstallments: paid
    };

    if (editingDebt) {
      onEditDebt(editingDebt.id, payload);
    } else {
      onAddDebt(payload);
    }
    setIsDebtFormOpen(false);
  };

  const handleOpenInvAdd = () => {
    setEditingInv(null);
    setInvType('Renda Fixa');
    setInvName('');
    setInvInitial('');
    setInvCurrent('');
    setInvYield('11.25');
    setInvStart(new Date().toISOString().split('T')[0]);
    setInvContribs('1');
    setIsInvFormOpen(true);
  };

  const handleOpenInvEdit = (inv: Investment) => {
    setEditingInv(inv);
    setInvType(inv.type);
    setInvName(inv.name);
    setInvInitial(inv.initialAmount.toString());
    setInvCurrent(inv.currentAmount.toString());
    setInvYield(inv.simpleYield.toString());
    setInvStart(inv.startDate);
    setInvContribs(inv.contributionsCount.toString());
    setIsInvFormOpen(true);
  };

  const handleOpenDebtAdd = () => {
    setEditingDebt(null);
    setDebtName('');
    setDebtTotal('');
    setDebtInstallments('12');
    setDebtInstallmentAmount('');
    setDebtInterest('1.5');
    setDebtNextDue(new Date().toISOString().split('T')[0]);
    setDebtCat('Moradia');
    setDebtPaid('0');
    setIsDebtFormOpen(true);
  };

  const handleOpenDebtEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setDebtName(debt.name);
    setDebtTotal(debt.totalAmount.toString());
    setDebtInstallments(debt.installmentsCount.toString());
    setDebtInstallmentAmount(debt.installmentAmount.toString());
    setDebtInterest(debt.interestRate.toString());
    setDebtNextDue(debt.nextDueDate);
    setDebtCat(debt.category);
    setDebtPaid(debt.paidInstallments.toString());
    setIsDebtFormOpen(true);
  };

  // KPI Calculations
  const totalInvs = investments.reduce((sum, i) => sum + i.currentAmount, 0);
  const totalInvsProfit = investments.reduce((sum, i) => sum + (i.currentAmount - i.initialAmount), 0);
  const totalDebts = debts.reduce((sum, d) => sum + (d.totalAmount - (d.paidInstallments * d.installmentAmount)), 0);

  return (
    <div className="space-y-6" id="investments-manager-container">
      
      {/* Tab Select Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('invs')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'invs' 
                ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Poupança & Investimentos
          </button>
          <button
            onClick={() => setActiveTab('debts')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'debts' 
                ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Controle de Dívidas & Financiamentos
          </button>
        </div>

        <button
          onClick={activeTab === 'invs' ? handleOpenInvAdd : handleOpenDebtAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
        >
          <Plus size={16} /> 
          {activeTab === 'invs' ? 'Novo Investimento' : 'Registrar Dívida'}
        </button>
      </div>

      {/* KPI Dashboard Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="inv-kpis">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Total em Poupança / Investimentos</span>
            <span className="text-xl font-display font-extrabold text-indigo-600 mt-1 block">R$ {totalInvs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <PiggyBank size={16} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Rendimento Estimado Acumulado</span>
            <span className={`text-xl font-display font-extrabold mt-1 block ${totalInvsProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              R$ {totalInvsProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${totalInvsProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <TrendingUp size={16} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Saldo devedor total</span>
            <span className="text-xl font-display font-extrabold text-rose-600 mt-1 block">R$ {totalDebts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <TrendingDown size={16} />
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      {activeTab === 'invs' ? (
        /* Poupança e Investimentos list */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="investments-grid">
          {investments.map((inv) => {
            const profit = inv.currentAmount - inv.initialAmount;
            return (
              <div 
                key={inv.id} 
                className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[8px] font-bold text-indigo-600 uppercase tracking-wider">{inv.type}</span>
                    <h3 className="text-sm font-display font-bold text-slate-900 mt-1.5">{inv.name}</h3>
                    <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Início: {new Date(inv.startDate).toLocaleDateString('pt-BR')}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setContribInvId(inv.id)}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-bold transition-all border border-emerald-100 flex items-center gap-0.5 cursor-pointer"
                      title="Registrar Novo Aporte"
                    >
                      + Aporte
                    </button>
                    <button
                      onClick={() => handleOpenInvEdit(inv)}
                      className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteInvestment(inv.id)}
                      className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100/70">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Valor Inicial</span>
                    <span className="text-xs font-semibold text-slate-500">R$ {inv.initialAmount.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Valor Atual</span>
                    <span className="text-sm font-display font-extrabold text-indigo-600">R$ {inv.currentAmount.toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/80 flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Percent size={11} className="text-indigo-500" /> Rentabilidade Estimada
                  </span>
                  <span className={`font-extrabold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    +{inv.simpleYield}% ({profit >= 0 ? '+' : ''}R$ {profit.toFixed(0)})
                  </span>
                </div>

                <div className="text-[9px] text-slate-400 font-semibold flex items-center justify-between">
                  <span>Nº de Aportes/Retiradas:</span>
                  <span className="font-bold text-slate-700">{inv.contributionsCount} aportes</span>
                </div>
              </div>
            );
          })}

          {investments.length === 0 && (
            <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200/60 flex flex-col items-center justify-center space-y-2">
              <PiggyBank size={32} className="text-slate-300" />
              <p className="text-xs font-semibold text-slate-500">Nenhum investimento cadastrado.</p>
              <p className="text-[11px] text-slate-400">Registre suas reservas ou investimentos para acompanhar sua rentabilidade de forma consolidada!</p>
            </div>
          )}
        </div>
      ) : (
        /* Controle de Dívidas list */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="debts-grid">
          {debts.map((debt) => {
            const remInstallments = debt.installmentsCount - debt.paidInstallments;
            const remBalance = remInstallments * debt.installmentAmount;
            const progress = (debt.paidInstallments / debt.installmentsCount) * 100;

            return (
              <div 
                key={debt.id} 
                className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-100 text-[8px] font-bold text-rose-600 uppercase tracking-wider">{debt.category}</span>
                    <h3 className="text-sm font-display font-bold text-slate-900 mt-1.5">{debt.name}</h3>
                    <p className="text-[9px] text-slate-400 font-bold block mt-0.5">Vencimento: dia {new Date(debt.nextDueDate).getDate()} de cada mês</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (debt.paidInstallments < debt.installmentsCount) {
                          onEditDebt(debt.id, { paidInstallments: debt.paidInstallments + 1 });
                        }
                      }}
                      className="p-1 text-indigo-600 hover:bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-bold cursor-pointer"
                      title="Pagar Parcela"
                      disabled={debt.paidInstallments === debt.installmentsCount}
                    >
                      Pagar Parcela
                    </button>
                    <button
                      onClick={() => handleOpenDebtEdit(debt)}
                      className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteDebt(debt.id)}
                      className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress bar of amortization */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-slate-500">Amortização:</span>
                    <span className="font-bold text-slate-700">{debt.paidInstallments} de {debt.installmentsCount} parcelas</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100/70 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Valor da Parcela</span>
                    <span className="font-bold text-slate-700">R$ {debt.installmentAmount.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Saldo Devedor Restante</span>
                    <span className="font-display font-extrabold text-rose-600">R$ {remBalance.toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded-xl text-[9px] text-slate-400 font-semibold flex items-center justify-between">
                  <span>Taxa de Juros inclusa:</span>
                  <span className="text-slate-700 font-bold">{debt.interestRate}% a.m.</span>
                </div>
              </div>
            );
          })}

          {debts.length === 0 && (
            <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200/60 flex flex-col items-center justify-center space-y-2">
              <AlertTriangle size={32} className="text-slate-300" />
              <p className="text-xs font-semibold text-slate-500">Nenhuma dívida ou parcelamento ativo.</p>
              <p className="text-[11px] text-slate-400">Excelente! Se você tiver algum financiamento de carro, casa ou compras parceladas, registre aqui.</p>
            </div>
          )}
        </div>
      )}

      {/* Dynamic Invest Rapid contribution panel */}
      {contribInvId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-display font-bold text-slate-900">Registrar Aporte Adicional</h3>
              <button onClick={() => setContribInvId(null)} className="p-1 hover:bg-slate-50 text-slate-400 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRapidContribSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Valor do Aporte (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ex: 500"
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setContribInvId(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Investment Form Modal */}
      {isInvFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-display font-bold text-slate-900">
                {editingInv ? 'Editar Investimento' : 'Novo Investimento / Poupança'}
              </h3>
              <button onClick={() => setIsInvFormOpen(false)} className="p-1 hover:bg-slate-50 text-slate-400 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInvSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Tipo de Ativo</label>
                  <select
                    value={invType}
                    onChange={(e) => setInvType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    {investmentTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Nome / Título</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tesouro Selic 2029"
                    value={invName}
                    onChange={(e) => setInvName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Valor Investido Inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 5000"
                    value={invInitial}
                    onChange={(e) => setInvInitial(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Valor Atualizado Atual</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 5450"
                    value={invCurrent}
                    onChange={(e) => setInvCurrent(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-bold uppercase mb-1">Data de Início</label>
                  <input
                    type="date"
                    required
                    value={invStart}
                    onChange={(e) => setInvStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Rentabilidade (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 11.25"
                    value={invYield}
                    onChange={(e) => setInvYield(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInvFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Salvar Ativo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Debt Form Modal */}
      {isDebtFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-display font-bold text-slate-900">
                {editingDebt ? 'Editar Dívida / Financiamento' : 'Registrar Nova Dívida'}
              </h3>
              <button onClick={() => setIsDebtFormOpen(false)} className="p-1 hover:bg-slate-50 text-slate-400 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDebtSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Nome / Descrição</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Empréstimo Itaú"
                    value={debtName}
                    onChange={(e) => setDebtName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Valor Total da Dívida</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 15000"
                    value={debtTotal}
                    onChange={(e) => setDebtTotal(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Parcelas Totais</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ex: 24"
                    value={debtInstallments}
                    onChange={(e) => setDebtInstallments(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Parcelas Pagas</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Ex: 5"
                    value={debtPaid}
                    onChange={(e) => setDebtPaid(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Valor da Parcela</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 620"
                    value={debtInstallmentAmount}
                    onChange={(e) => setDebtInstallmentAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Juros ao Mês (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 1.5"
                    value={debtInterest}
                    onChange={(e) => setDebtInterest(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-bold uppercase mb-1">Próximo Vencimento</label>
                  <input
                    type="date"
                    required
                    value={debtNextDue}
                    onChange={(e) => setDebtNextDue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Categoria Relacionada</label>
                <select
                  value={debtCat}
                  onChange={(e) => setDebtCat(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  {categories.filter(c => c.type === 'expense').map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDebtFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Salvar Dívida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
