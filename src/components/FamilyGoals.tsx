import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Target, 
  CheckCircle, 
  X, 
  PlusCircle, 
  MinusCircle, 
  Calendar, 
  TrendingUp,
  Award
} from 'lucide-react';
import { Goal } from '../types';

interface FamilyGoalsProps {
  goals: Goal[];
  onAddGoal: (goal: Omit<Goal, 'id'>) => void;
  onEditGoal: (id: string, goal: Partial<Goal>) => void;
  onDeleteGoal: (id: string) => void;
}

export default function FamilyGoals({
  goals,
  onAddGoal,
  onEditGoal,
  onDeleteGoal
}: FamilyGoalsProps) {
  // UI States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isContribModalOpen, setIsContribModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [contribType, setContribType] = useState<'deposit' | 'withdraw'>('deposit');

  // Goal Form Fields
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState('#4F46E5'); // indigo-600

  // Contribution Form Fields
  const [contribAmount, setContribAmount] = useState('');

  // Validation States
  const [validationError, setValidationError] = useState<string | null>(null);

  // Colors available for selection
  const goalColors = [
    { value: '#3B82F6', label: 'Azul' },
    { value: '#10B981', label: 'Verde' },
    { value: '#8B5CF6', label: 'Violeta' },
    { value: '#EC4899', label: 'Rosa' },
    { value: '#F59E0B', label: 'Amarelo' },
    { value: '#EF4444', label: 'Vermelho' },
    { value: '#06B6D4', label: 'Ciano' },
    { value: '#6B7280', label: 'Cinza' }
  ];

  // Open Form for Adding Goal
  const handleOpenAddForm = () => {
    setSelectedGoal(null);
    setName('');
    setTargetAmount('');
    setCurrentAmount('0');
    setDeadline(new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]); // End of year default
    setColor('#3B82F6');
    setValidationError(null);
    setIsFormModalOpen(true);
  };

  // Open Form for Editing Goal
  const handleOpenEditForm = (g: Goal) => {
    setSelectedGoal(g);
    setName(g.name);
    setTargetAmount(g.targetAmount.toString());
    setCurrentAmount(g.currentAmount.toString());
    setDeadline(g.deadline);
    setColor(g.color);
    setValidationError(null);
    setIsFormModalOpen(true);
  };

  // Open Contribution Modal
  const handleOpenContribModal = (g: Goal, type: 'deposit' | 'withdraw') => {
    setSelectedGoal(g);
    setContribType(type);
    setContribAmount('');
    setValidationError(null);
    setIsContribModalOpen(true);
  };

  // Submit Goal Form
  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedTarget = parseFloat(targetAmount);
    const parsedCurrent = parseFloat(currentAmount);

    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      setValidationError('O valor alvo deve ser maior que zero.');
      return;
    }
    if (isNaN(parsedCurrent) || parsedCurrent < 0) {
      setValidationError('O valor atual não pode ser negativo.');
      return;
    }
    if (!name.trim()) {
      setValidationError('O nome da meta é obrigatório.');
      return;
    }
    if (!deadline) {
      setValidationError('A data de prazo final é inválida.');
      return;
    }

    const goalData = {
      name,
      targetAmount: parsedTarget,
      currentAmount: parsedCurrent,
      deadline,
      color
    };

    if (selectedGoal) {
      onEditGoal(selectedGoal.id, goalData);
    } else {
      onAddGoal(goalData);
    }

    setIsFormModalOpen(false);
  };

  // Submit Contribution Form (Aporte / Resgate)
  const handleContribSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;

    const parsedContrib = parseFloat(contribAmount);
    if (isNaN(parsedContrib) || parsedContrib <= 0) {
      setValidationError('O valor da contribuição deve ser maior que zero.');
      return;
    }

    let newAmount = selectedGoal.currentAmount;
    if (contribType === 'deposit') {
      newAmount += parsedContrib;
    } else {
      if (parsedContrib > selectedGoal.currentAmount) {
        setValidationError('O valor de resgate não pode ser maior do que o saldo atual guardado.');
        return;
      }
      newAmount -= parsedContrib;
    }

    onEditGoal(selectedGoal.id, { currentAmount: newAmount });
    setIsContribModalOpen(false);
  };

  // Calculate Days Remaining
  const getDaysRemaining = (deadlineStr: string) => {
    const diff = new Date(deadlineStr).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} dias restantes` : 'Prazo esgotado';
  };

  return (
    <div className="space-y-6" id="goals-manager-container">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Cofrinho de Metas Coletivas</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Planeje, poupe e celebre conquistas familiares em conjunto</p>
        </div>
        <button
          onClick={handleOpenAddForm}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
          id="add-goal-btn"
        >
          <Plus size={16} /> Nova Meta de Poupança
        </button>
      </div>

      {/* Grid of Goals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="goals-grid">
        {goals.length === 0 ? (
          <div className="bg-white col-span-full py-16 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400">
            <Target size={40} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold">Nenhuma meta ativa cadastrada.</p>
            <p className="text-xs text-slate-400 mt-1">Defina objetivos de poupança (ex: Viagem de férias, reserva de emergência, etc.).</p>
          </div>
        ) : (
          goals.map(g => {
            const pct = Math.round((g.currentAmount / g.targetAmount) * 100);
            const isCompleted = g.currentAmount >= g.targetAmount;
            const remainingToSave = g.targetAmount - g.currentAmount;

            return (
              <div 
                key={g.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                {/* Visual completion ribbon background */}
                {isCompleted && (
                  <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none">
                    <div className="absolute top-2 right-[-24px] bg-emerald-500 text-white text-[9px] font-bold text-center py-0.5 w-20 rotate-45 flex items-center justify-center shadow">
                      <Award size={10} className="mr-0.5" /> Concluída
                    </div>
                  </div>
                )}

                {/* Card Top Branding & Actions */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: g.color }}
                    >
                      <Target size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-display font-bold text-slate-900 pr-8 truncate">{g.name}</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Calendar size={10} /> Alvo: {new Date(g.deadline).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400">
                    <button
                      onClick={() => handleOpenEditForm(g)}
                      className="p-1 rounded hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer"
                      id={`edit-goal-btn-${g.id}`}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Excluir esta meta? Seus saldos salvos serão removidos de visualização.')) {
                          onDeleteGoal(g.id);
                        }
                      }}
                      className="p-1 rounded hover:bg-slate-50 hover:text-rose-600 transition-colors cursor-pointer"
                      id={`delete-goal-btn-${g.id}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Values progress */}
                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Acumulado</span>
                      <span className="text-lg font-display font-extrabold" style={{ color: g.color }}>
                        R$ {g.currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Alvo Necessário</span>
                      <span className="text-xs font-bold text-slate-500">
                        R$ {g.targetAmount.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: g.color }}
                    />
                  </div>

                  {/* Days counter and percent */}
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 pt-1">
                    <span>{pct}% Batida</span>
                    <span>{getDaysRemaining(g.deadline)}</span>
                  </div>
                </div>

                {/* Quick contribute controls */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                  <button
                    onClick={() => handleOpenContribModal(g, 'deposit')}
                    className="flex items-center justify-center gap-1 py-1.5 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 text-slate-600 hover:text-emerald-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    id={`goal-deposit-btn-${g.id}`}
                  >
                    <PlusCircle size={14} className="text-emerald-500" /> Guardar
                  </button>
                  <button
                    onClick={() => handleOpenContribModal(g, 'withdraw')}
                    className="flex items-center justify-center gap-1 py-1.5 border border-slate-200 hover:border-rose-500 hover:bg-rose-50/20 text-slate-600 hover:text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    id={`goal-withdraw-btn-${g.id}`}
                  >
                    <MinusCircle size={14} className="text-rose-500" /> Resgatar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Goal Add/Edit Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-md w-full p-6 space-y-4" id="goal-form-modal-container">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-display font-bold text-slate-900">
                {selectedGoal ? 'Editar Meta de Poupança' : 'Nova Meta de Poupança'}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                id="close-goal-form-btn"
              >
                <X size={18} />
              </button>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex items-center gap-2">
                <X size={14} className="shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleGoalSubmit} className="space-y-4">
              {/* Goal Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Nome da Meta*</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Trocar de Carro, Reserva de Emergência..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                  id="goal-form-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Target Amount */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Alvo da Meta (R$)*</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="Ex: 15000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                    id="goal-form-target"
                  />
                </div>

                {/* Current Amount */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Saldo Inicial Guardado</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={!!selectedGoal} // Lock on edit, use contribute modal
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    placeholder="Ex: 0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                    id="goal-form-current"
                  />
                </div>
              </div>

              {/* Deadline and Color */}
              <div className="grid grid-cols-2 gap-4">
                {/* Deadline */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Prazo Final*</label>
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                    id="goal-form-deadline"
                  />
                </div>

                {/* Color selection */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Identidade Visual (Cor)</label>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {goalColors.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setColor(c.value)}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer border ${
                          color === c.value 
                            ? 'scale-125 border-slate-800 ring-2 ring-indigo-100' 
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  id="cancel-goal-form-btn"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
                  id="save-goal-form-btn"
                >
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribution (Aporte / Resgate) Modal */}
      {isContribModalOpen && selectedGoal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-sm w-full p-6 space-y-4" id="contrib-modal-container">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-display font-bold text-slate-900 flex items-center gap-1.5">
                <TrendingUp size={18} className={contribType === 'deposit' ? 'text-emerald-500' : 'text-rose-500'} />
                {contribType === 'deposit' ? 'Guardar Dinheiro' : 'Resgatar Dinheiro'}
              </h3>
              <button
                onClick={() => setIsContribModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                id="close-contrib-modal-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl space-y-1 border border-slate-100/80 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Meta Selecionada</span>
              <span className="text-xs font-bold text-slate-700 block">{selectedGoal.name}</span>
              <span className="text-xs font-semibold text-slate-500 block">
                Saldo atual acumulado: <span className="font-bold text-slate-900">R$ {selectedGoal.currentAmount.toLocaleString('pt-BR')}</span>
              </span>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex items-center gap-2">
                <X size={14} className="shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleContribSubmit} className="space-y-4">
              {/* Contribution Amount */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  {contribType === 'deposit' ? 'Valor a Guardar (Aporte)' : 'Valor a Resgatar (Retirada)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    autoFocus
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-extrabold focus:outline-none focus:border-indigo-500 transition-colors"
                    id="contrib-form-amount"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsContribModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  id="cancel-contrib-form-btn"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer ${
                    contribType === 'deposit' 
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100/50' 
                      : 'bg-rose-500 hover:bg-rose-600 shadow-rose-100/50'
                  }`}
                  id="save-contrib-form-btn"
                >
                  Confirmar Operação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
