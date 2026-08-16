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
  DollarSign,
  Wallet,
  Table2,
  History,
  HandCoins,
  Calculator,
  Link2,
  RefreshCcw
} from 'lucide-react';
import { Investment, Debt, Category, Account } from '@ff/shared';

interface InvestmentsManagerProps {
  investments: Investment[];
  debts: Debt[];
  categories: Category[];
  accounts?: Account[];
  isPrivateMode?: boolean;
  onAddInvestment: (inv: Omit<Investment, 'id'>) => void;
  onEditInvestment: (id: string, updated: Partial<Investment>) => void;
  onDeleteInvestment: (id: string, revertCapital?: boolean) => void;
  onAddDebt: (debt: Omit<Debt, 'id'>) => void;
  onEditDebt: (id: string, updated: Partial<Debt>) => void;
  onDeleteDebt: (id: string, revertInstallments?: boolean) => void;
}

export default function InvestmentsManager({
  investments,
  debts,
  categories,
  accounts = [],
  isPrivateMode = false,
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
  const [invAccountId, setInvAccountId] = useState('');

  // Debt form states
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtName, setDebtName] = useState('');
  const [debtCreditor, setDebtCreditor] = useState('');
  const [debtTotal, setDebtTotal] = useState('');
  const [debtInstallments, setDebtInstallments] = useState('12');
  const [debtInstallmentAmount, setDebtInstallmentAmount] = useState('');
  const [debtInterest, setDebtInterest] = useState('1.5');
  const [debtNextDue, setDebtNextDue] = useState(new Date().toISOString().split('T')[0]);
  const [debtCat, setDebtCat] = useState('Moradia');
  const [debtPaid, setDebtPaid] = useState('0');
  const [debtAccountId, setDebtAccountId] = useState('');

  // Fast contribution deposit state
  const [contribInvId, setContribInvId] = useState<string | null>(null);
  const [contribAmount, setContribAmount] = useState('');

  // 1.7 Fast resgate (withdrawal) state
  const [withdrawInvId, setWithdrawInvId] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // 1.6 Amortization / anticipation states
  const [amortizationDebtId, setAmortizationDebtId] = useState<string | null>(null);
  const [anticipationDebtId, setAnticipationDebtId] = useState<string | null>(null);
  const [anticipationCount, setAnticipationCount] = useState('1');

  // Delete confirmation modal state (asks how to handle linked transactions)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'inv' | 'debt'; id: string; name: string; amount: number } | null>(null);

  // Helpers
  const investmentTypes = ['POUPANCA', 'CDB', 'LCI_LCA', 'TESOURO_DIRETO', 'ACOES', 'FUNDOS'];
  const investmentAccounts = accounts.filter(a => a.type === 'investment');
  const debtDebitAccounts = accounts.filter(a => a.type !== 'credit');
  const accountById = (id?: string) => accounts.find(a => a.id === id);
  const INVEST_TYPE_LABELS: Record<string, string> = {
    POUPANCA: 'Poupança',
    CDB: 'CDB (Renda Fixa)',
    LCI_LCA: 'LCI / LCA',
    TESOURO_DIRETO: 'Tesouro Direto',
    ACOES: 'Ações',
    FUNDOS: 'Fundos'
  };

  // 1.6 Price amortization schedule for remaining installments
  const buildAmortizationTable = (debt: Debt): { installment: number; dueDate: string; installmentAmount: number; amortization: number; interest: number; balance: number }[] => {
    const rows: { installment: number; dueDate: string; installmentAmount: number; amortization: number; interest: number; balance: number }[] = [];
    const rate = debt.interestRate / 100;
    let balance = (debt.installmentsCount - debt.paidInstallments) * debt.installmentAmount;
    const start = new Date(debt.nextDueDate);

    for (let i = 1; i <= (debt.installmentsCount - debt.paidInstallments); i++) {
      if (balance <= 0) break;
      const interest = rate > 0 ? balance * rate : 0;
      let amortization = debt.installmentAmount - interest;
      if (amortization > balance) {
        amortization = balance;
      }
      const amountPaid = amortization + interest;
      balance = Math.max(balance - amortization, 0);

      const due = new Date(start);
      due.setMonth(due.getMonth() + (i - 1));

      rows.push({
        installment: debt.paidInstallments + i,
        dueDate: due.toISOString().split('T')[0],
        installmentAmount: Math.round(amountPaid * 100) / 100,
        amortization: Math.round(amortization * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        balance: Math.round(balance * 100) / 100
      });
    }
    return rows;
  };

  // Anticipation simulation: anticipating "n" installments waives the interest portion
  const simulateAnticipation = (debt: Debt, n: number) => {
    const rows = buildAmortizationTable(debt);
    const target = rows.slice(0, n);
    const totalAvoided = target.reduce((s, r) => s + r.installmentAmount, 0);
    const interestSaved = target.reduce((s, r) => s + r.interest, 0);
    const amortizationDue = target.reduce((s, r) => s + r.amortization, 0);
    return { rows: target, totalAvoided, interestSaved, amortizationDue };
  };

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
      contributionsCount: contribCount,
      accountId: invAccountId || undefined
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

  // 1.7 Submit resgate (withdrawal)
  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawInvId || !withdrawAmount) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return;

    const target = investments.find(i => i.id === withdrawInvId);
    if (target) {
      if (amount > target.currentAmount) {
        alert('O valor do resgate não pode ser maior que o saldo atual do ativo.');
        return;
      }
      onEditInvestment(withdrawInvId, {
        currentAmount: target.currentAmount - amount,
        withdrawalsCount: (target.withdrawalsCount || 0) + 1
      });
    }
    setWithdrawInvId(null);
    setWithdrawAmount('');
  };

  // 1.6 Confirm anticipation of installments
  const handleConfirmAnticipation = () => {
    if (!anticipationDebtId) return;
    const debt = debts.find(d => d.id === anticipationDebtId);
    if (!debt) return;

    const n = parseInt(anticipationCount);
    if (isNaN(n) || n <= 0) return;
    const remaining = debt.installmentsCount - debt.paidInstallments;
    if (n > remaining) {
      alert('O número de parcelas a antecipar não pode exceder as parcelas restantes.');
      return;
    }

    onEditDebt(anticipationDebtId, { paidInstallments: debt.paidInstallments + n });
    setAnticipationDebtId(null);
    setAnticipationCount('1');
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
      creditor: debtCreditor.trim(),
      totalAmount: total,
      installmentsCount: instCount,
      installmentAmount: instAmount,
      interestRate: interest,
      nextDueDate: debtNextDue,
      category: debtCat,
      paidInstallments: paid,
      accountId: debtAccountId || undefined
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
    setInvType('POUPANCA');
    setInvName('');
    setInvInitial('');
    setInvCurrent('');
    setInvYield('11.25');
    setInvStart(new Date().toISOString().split('T')[0]);
    setInvContribs('1');
    setInvAccountId(investmentAccounts[0]?.id || '');
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
    setInvAccountId(inv.accountId || '');
    setIsInvFormOpen(true);
  };

  // Delete confirmation flows
  const handleAskDeleteInv = (inv: Investment) => {
    setDeleteTarget({ kind: 'inv', id: inv.id, name: inv.name, amount: inv.currentAmount });
  };

  const handleAskDeleteDebt = (debt: Debt) => {
    setDeleteTarget({
      kind: 'debt',
      id: debt.id,
      name: debt.name,
      amount: (debt.paidInstallments || 0) * debt.installmentAmount
    });
  };

  const handleConfirmDelete = (revert: boolean) => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'inv') {
      onDeleteInvestment(deleteTarget.id, revert);
    } else {
      onDeleteDebt(deleteTarget.id, revert);
    }
    setDeleteTarget(null);
  };

  const handleOpenDebtAdd = () => {
    setEditingDebt(null);
    setDebtName('');
    setDebtCreditor('');
    setDebtTotal('');
    setDebtInstallments('12');
    setDebtInstallmentAmount('');
    setDebtInterest('1.5');
    setDebtNextDue(new Date().toISOString().split('T')[0]);
    setDebtCat('Moradia');
    setDebtPaid('0');
    setDebtAccountId(debtDebitAccounts[0]?.id || accounts[0]?.id || '');
    setIsDebtFormOpen(true);
  };

  const handleOpenDebtEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setDebtName(debt.name);
    setDebtCreditor(debt.creditor || '');
    setDebtTotal(debt.totalAmount.toString());
    setDebtInstallments(debt.installmentsCount.toString());
    setDebtInstallmentAmount(debt.installmentAmount.toString());
    setDebtInterest(debt.interestRate.toString());
    setDebtNextDue(debt.nextDueDate);
    setDebtCat(debt.category);
    setDebtPaid(debt.paidInstallments.toString());
    setDebtAccountId(debt.accountId || debtDebitAccounts[0]?.id || accounts[0]?.id || '');
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
            <span className="text-xl font-display font-extrabold text-indigo-600 mt-1 block">{isPrivateMode ? 'R$ ***' : `R$ ${totalInvs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <PiggyBank size={16} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Rendimento Estimado Acumulado</span>
            <span className={`text-xl font-display font-extrabold mt-1 block ${totalInvsProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isPrivateMode ? 'R$ ***' : `R$ ${totalInvsProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            </span>
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${totalInvsProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <TrendingUp size={16} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Saldo devedor total</span>
            <span className="text-xl font-display font-extrabold text-rose-600 mt-1 block">{isPrivateMode ? 'R$ ***' : `R$ ${totalDebts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
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
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[8px] font-bold text-indigo-600 uppercase tracking-wider">{INVEST_TYPE_LABELS[inv.type] || inv.type}</span>
                    <h3 className="text-sm font-display font-bold text-slate-900 mt-1.5">{inv.name}</h3>
                    <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Início: {new Date(inv.startDate).toLocaleDateString('pt-BR')}</span>
                    <div className="flex items-center gap-1 mt-1.5">
                      {inv.origin === 'PLUGGY' && (
                        <span className="px-1.5 py-0.5 rounded bg-sky-50 border border-sky-100 text-[8px] font-bold text-sky-600 uppercase tracking-wider flex items-center gap-0.5">
                          <Link2 size={8} /> Pluggy
                        </span>
                      )}
                      {accountById(inv.accountId) && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                          {accountById(inv.accountId)?.name}
                        </span>
                      )}
                    </div>
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
                      onClick={() => setWithdrawInvId(inv.id)}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all border border-rose-100 flex items-center gap-0.5 cursor-pointer"
                      title="Registrar Resgate (Retirada)"
                    >
                      - Resgate
                    </button>
                    <button
                      onClick={() => handleOpenInvEdit(inv)}
                      className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleAskDeleteInv(inv)}
                      className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                      aria-label={`Excluir ativo ${inv.name}`}
                      title="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100/70">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Valor Inicial</span>
                    <span className="text-xs font-semibold text-slate-500">{isPrivateMode ? 'R$ ***' : `R$ ${inv.initialAmount.toLocaleString('pt-BR')}`}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Valor Atual</span>
                    <span className="text-sm font-display font-extrabold text-indigo-600">{isPrivateMode ? 'R$ ***' : `R$ ${inv.currentAmount.toLocaleString('pt-BR')}`}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/80 flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Percent size={11} className="text-indigo-500" /> Rentabilidade Estimada
                  </span>
                  <span className={`font-extrabold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    +{inv.simpleYield}% ({profit >= 0 ? '+' : ''}{isPrivateMode ? 'R$ ***' : `R$ ${profit.toFixed(0)}`})
                  </span>
                </div>

                <div className="text-[9px] text-slate-400 font-semibold flex items-center justify-between">
                  <span>Nº de Aportes / Resgates:</span>
                  <span className="font-bold text-slate-700">
                    {inv.contributionsCount} aportes{inv.withdrawalsCount ? ` • ${inv.withdrawalsCount} resgates` : ''}
                  </span>
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
                    {debt.creditor && (
                      <p className="text-[9px] text-slate-400 font-semibold block mt-0.5">Credor: {debt.creditor}</p>
                    )}
                    {accountById(debt.accountId) && (
                      <p className="text-[9px] text-slate-400 font-semibold block mt-0.5 flex items-center gap-1">
                        <Wallet size={9} /> Débito: {accountById(debt.accountId)?.name}
                      </p>
                    )}
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
                      onClick={() => setAnticipationDebtId(debt.id)}
                      className="p-1 text-amber-600 hover:bg-amber-50 border border-amber-100 rounded-lg text-[10px] font-bold cursor-pointer flex items-center gap-0.5"
                      title="Simular antecipação de parcelas (amortização com desconto de juros)"
                      disabled={debt.paidInstallments === debt.installmentsCount}
                    >
                      <HandCoins size={10} /> Antecipar
                    </button>
                    <button
                      onClick={() => setAmortizationDebtId(debt.id)}
                      className="p-1 text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold cursor-pointer"
                      title="Ver tabela de amortização (amortização e juros)"
                    >
                      <Table2 size={11} />
                    </button>
                    <button
                      onClick={() => handleOpenDebtEdit(debt)}
                      className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleAskDeleteDebt(debt)}
                      className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                      aria-label={`Excluir dívida ${debt.name}`}
                      title="Excluir"
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
                    <span className="font-bold text-slate-700">{isPrivateMode ? 'R$ ***' : `R$ ${debt.installmentAmount.toLocaleString('pt-BR')}`}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Saldo Devedor Restante</span>
                    <span className="font-display font-extrabold text-rose-600">{isPrivateMode ? 'R$ ***' : `R$ ${remBalance.toLocaleString('pt-BR')}`}</span>
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

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Conta de Investimento</label>
                <select
                  required
                  value={invAccountId}
                  onChange={(e) => setInvAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="" disabled>Selecione a conta de investimento</option>
                  {investmentAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {investmentAccounts.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1 font-semibold">
                    Nenhuma conta de investimento cadastrada. Crie uma conta do tipo "Investimento" em Contas &amp; Cartões.
                  </p>
                )}
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
                  <label className="block text-slate-400 font-bold uppercase mb-1">Credor</label>
                  <input
                    type="text"
                    placeholder="Ex: Banco Itaú, Magazine Luiza"
                    value={debtCreditor}
                    onChange={(e) => setDebtCreditor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Conta de Débito das Parcelas</label>
                  <select
                    required
                    value={debtAccountId}
                    onChange={(e) => setDebtAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="" disabled>Selecione a conta</option>
                    {debtDebitAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-slate-400 mt-1">Cada parcela paga gera uma despesa nesta conta (extrato unificado).</p>
                  {debtDebitAccounts.length === 0 && (
                    <p className="text-[9px] text-amber-600 font-semibold mt-1">Cadastre uma conta corrente, dinheiro ou investimento para debitar as parcelas.</p>
                  )}
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

      {/* 1.7 Investment Resgate (Withdrawal) Modal */}
      {withdrawInvId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-display font-bold text-slate-900 flex items-center gap-1.5">
                <Wallet size={16} className="text-rose-500" /> Registrar Resgate (Retirada)
              </h3>
              <button onClick={() => setWithdrawInvId(null)} className="p-1 hover:bg-slate-50 text-slate-400 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Valor do Resgate (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ex: 500"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWithdrawInvId(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Confirmar Resgate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1.6 Debt Amortization Table Modal */}
      {amortizationDebtId && (() => {
        const debt = debts.find(d => d.id === amortizationDebtId);
        if (!debt) return null;
        const rows = buildAmortizationTable(debt);
        const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-2xl w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-display font-bold text-slate-900 flex items-center gap-1.5">
                  <Table2 size={16} className="text-indigo-600" /> Tabela de Amortização — {debt.name}
                </h3>
                <button onClick={() => setAmortizationDebtId(null)} className="p-1 hover:bg-slate-50 text-slate-400 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">Saldo devedor atual: R$ {(rows[0]?.balance + (rows[0]?.amortization ?? 0)).toLocaleString('pt-BR')}</span>
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600">Juros totais restantes: R$ {totalInterest.toLocaleString('pt-BR')}</span>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600">Parcelas restantes: {rows.length}</span>
              </div>

              <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-100">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-50 text-[9px] text-slate-400 uppercase font-bold sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Parcela</th>
                      <th className="px-3 py-2 text-left">Vencimento</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2 text-right">Amortização</th>
                      <th className="px-3 py-2 text-right">Juros</th>
                      <th className="px-3 py-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map(r => (
                      <tr key={r.installment} className="hover:bg-slate-50/40">
                        <td className="px-3 py-1.5 font-bold text-slate-700">{r.installment}ª</td>
                        <td className="px-3 py-1.5 text-slate-500">{new Date(r.dueDate).toLocaleDateString('pt-BR')}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-slate-700">R$ {r.installmentAmount.toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-emerald-600">R$ {r.amortization.toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-rose-500">R$ {r.interest.toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-1.5 text-right text-slate-500">R$ {r.balance.toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={() => setAmortizationDebtId(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 1.6 Anticipation (Amortização Antecipada) Modal */}
      {anticipationDebtId && (() => {
        const debt = debts.find(d => d.id === anticipationDebtId);
        if (!debt) return null;
        const remaining = debt.installmentsCount - debt.paidInstallments;
        const n = Math.min(parseInt(anticipationCount) || 1, remaining);
        const sim = simulateAnticipation(debt, n);
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-sm w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-display font-bold text-slate-900 flex items-center gap-1.5">
                  <HandCoins size={16} className="text-amber-600" /> Antecipar Parcelas — {debt.name}
                </h3>
                <button onClick={() => setAnticipationDebtId(null)} className="p-1 hover:bg-slate-50 text-slate-400 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Quantidade de parcelas a antecipar</label>
                <input
                  type="number"
                  min="1"
                  max={remaining}
                  required
                  value={anticipationCount}
                  onChange={(e) => setAnticipationCount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
                <p className="text-[9px] text-slate-400 mt-1">Máximo: {remaining} parcelas restantes</p>
              </div>

              {sim.rows.length > 0 && (
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                    <span>Total evitado (sem antecipação):</span>
                    <span className="font-bold text-slate-700">R$ {sim.totalAvoided.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                    <span>Amortização paga hoje:</span>
                    <span className="font-bold text-indigo-600">R$ {sim.amortizationDue.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5">
                    <span className="flex items-center gap-1"><Calculator size={11} /> Juros economizados:</span>
                    <span className="font-extrabold">R$ {sim.interestSaved.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAnticipationDebtId(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmAnticipation}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  Confirmar Antecipação
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete confirmation modal — how to handle linked transactions */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4" id="delete-target-modal-container">
            <div className="flex items-center gap-2 text-rose-500 border-b border-slate-100 pb-2">
              <AlertTriangle size={18} />
              <h3 className="text-sm font-display font-extrabold">
                Excluir {deleteTarget.kind === 'inv' ? 'Ativo' : 'Dívida'} "{deleteTarget.name}"
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {deleteTarget.kind === 'inv'
                ? `Este ativo possui R$ ${deleteTarget.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} aplicados.`
                : `Esta dívida já teve R$ ${deleteTarget.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} debitados em parcelas pagas.`}{' '}
              O que deseja fazer com esses valores?
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleConfirmDelete(false)}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                id="delete-target-keep-btn"
              >
                <Wallet size={13} /> Manter valores nos saldos das contas
              </button>
              <button
                onClick={() => handleConfirmDelete(true)}
                className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                id="delete-target-revert-btn"
              >
                <RefreshCcw size={13} /> Reverter lançamentos (estorno do valor)
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
