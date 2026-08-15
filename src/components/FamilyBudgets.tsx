import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  PiggyBank, 
  AlertTriangle, 
  CheckCircle, 
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  TrendingUp,
  Target,
  Flame,
  Bell
} from 'lucide-react';
import { Budget, MonthlyGoal, Category, Transaction } from '../types';

interface FamilyBudgetsProps {
  budgets: Budget[];
  monthlyGoals: MonthlyGoal[];
  categories: Category[];
  transactions: Transaction[];
  isPrivateMode?: boolean;
  onAddBudget: (budget: Omit<Budget, 'id'>) => void;
  onEditBudget: (id: string, budget: Partial<Budget>) => void;
  onDeleteBudget: (id: string) => void;
  onAddMonthlyGoal: (goal: Omit<MonthlyGoal, 'id'>) => void;
  onEditMonthlyGoal: (id: string, goal: Partial<MonthlyGoal>) => void;
  onDeleteMonthlyGoal: (id: string) => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Helper: shift a "YYYY-MM" string by N months
const shiftMonth = (month: string, delta: number): string => {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
};

// Helper: current month "YYYY-MM"
const currentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function FamilyBudgets({
  budgets,
  monthlyGoals,
  categories,
  transactions,
  isPrivateMode = false,
  onAddBudget,
  onEditBudget,
  onDeleteBudget,
  onAddMonthlyGoal,
  onEditMonthlyGoal,
  onDeleteMonthlyGoal
}: FamilyBudgetsProps) {
  // UI States
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<MonthlyGoal | null>(null);

  // Budget Form Fields
  const [categoryId, setCategoryId] = useState('');
  const [limit, setLimit] = useState('');
  const [notifyAt, setNotifyAt] = useState('80');
  const [rollover, setRollover] = useState(false);

  // Monthly Goal Form Fields
  const [goalName, setGoalName] = useState('');
  const [goalLimit, setGoalLimit] = useState('');
  const [goalNotifyAt, setGoalNotifyAt] = useState('80');
  const [goalCategories, setGoalCategories] = useState<string[]>([]);

  // Validations & Errors
  const [validationError, setValidationError] = useState<string | null>(null);

  // Filter Expense Categories for selection
  const expenseCategories = categories.filter(c => c.type === 'expense');

  // Transactions filtered to selected month
  const monthTx = transactions.filter(t => !t.deleted_at && t.date.startsWith(selectedMonth));

  const spentForCategory = (catId: string, status?: string) => {
    return monthTx
      .filter(t => t.type === 'expense' && t.categoryId === catId && (!status || t.status === status))
      .reduce((sum, t) => sum + t.amount, 0);
  };

  // Previous month spending per category (for rollover)
  const prevMonth = shiftMonth(selectedMonth, -1);
  const prevSpentForCategory = (catId: string) => {
    return transactions
      .filter(t => !t.deleted_at && t.type === 'expense' && t.categoryId === catId && t.date.startsWith(prevMonth))
      .reduce((sum, t) => sum + t.amount, 0);
  };

  // Rollover: unused (or overspent) balance from previous month's budget
  const rolloverAdjustment = (b: Budget): number => {
    if (!b.rollover) return 0;
    const prevBudget = budgets.find(p => p.categoryId === b.categoryId && p.month === prevMonth);
    if (!prevBudget) return 0;
    return prevBudget.limit - prevSpentForCategory(b.categoryId);
  };

  // Compute stats for each budget
  const enrichedBudgets = budgets
    .filter(b => b.month === selectedMonth)
    .map(b => {
      const spent = spentForCategory(b.categoryId);
      const pending = spentForCategory(b.categoryId, 'PENDENTE');
      const realized = spent - pending;
      const rolloverAdj = rolloverAdjustment(b);
      const effectiveLimit = b.limit + rolloverAdj;
      const pct = effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : 0;
      const catObj = categories.find(c => c.id === b.categoryId);
      const notifyPct = b.notifyAtPercent ?? 80;

      // Burn rate / daily projection
      const today = new Date();
      const isCurrentMonth = selectedMonth === currentMonth();
      const dayOfMonth = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const daysRemaining = isCurrentMonth ? Math.max(daysInMonth - dayOfMonth, 0) : 0;
      const dailyAvailable = isCurrentMonth && daysRemaining > 0 ? (effectiveLimit - realized) / daysRemaining : null;
      let overrunDay: number | null = null;
      if (isCurrentMonth && dayOfMonth > 0) {
        const dailyRate = realized / dayOfMonth;
        const remainingLimit = effectiveLimit - realized;
        if (dailyRate > 0 && remainingLimit > 0 && dailyRate > remainingLimit / Math.max(daysRemaining, 1)) {
          overrunDay = Math.min(dayOfMonth + Math.ceil(remainingLimit / dailyRate), daysInMonth);
        }
      }

      return {
        ...b,
        spent,
        pending,
        realized,
        rolloverAdj,
        effectiveLimit,
        pct,
        notifyPct,
        dailyAvailable,
        overrunDay,
        catObj
      };
    });

  // Monthly goals for selected month
  const enrichedGoals = monthlyGoals
    .filter(g => g.month === selectedMonth)
    .map(g => {
      const catFilter = g.categoryIds && g.categoryIds.length > 0 ? g.categoryIds : null;
      const spent = catFilter
        ? monthTx.filter(t => t.type === 'expense' && catFilter.includes(t.categoryId)).reduce((sum, t) => sum + t.amount, 0)
        : monthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const pct = g.limit > 0 ? (spent / g.limit) * 100 : 0;
      const today = new Date();
      const dayOfMonth = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const daysRemaining = Math.max(daysInMonth - dayOfMonth, 0);
      const dailyRate = dayOfMonth > 0 ? spent / dayOfMonth : 0;
      const remainingLimit = g.limit - spent;
      let overrunDay: number | null = null;
      if (dailyRate > 0 && remainingLimit > 0 && dailyRate > remainingLimit / Math.max(daysRemaining, 1)) {
        overrunDay = Math.min(dayOfMonth + Math.ceil(remainingLimit / dailyRate), daysInMonth);
      }
      return { ...g, spent, pct, dailyRate, overrunDay, catFilter };
    });

  // Open Add Budget Modal
  const handleOpenAddModal = () => {
    setEditingBudget(null);
    setCategoryId(expenseCategories[0]?.id || '');
    setLimit('');
    setNotifyAt('80');
    setRollover(false);
    setValidationError(null);
    setIsModalOpen(true);
  };

  // Open Edit Budget Modal
  const handleOpenEditModal = (b: Budget) => {
    setEditingBudget(b);
    setCategoryId(b.categoryId);
    setLimit(b.limit.toString());
    setNotifyAt(String(b.notifyAtPercent ?? 80));
    setRollover(b.rollover ?? false);
    setValidationError(null);
    setIsModalOpen(true);
  };

  // Submit Budget Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedLimit = parseFloat(limit);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      setValidationError('O limite orçamentário deve ser maior que zero.');
      return;
    }

