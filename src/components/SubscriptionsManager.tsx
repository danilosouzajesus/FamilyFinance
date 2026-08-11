import React, { useState } from 'react';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Bell, 
  BellOff, 
  Zap, 
  Check, 
  AlertCircle,
  HelpCircle,
  Calendar,
  Layers
} from 'lucide-react';
import { Subscription, AutomationRule, Category, FamilyMember } from '../types';

interface SubscriptionsManagerProps {
  subscriptions: Subscription[];
  automationRules: AutomationRule[];
  categories: Category[];
  familyMembers: FamilyMember[];
  onAddSubscription: (sub: Omit<Subscription, 'id'>) => void;
  onEditSubscription: (id: string, updated: Partial<Subscription>) => void;
  onDeleteSubscription: (id: string, deleteAssociatedTransactions: boolean) => void;
  onAddRule: (rule: Omit<AutomationRule, 'id'>) => void;
  onEditRule: (id: string, updated: Partial<AutomationRule>) => void;
  onDeleteRule: (id: string) => void;
}

export default function SubscriptionsManager({
  subscriptions,
  automationRules,
  categories,
  familyMembers,
  onAddSubscription,
  onEditSubscription,
  onDeleteSubscription,
  onAddRule,
  onEditRule,
  onDeleteRule
}: SubscriptionsManagerProps) {
  const [activeTab, setActiveTab] = useState<'subs' | 'rules'>('subs');

  // Subscriptions states
  const [isSubFormOpen, setIsSubFormOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subFreq, setSubFreq] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [subCat, setSubCat] = useState('Lazer & Viagem');
  const [subBillDate, setSubBillDate] = useState('10');
  const [subNotify, setSubNotify] = useState(true);
  const [subMember, setSubMember] = useState('mem_geral');

  // Deletion modal states
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);

  // Automation Rules states
  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [condField, setCondField] = useState<'text_contains' | 'amount_greater' | 'source_account'>('text_contains');
  const [condVal, setCondVal] = useState('');
  const [actField, setActField] = useState<'category' | 'tag' | 'recurrence'>('category');
  const [actVal, setActVal] = useState('');

  // 1.4 Subscription CRUD Handlers
  const handleOpenSubAdd = () => {
    setEditingSub(null);
    setSubName('');
    setSubAmount('');
    setSubFreq('monthly');
    setSubCat('Lazer & Viagem');
    setSubBillDate('10');
    setSubNotify(true);
    setSubMember('mem_geral');
    setIsSubFormOpen(true);
  };

  const handleOpenSubEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setSubName(sub.name);
    setSubAmount(sub.amount.toString());
    setSubFreq(sub.frequency);
    setSubCat(sub.category);
    setSubBillDate(sub.billingDate);
    setSubNotify(sub.autoNotify);
    setSubMember(sub.memberId || 'mem_geral');
    setIsSubFormOpen(true);
  };

  const handleSubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || !subAmount) return;

    const parsedAmount = parseFloat(subAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Por favor, insira um valor válido maior que zero.');
      return;
    }

    const payload = {
      name: subName.trim(),
      amount: parsedAmount,
      frequency: subFreq,
      category: subCat,
      billingDate: subBillDate,
      autoNotify: subNotify,
      memberId: subMember
    };

    if (editingSub) {
      onEditSubscription(editingSub.id, payload);
    } else {
      onAddSubscription(payload);
    }
    setIsSubFormOpen(false);
  };

  const handleOpenSubDelete = (id: string) => {
    setDeletingSubId(id);
  };

  const handleConfirmSubDelete = (deleteLauchings: boolean) => {
    if (deletingSubId) {
      onDeleteSubscription(deletingSubId, deleteLauchings);
      setDeletingSubId(null);
    }
  };

  // 2.3 Automation Rules CRUD Handlers
  const handleOpenRuleAdd = () => {
    setEditingRule(null);
    setCondField('text_contains');
    setCondVal('');
    setActField('category');
    setActVal('');
    setIsRuleFormOpen(true);
  };

  const handleOpenRuleEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setCondField(rule.conditionField);
    setCondVal(rule.conditionValue);
    setActField(rule.actionField);
    setActVal(rule.actionValue);
    setIsRuleFormOpen(true);
  };

  const handleRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!condVal.trim() || !actVal.trim()) return;

    const payload = {
      conditionField: condField,
      conditionValue: condVal.trim(),
      actionField: actField,
      actionValue: actVal.trim()
    };

    if (editingRule) {
      onEditRule(editingRule.id, payload);
    } else {
      onAddRule(payload);
    }
    setIsRuleFormOpen(false);
  };

  const handleToggleNotify = (sub: Subscription) => {
    onEditSubscription(sub.id, { autoNotify: !sub.autoNotify });
  };

  return (
    <div className="space-y-6" id="subs-manager-container">
      
      {/* Tab selection header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('subs')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'subs' 
                ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Assinaturas Ativas ({subscriptions.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'rules' 
                ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Regras de Conciliação ({automationRules.length})
          </button>
        </div>

        <button
          onClick={activeTab === 'subs' ? handleOpenSubAdd : handleOpenRuleAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
        >
          <Plus size={16} /> 
          {activeTab === 'subs' ? 'Cadastrar Assinatura' : 'Criar Regra Inteligente'}
        </button>
      </div>

      {/* VIEW CANVAS */}
      {activeTab === 'subs' ? (
        /* Subscriptions Dashboard Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="subs-grid">
          {subscriptions.map((sub) => {
            const member = familyMembers.find(m => m.id === sub.memberId);
            return (
              <div 
                key={sub.id} 
                className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-display font-bold text-slate-900">{sub.name}</h3>
                      <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">{sub.category}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleNotify(sub)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        sub.autoNotify 
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                      }`}
                      title={sub.autoNotify ? 'Notificações Ativadas' : 'Notificações Desativadas'}
                    >
                      {sub.autoNotify ? <Bell size={13} /> : <BellOff size={13} />}
                    </button>
                    <button
                      onClick={() => handleOpenSubEdit(sub)}
                      className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleOpenSubDelete(sub.id)}
                      className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-between pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Valor Mensal</span>
                    <span className="text-base font-display font-extrabold text-slate-900">R$ {sub.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block flex items-center justify-end gap-1">
                      <Calendar size={10} /> Dia de Cobrança
                    </span>
                    <span className="text-xs font-bold text-slate-700">Dia {sub.billingDate}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-slate-400">Responsável:</span>
                  <span className="px-2 py-0.5 bg-slate-50 border border-slate-200/50 rounded-md font-bold text-slate-600">
                    {member ? member.name : 'Geral'}
                  </span>
                </div>
              </div>
            );
          })}

          {subscriptions.length === 0 && (
            <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200/60 flex flex-col items-center justify-center space-y-2">
              <CreditCard size={32} className="text-slate-300" />
              <p className="text-xs font-semibold text-slate-500">Nenhuma assinatura ativa encontrada.</p>
              <p className="text-[11px] text-slate-400">Adicione suas assinaturas recorrentes (Netflix, Academias, Internet) para receber alertas de débito!</p>
            </div>
          )}
        </div>
      ) : (
        /* Automation Rules List */
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden" id="rules-table">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/15 flex items-center gap-2">
            <Zap size={16} className="text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Regras de Categorização Automática</h3>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {automationRules.map((rule) => (
              <div key={rule.id} className="p-5 flex items-center justify-between hover:bg-slate-50/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Zap size={15} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
                      <span>Se</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded font-bold border border-slate-200/60">
                        {rule.conditionField === 'text_contains' && 'Nome contém'}
                        {rule.conditionField === 'amount_greater' && 'Valor maior que'}
                        {rule.conditionField === 'source_account' && 'Conta de Origem'}
                      </span>
                      <span>for</span>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold border border-indigo-100/60">
                        "{rule.conditionValue}"
                      </span>
                      <span>&rarr; Definir</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded font-bold border border-slate-200/60">
                        {rule.actionField === 'category' && 'Categoria'}
                        {rule.actionField === 'tag' && 'Tag'}
                        {rule.actionField === 'recurrence' && 'Recorrência'}
                      </span>
                      <span>como</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold border border-emerald-100/60">
                        "{rule.actionValue}"
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenRuleEdit(rule)}
                    className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => onDeleteRule(rule.id)}
                    className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {automationRules.length === 0 && (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-2">
                <Zap size={24} className="text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">Nenhuma regra inteligente configurada ainda.</p>
                <p className="text-[11px] text-slate-400">Crie regras para classificar de forma automática extratos bancários importados por OFX ou via Pluggy.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subscription Form Modal */}
      {isSubFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-display font-bold text-slate-900">
                {editingSub ? 'Editar Assinatura' : 'Nova Assinatura'}
              </h3>
              <button
                onClick={() => setIsSubFormOpen(false)}
                className="p-1 hover:bg-slate-50 text-slate-400 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Nome do Serviço</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Netflix, Academia"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 55.90"
                    value={subAmount}
                    onChange={(e) => setSubAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Frequência</label>
                  <select
                    value={subFreq}
                    onChange={(e) => setSubFreq(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Dia de Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    placeholder="Ex: 10"
                    value={subBillDate}
                    onChange={(e) => setSubBillDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Categoria de Lançamento</label>
                  <select
                    value={subCat}
                    onChange={(e) => setSubCat(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    {categories.filter(c => c.type === 'expense').map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Membro Responsável</label>
                  <select
                    value={subMember}
                    onChange={(e) => setSubMember(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    {familyMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="sub-notify"
                  checked={subNotify}
                  onChange={(e) => setSubNotify(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="sub-notify" className="font-semibold text-slate-600 select-none cursor-pointer">
                  Habilitar notificação / alerta automático antes da data de cobrança
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSubFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-colors cursor-pointer"
                >
                  Salvar Assinatura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription deletion confirmation dialog (Saves Section 1.4 associates launchings rule) */}
      {deletingSubId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-500 border-b border-slate-100 pb-2">
              <AlertCircle size={18} />
              <h3 className="text-sm font-display font-extrabold">Excluir Assinatura</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você gostaria de remover também os lançamentos e transações recorrentes passadas e futuras gerados e associados a esta assinatura?
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleConfirmSubDelete(true)}
                className="w-full px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Excluir Assinatura e Lançamentos Associados
              </button>
              <button
                onClick={() => handleConfirmSubDelete(false)}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Excluir Apenas a Assinatura (Manter Histórico)
              </button>
              <button
                onClick={() => setDeletingSubId(null)}
                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rule Form Modal */}
      {isRuleFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-display font-bold text-slate-900">
                {editingRule ? 'Editar Regra Inteligente' : 'Nova Regra Inteligente'}
              </h3>
              <button
                onClick={() => setIsRuleFormOpen(false)}
                className="p-1 hover:bg-slate-50 text-slate-400 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRuleSubmit} className="space-y-4 text-xs">
              <div className="space-y-3">
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CONDIÇÃO (GATILHO)</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Campo Condicional</label>
                    <select
                      value={condField}
                      onChange={(e) => setCondField(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                    >
                      <option value="text_contains">Nome Contém</option>
                      <option value="amount_greater">Valor Maior Que</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Valor do Filtro</label>
                    <input
                      type="text"
                      required
                      placeholder={condField === 'amount_greater' ? 'Ex: 1000' : 'Ex: Uber, IFood'}
                      value={condVal}
                      onChange={(e) => setCondVal(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">AÇÃO (RESULTADO AUTOMÁTICO)</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Campo de Ação</label>
                    <select
                      value={actField}
                      onChange={(e) => {
                        setActField(e.target.value as any);
                        setActVal('');
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                    >
                      <option value="category">Definir Categoria</option>
                      <option value="tag">Definir Tag (#)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Valor Atribuído</label>
                    {actField === 'category' ? (
                      <select
                        value={actVal}
                        onChange={(e) => setActVal(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                      >
                        <option value="">Selecione...</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="Ex: Viagem, Pedro"
                        value={actVal}
                        onChange={(e) => setActVal(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRuleFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-colors cursor-pointer"
                >
                  Salvar Regra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
