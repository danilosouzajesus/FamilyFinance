import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  PiggyBank, 
  AlertTriangle, 
  CheckCircle, 
  X,
  PlusCircle,
  TrendingDown
} from 'lucide-react';
import { Budget, Category, Transaction } from '../types';

interface FamilyBudgetsProps {
  budgets: Budget[];
  categories: Category[];
  transactions: Transaction[];
  onAddBudget: (budget: Omit<Budget, 'id'>) => void;
  onEditBudget: (id: string, budget: Partial<Budget>) => void;
  onDeleteBudget: (id: string) => void;
}

export default function FamilyBudgets({
  budgets,
  categories,
  transactions,
  onAddBudget,
  onEditBudget,
  onDeleteBudget
}: FamilyBudgetsProps) {
  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Form Fields
  const [categoryId, setCategoryId] = useState('');
  const [limit, setLimit] = useState('');
  const [month, setMonth] = useState('2026-08'); // Default simulation month

  // Validations & Errors
  const [validationError, setValidationError] = useState<string | null>(null);

  // Filter Expense Categories for selection
  const expenseCategories = categories.filter(c => c.type === 'expense');

  // Compute stats for each budget
  const enrichedBudgets = budgets.map(b => {
    // Sum all transactions in this category for the current budget month
    const spent = transactions
      .filter(t => t.type === 'expense' && t.category === b.categoryId && t.date.startsWith(b.month))
      .reduce((sum, t) => sum + t.amount, 0);

    const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    const catObj = categories.find(c => c.name === b.categoryId || c.id === b.categoryId);

    return {
      ...b,
      spent,
      pct,
      catObj
    };
  });

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingBudget(null);
    setCategoryId(expenseCategories[0]?.name || '');
    setLimit('');
    setMonth('2026-08');
    setValidationError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (b: Budget) => {
    setEditingBudget(b);
    setCategoryId(b.categoryId);
    setLimit(b.limit.toString());
    setMonth(b.month);
    setValidationError(null);
    setIsModalOpen(true);
  };

  // Submit Form
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

    // Check if budget already exists for this category and month (when creating new)
    if (!editingBudget) {
      const exists = budgets.some(b => b.categoryId === categoryId && b.month === month);
      if (exists) {
        setValidationError('Já existe um orçamento cadastrado para esta categoria e mês.');
        return;
      }
    }

    const budgetData = {
      categoryId,
      limit: parsedLimit,
      month
    };

    if (editingBudget) {
      onEditBudget(editingBudget.id, budgetData);
    } else {
      onAddBudget(budgetData);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6" id="budgets-manager-container">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Planejamento de Orçamentos</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Defina tetos de gastos por categoria para manter a saúde financeira familiar sob controle</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
          id="add-budget-btn"
        >
          <Plus size={16} /> Definir Teto de Gasto
        </button>
      </div>

      {/* Grid of Budgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="budgets-grid">
        {enrichedBudgets.length === 0 ? (
          <div className="bg-white col-span-full py-16 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400">
            <PiggyBank size={40} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold">Nenhum orçamento planejado ainda.</p>
            <p className="text-xs text-slate-400 mt-1">Clique em "Definir Teto de Gasto" para começar o planejamento financeiro.</p>
          </div>
        ) : (
          enrichedBudgets.map(b => {
            const isExceeded = b.spent > b.limit;
            const isWarning = !isExceeded && b.pct >= 80;
            const remaining = b.limit - b.spent;

            return (
              <div 
                key={b.id} 
                className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
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
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Teto Mensal &bull; {b.month}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(b)}
                      className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 border border-transparent hover:border-slate-100 transition-all"
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
                      className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-rose-600 border border-transparent hover:border-slate-100 transition-all"
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
                      <span className="text-lg font-display font-extrabold text-slate-900">R$ {b.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Limite Máximo</span>
                      <span className="text-xs font-bold text-slate-500">R$ {b.limit.toLocaleString('pt-BR')}</span>
                    </div>
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
                        <AlertTriangle size={12} /> Excedido em R$ {Math.abs(remaining).toFixed(2)}
                      </span>
                    ) : isWarning ? (
                      <span className="text-amber-600 font-bold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded">
                        <AlertTriangle size={12} /> Atenção! Resta R$ {remaining.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded">
                        <CheckCircle size={12} /> Sob controle. Resta R$ {remaining.toFixed(2)}
                      </span>
                    )}
                  </div>
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
                {editingBudget ? 'Editar Orçamento' : 'Definir Teto de Gasto'}
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
              {/* Category */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Categoria de Despesa</label>
                <select
                  value={categoryId}
                  required
                  disabled={!!editingBudget} // lock category on edit
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  id="budget-form-category"
                >
                  {expenseCategories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Limit */}
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

              {/* Month */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Mês do Planejamento</label>
                <input
                  type="month"
                  required
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                  id="budget-form-month"
                />
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
    </div>
  );
}