    if (!categoryId) {
      setValidationError('Selecione uma categoria.');
      return;
    }

    const parsedNotify = parseInt(notifyAt);
    if (isNaN(parsedNotify) || parsedNotify <= 0 || parsedNotify > 100) {
      setValidationError('O percentual de notificação deve estar entre 1 e 100.');
      return;
    }

    if (!editingBudget) {
      const exists = budgets.some(b => b.categoryId === categoryId && b.month === selectedMonth);
      if (exists) {
        setValidationError('Já existe um orçamento cadastrado para esta categoria e mês.');
        return;
      }
    }

    const budgetData = {
      categoryId,
      limit: parsedLimit,
      month: selectedMonth,
      notifyAtPercent: parsedNotify,
      rollover
    };

    if (editingBudget) {
      onEditBudget(editingBudget.id, budgetData);
    } else {
      onAddBudget(budgetData);
    }

    setIsModalOpen(false);
  };

  // Import previous month planning (copy)
  const handleCopyPreviousMonth = () => {
    const prevBudgets = budgets.filter(b => b.month === prevMonth);
    if (prevBudgets.length === 0) {
      alert('Não há planejamento cadastrado no mês anterior para importar.');
      return;
    }

    const existing = budgets.filter(b => b.month === selectedMonth);
    const existingCategories = new Set(existing.map(b => b.categoryId));
    const toCopy = prevBudgets.filter(b => !existingCategories.has(b.categoryId));

    if (toCopy.length === 0) {
      alert('Todos os tetos do mês anterior já existem no mês selecionado.');
      return;
    }

    toCopy.forEach(b => {
      onAddBudget({
        categoryId: b.categoryId,
        limit: b.limit,
        month: selectedMonth,
        notifyAtPercent: b.notifyAtPercent ?? 80,
        rollover: b.rollover ?? false
      });
    });

    alert(`${toCopy.length} teto(s) de gasto importado(s) do mês de ${prevMonth}.`);
  };

  // Monthly Goal handlers
  const handleOpenGoalAdd = () => {
    setEditingGoal(null);
    setGoalName('Meta de Gastos do Mês');
    setGoalLimit('');
    setGoalNotifyAt('80');
    setGoalCategories([]);
    setValidationError(null);
    setIsGoalModalOpen(true);
  };

  const handleOpenGoalEdit = (g: MonthlyGoal) => {
    setEditingGoal(g);
    setGoalName(g.name);
    setGoalLimit(g.limit.toString());
    setGoalNotifyAt(String(g.notifyAtPercent ?? 80));
    setGoalCategories(g.categoryIds || []);
    setValidationError(null);
    setIsGoalModalOpen(true);
  };

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedLimit = parseFloat(goalLimit);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      setValidationError('O limite da meta deve ser maior que zero.');
      return;
    }
    if (!goalName.trim()) {
      setValidationError('Informe um nome para a meta.');
      return;
    }
    const parsedNotify = parseInt(goalNotifyAt);
    if (isNaN(parsedNotify) || parsedNotify <= 0 || parsedNotify > 100) {
      setValidationError('O percentual de notificação deve estar entre 1 e 100.');
      return;
    }

    const goalData = {
      name: goalName.trim(),
      month: selectedMonth,
      limit: parsedLimit,
      categoryIds: goalCategories,
      notifyAtPercent: parsedNotify
    };

    if (editingGoal) {
      onEditMonthlyGoal(editingGoal.id, goalData);
    } else {
      onAddMonthlyGoal(goalData);
    }
    setIsGoalModalOpen(false);
  };

  const toggleGoalCategory = (id: string) => {
    setGoalCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const monthLabel = `${MONTH_NAMES[parseInt(selectedMonth.split('-')[1]) - 1]} de ${selectedMonth.split('-')[0]}`;

  return (
    <div className="space-y-6" id="budgets-manager-container">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Planejamento de Orçamentos</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Defina tetos de gastos por categoria e metas mensais para manter a saúde financeira familiar sob controle</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month navigation */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/70 rounded-xl px-2 py-1.5">
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
              className="p-1 hover:bg-white hover:shadow rounded-lg text-slate-500 transition-all cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-bold text-slate-700 min-w-[110px] text-center select-none">{monthLabel}</span>
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
              className="p-1 hover:bg-white hover:shadow rounded-lg text-slate-500 transition-all cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <button
            onClick={handleCopyPreviousMonth}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-600 border border-slate-200/60 text-xs font-bold rounded-xl transition-all cursor-pointer"
            title="Importar o planejamento definido no mês anterior para o mês selecionado"
          >
            <Copy size={14} /> Importar Mês Anterior
          </button>

          <button
            onClick={handleOpenGoalAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-100/50 transition-all cursor-pointer"
          >
            <Target size={14} /> Nova Meta de Gastos
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
            id="add-budget-btn"
          >
            <Plus size={16} /> Definir Teto de Gasto
          </button>
        </div>
      </div>

      {/* Monthly Goals (Metas de Gastos Gerais) Section */}
      {enrichedGoals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Target size={15} className="text-emerald-600" />
            <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Metas de Gastos Gerais — {monthLabel}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="monthly-goals-grid">
            {enrichedGoals.map(g => {
              const isExceeded = g.spent >= g.limit;
              const isWarning = !isExceeded && g.pct >= g.notifyAtPercent;
              const remaining = g.limit - g.spent;
              const scopeLabel = g.catFilter && g.catFilter.length > 0
                ? categories.filter(c => g.catFilter!.includes(c.id)).map(c => c.name).join(', ')
                : 'Todas as categorias (global)';

              return (
                <div
                  key={g.id}
                  className={`bg-white p-5 rounded-2xl border shadow-sm transition-all ${isExceeded ? 'border-rose-200 shadow-rose-50' : isWarning ? 'border-amber-200 shadow-amber-50' : 'border-emerald-200 shadow-emerald-50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-600'}`}>
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-display font-bold text-slate-900">{g.name}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{scopeLabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenGoalEdit(g)}
                        className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all cursor-pointer"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Excluir esta meta de gastos mensal?')) onDeleteMonthlyGoal(g.id);
                        }}
                        className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Gasto do Mês</span>
                        <span className="text-lg font-display font-extrabold text-slate-900">{isPrivateMode ? 'R$ ***' : `R$ ${g.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Teto da Meta</span>
                        <span className="text-xs font-bold text-slate-500">{isPrivateMode ? 'R$ ***' : `R$ ${g.limit.toLocaleString('pt-BR')}`}</span>
                      </div>
                    </div>

                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(g.pct, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="font-semibold text-slate-400">{g.pct.toFixed(1)}% utilizado</span>
                      {isExceeded ? (
                        <span className="text-rose-600 font-bold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded">
                          <AlertTriangle size={12} /> Estouro de {isPrivateMode ? 'R$ ***' : `R$ ${Math.abs(remaining).toFixed(2)}`}
                        </span>
                      ) : isWarning ? (
                        <span className="text-amber-600 font-bold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded">
                          <Bell size={12} /> Atenção! Resta {isPrivateMode ? 'R$ ***' : `R$ ${remaining.toFixed(2)}`}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded">
                          <CheckCircle size={12} /> Sob controle. Resta {isPrivateMode ? 'R$ ***' : `R$ ${remaining.toFixed(2)}`}
                        </span>
                      )}
                    </div>

                    {g.overrunDay && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5">
                        <Flame size={13} className="shrink-0" />
                        <span>Neste ritmo, você ultrapassará a meta no dia {g.overrunDay}.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid of Budgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="budgets-grid">
        {enrichedBudgets.length === 0 ? (
          <div className="bg-white col-span-full py-16 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400">
            <PiggyBank size={40} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold">Nenhum orçamento planejado para {monthLabel}.</p>
            <p className="text-xs text-slate-400 mt-1">Clique em "Definir Teto de Gasto" ou importe o planejamento do mês anterior.</p>
          </div>
        ) : (
          enrichedBudgets.map(b => {
            const isExceeded = b.spent > b.effectiveLimit;
            const isWarning = !isExceeded && b.pct >= b.notifyPct;
            const remaining = b.effectiveLimit - b.spent;

            return (
              <div
                key={b.id}
                className={`bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${isExceeded ? 'ring-1 ring-rose-200' : ''}`}
              >
                {/* Card Title & Icon */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: b.catObj?.color || '#3B82F6' }}
                    >
                      <PiggyBank size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-display font-bold text-slate-900">{b.catObj?.name || b.categoryId}</h3>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Teto Mensal &bull; {monthLabel}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {b.rollover && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-50 border border-cyan-100 text-[8px] font-bold text-cyan-600 uppercase tracking-wider" title="Saldo não gasto acumula para o próximo mês">
                        Rollover
                      </span>
                    )}
                    <button
                      onClick={() => handleOpenEditModal(b)}
                      className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 border border-transparent hover:border-slate-100 transition-all cursor-pointer"
                      id={`edit-budget-btn-${b.id}`}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Tem certeza de que deseja excluir este orçamento?')) {
                          onDeleteBudget(b.id);
                        }
                      }}
                      className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-rose-600 border border-transparent hover:border-slate-100 transition-all cursor-pointer"
                      id={`delete-budget-btn-${b.id}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Progress Circle & Text */}
                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Gasto Atual</span>
                      <span className="text-lg font-display font-extrabold text-slate-900">{isPrivateMode ? 'R$ ***' : `R$ ${b.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Limite Máximo</span>
                      <span className="text-xs font-bold text-slate-500">{isPrivateMode ? 'R$ ***' : `R$ ${b.effectiveLimit.toLocaleString('pt-BR')}`}</span>
                      {b.rolloverAdj !== 0 && (
                        <span className="block text-[9px] font-bold text-cyan-600">({b.rolloverAdj > 0 ? '+' : ''}{isPrivateMode ? 'R$ ***' : `R$ ${b.rolloverAdj.toFixed(2)}`} rollover)</span>
                      )}
                    </div>
                  </div>

                  {/* Realizado vs Previsto breakdown */}
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">Realizado: {isPrivateMode ? 'R$ ***' : `R$ ${b.realized.toFixed(2)}`}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100">Previsto (pendente): {isPrivateMode ? 'R$ ***' : `R$ ${b.pending.toFixed(2)}`}</span>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isExceeded
                          ? 'bg-rose-500'
                          : isWarning
                            ? 'bg-amber-500'
                            : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(b.pct, 100)}%` }}
                    />
                  </div>

                  {/* Status Indicator Bar */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="font-semibold text-slate-400">{b.pct.toFixed(1)}% utilizado</span>
                    {isExceeded ? (
                      <span className="text-rose-600 font-bold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded">
                        <AlertTriangle size={12} /> Excedido em {isPrivateMode ? 'R$ ***' : `R$ ${Math.abs(remaining).toFixed(2)}`}
                      </span>
                    ) : isWarning ? (
                      <span className="text-amber-600 font-bold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded">
                        <AlertTriangle size={12} /> Atenção! Resta {isPrivateMode ? 'R$ ***' : `R$ ${remaining.toFixed(2)}`}
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded">
                        <CheckCircle size={12} /> Sob controle. Resta {isPrivateMode ? 'R$ ***' : `R$ ${remaining.toFixed(2)}`}
                      </span>
                    )}
                  </div>

                  {/* Burn rate / daily projection */}
                  {b.dailyAvailable !== null && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                        <span className="flex items-center gap-1">
                          <TrendingUp size={11} className="text-indigo-500" /> Disponível por dia até fim do mês
                        </span>
                        <span>{isPrivateMode ? 'R$ ***' : `R$ ${Math.max(b.dailyAvailable, 0).toFixed(2)}`}</span>
                      </div>
                      {b.overrunDay && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5">
                          <Flame size={13} className="shrink-0" />
                          <span>Neste ritmo, você ultrapassará o limite no dia {b.overrunDay}.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Budget Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-md w-full p-6 space-y-4" id="budget-modal-container">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-display font-bold text-slate-900">
                {editingBudget ? 'Editar Orçamento' : 'Definir Teto de Gasto'} — {monthLabel}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                id="close-budget-modal-btn"
              >
                <X size={18} />
              </button>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Categoria de Despesa</label>
                <select
                  value={categoryId}
                  required
                  disabled={!!editingBudget}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  id="budget-form-category"
                >
                  {expenseCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Teto de Gastos (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="Ex: 1500"
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                    id="budget-form-limit"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Notificar ao atingir (%) <span className="normal-case text-slate-400 font-semibold">— dispara alerta preventivo</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={notifyAt}
                  onChange={(e) => setNotifyAt(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                  id="budget-form-notify"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-cyan-50/60 border border-cyan-100/80 rounded-xl">
                <input
                  type="checkbox"
                  id="budget-form-rollover"
                  checked={rollover}
                  onChange={(e) => setRollover(e.target.checked)}
                  className="w-4 h-4 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500"
                />
                <label htmlFor="budget-form-rollover" className="text-[11px] font-semibold text-slate-600 select-none cursor-pointer leading-snug">
                  Suporte a Rollover: o saldo não gasto deste mês acumula para o limite do mês seguinte.
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  id="cancel-budget-form-btn"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
                  id="save-budget-form-btn"
                >
                  Salvar Planejamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Monthly Goal Modal */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-md w-full p-6 space-y-4" id="monthly-goal-modal-container">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-display font-bold text-slate-900">
                {editingGoal ? 'Editar Meta de Gastos' : 'Nova Meta de Gastos'} — {monthLabel}
              </h3>
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleGoalSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Nome da Meta</label>
                <input
                  type="text"
                  required
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="Ex: Gastar no máximo R$ 6.000 no mês"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Teto da Meta (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={goalLimit}
                    onChange={(e) => setGoalLimit(e.target.value)}
                    placeholder="Ex: 6000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Notificar ao atingir (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={goalNotifyAt}
                    onChange={(e) => setGoalNotifyAt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Escopo — deixe em branco para meta global (todas as despesas)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {expenseCategories.map(c => {
                    const active = goalCategories.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleGoalCategory(c.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-100/50 transition-all cursor-pointer"
                >
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}