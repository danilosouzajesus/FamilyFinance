import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  User, 
  Users, 
  X, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingDown,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { FamilyMember, Transaction } from '../types';
import { currentMonthStr } from '../utils/format';

interface FamilyMembersProps {
  familyMembers: FamilyMember[];
  transactions: Transaction[];
  isPrivateMode?: boolean;
  onAddMember: (member: Omit<FamilyMember, 'id'>) => void;
  onEditMember: (id: string, member: Partial<FamilyMember>) => void;
  onDeleteMember: (id: string) => void;
}

export default function FamilyMembers({
  familyMembers,
  transactions,
  isPrivateMode = false,
  onAddMember,
  onEditMember,
  onDeleteMember
}: FamilyMembersProps) {
  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [role, setRole] = useState<'father' | 'mother' | 'child' | 'other'>('father');
  const [avatar, setAvatar] = useState('bg-blue-600 text-white');
  const [accessRole, setAccessRole] = useState<'admin' | 'member'>('member');
  const [notifyChannels, setNotifyChannels] = useState<string[]>(['push']);

  // Validation States
  const [validationError, setValidationError] = useState<string | null>(null);

  // Available roles translated
  const roleTranslations = {
    father: 'Pai',
    mother: 'Mãe',
    child: 'Filho(a)',
    other: 'Geral / Outros'
  };

  // Pre-configured avatar style choices
  const avatarChoices = [
    'bg-blue-600 text-white',
    'bg-rose-500 text-white',
    'bg-emerald-500 text-white',
    'bg-purple-600 text-white',
    'bg-amber-500 text-white',
    'bg-cyan-500 text-white',
    'bg-slate-600 text-white'
  ];

  // Open Modal for Adding Member
  const handleOpenAddModal = () => {
    setEditingMember(null);
    setName('');
    setRole('other');
    setAvatar('bg-slate-600 text-white');
    setAccessRole('member');
    setNotifyChannels(['push']);
    setValidationError(null);
    setIsModalOpen(true);
  };

  // Open Modal for Editing Member
  const handleOpenEditModal = (m: FamilyMember) => {
    setEditingMember(m);
    setName(m.name);
    setRole(m.role);
    setAvatar(m.avatar);
    setAccessRole(m.accessRole || 'member');
    setNotifyChannels(m.notifyChannels || ['push']);
    setValidationError(null);
    setIsModalOpen(true);
  };

  // Submit Member Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setValidationError('O nome do membro é obrigatório.');
      return;
    }

    const memberData = {
      name,
      role,
      avatar,
      accessRole,
      notifyChannels: notifyChannels as ('push' | 'email' | 'whatsapp')[]
    };

    if (editingMember) {
      onEditMember(editingMember.id, memberData);
    } else {
      onAddMember(memberData);
    }

    setIsModalOpen(false);
  };

  // Calculate Monthly Metrics per Member (current month)
  const currentMonthStrValue = currentMonthStr();
  
  const getMemberMetrics = (memberId: string) => {
    const memberTransactions = transactions.filter(t => t.memberId === memberId && t.date.startsWith(currentMonthStrValue));
    
    const incomes = memberTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = memberTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      incomes,
      expenses,
      balance: incomes - expenses
    };
  };

  return (
    <div className="space-y-6" id="family-manager-container">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Membros da Família</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Gerencie os participantes do orçamento familiar e acompanhe seus gastos individuais</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
          id="add-member-btn"
        >
          <Plus size={16} /> Adicionar Membro
        </button>
      </div>

      {/* Grid of Family Members */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="family-members-grid">
        {familyMembers.map(m => {
          const metrics = getMemberMetrics(m.id);
          const initials = m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

          return (
            <div 
              key={m.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
            >
              {/* Member Card Top header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {/* Avatar Icon / Initial */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shadow shrink-0 ${m.avatar}`}>
                    {initials || <User size={20} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-display font-bold text-slate-900">{m.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span className="inline-flex px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[9px] font-bold text-indigo-600 uppercase tracking-wider">
                        {roleTranslations[m.role]}
                      </span>
                      {m.accessRole === 'admin' ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                          Administrador
                        </span>
                      ) : (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          Membro
                        </span>
                      )}
                      {(m.notifyChannels || []).length > 0 && (
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                          {(m.notifyChannels || []).map(c => c === 'push' ? 'Push' : c === 'email' ? 'Email' : 'WhatsApp').join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit / Delete actions - lock 'mem_geral' so it cannot be deleted */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditModal(m)}
                    className="p-1.5 rounded hover:bg-slate-50 hover:text-indigo-600 text-slate-400 transition-colors cursor-pointer"
                    id={`edit-member-btn-${m.id}`}
                  >
                    <Edit2 size={12} />
                  </button>
                  {m.id !== 'mem_geral' && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Tem certeza que deseja excluir ${m.name}? Todas as transações dele continuarão existindo, mas sem membro atribuído.`)) {
                          onDeleteMember(m.id);
                        }
                      }}
                      className="p-1.5 rounded hover:bg-slate-50 hover:text-rose-600 text-slate-400 transition-colors cursor-pointer"
                      id={`delete-member-btn-${m.id}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Monthly Breakdown stats */}
              <div className="bg-slate-50/50 p-4 border border-slate-200/40 rounded-2xl space-y-3">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block text-center border-b border-slate-100 pb-1.5">Participação Financeira (Mês Atual)</span>
                
                <div className="grid grid-cols-2 gap-2 text-center divide-x divide-slate-100">
                  {/* Incomes */}
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Receitas</span>
                    <span className="text-xs font-bold text-emerald-600 inline-flex items-center gap-0.5 mt-0.5">
                      <ArrowUpRight size={12} /> {isPrivateMode ? 'R$ ***' : `R$ ${metrics.incomes.toFixed(0)}`}
                    </span>
                  </div>
                  {/* Expenses */}
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Despesas</span>
                    <span className="text-xs font-bold text-slate-800 inline-flex items-center gap-0.5 mt-0.5">
                      <ArrowDownRight size={12} className="text-rose-500" /> {isPrivateMode ? 'R$ ***' : `R$ ${metrics.expenses.toFixed(0)}`}
                    </span>
                  </div>
                </div>

                {/* Net balance */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="font-semibold text-slate-500">Saldo Líquido</span>
                  <span className={`font-display font-extrabold ${metrics.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isPrivateMode ? 'R$ ***' : `R$ ${metrics.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-md w-full p-6 space-y-4" id="member-modal-container">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-display font-bold text-slate-900">
                {editingMember ? 'Editar Membro da Família' : 'Novo Membro da Família'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                id="close-member-modal-btn"
              >
                <X size={18} />
              </button>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Nome do Membro*</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Augusto, Mariana Silva..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                  id="member-form-name"
                />
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Papel Familiar / Função</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                  id="member-form-role"
                >
                  <option value="father">Pai (Responsável)</option>
                  <option value="mother">Mãe (Responsável)</option>
                  <option value="child">Filho(a) (Dependente)</option>
                  <option value="other">Outros / Geral</option>
                </select>
              </div>

              {/* Access Role (5.1 RBAC) */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Nível de Acesso (RBAC)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccessRole('admin')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      accessRole === 'admin' ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-xs font-bold text-slate-800">Administrador</span>
                    <span className="block text-[9px] text-slate-500 font-medium mt-0.5">Edita orçamentos, metas e gerencia membros</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessRole('member')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      accessRole === 'member' ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-xs font-bold text-slate-800">Membro</span>
                    <span className="block text-[9px] text-slate-500 font-medium mt-0.5">Visualiza e registra transações próprias</span>
                  </button>
                </div>
              </div>

              {/* Notification Channels */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Canais de Notificação</label>
                <div className="flex flex-wrap gap-2">
                  {(['push', 'email', 'whatsapp'] as const).map(ch => (
                    <label key={ch} className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 cursor-pointer hover:border-slate-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={notifyChannels.includes(ch)}
                        onChange={(e) => {
                          if (e.target.checked) setNotifyChannels(prev => [...prev, ch]);
                          else setNotifyChannels(prev => prev.filter(c => c !== ch));
                        }}
                        className="accent-indigo-600 cursor-pointer"
                      />
                      {ch === 'push' ? 'Push' : ch === 'email' ? 'Email' : 'WhatsApp'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Avatar Style Picker */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Estilo Visual do Perfil</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {avatarChoices.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setAvatar(choice)}
                      className={`w-9 h-9 rounded-xl transition-all cursor-pointer border ${
                        avatar === choice 
                          ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 border-slate-800' 
                          : 'border-slate-200'
                      } ${choice}`}
                      id={`avatar-choice-${choice.replace(/\s+/g, '-')}`}
                    >
                      AA
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  id="cancel-member-form-btn"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
                  id="save-member-form-btn"
                >
                  Salvar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
