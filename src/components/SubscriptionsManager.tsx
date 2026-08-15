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
  Layers,
  Repeat,
  History,
  HandCoins
} from 'lucide-react';
import { Subscription, AutomationRule, Category, FamilyMember, Transaction, Account } from '../types';

interface SubscriptionsManagerProps {
  subscriptions: Subscription[];
  automationRules: AutomationRule[];
  categories: Category[];
  familyMembers: FamilyMember[];
  transactions: Transaction[];
  accounts?: Account[];
  isPrivateMode?: boolean;
  onAddSubscription: (sub: Omit<Subscription, 'id'>, retroactiveMonths?: number) => void;
  onEditSubscription: (id: string, updated: Partial<Subscription>) => void;
  onEditSubscriptionWithScope: (id: string, updated: Partial<Subscription>, scope: 'from_next' | 'history') => void;
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
  transactions,
  accounts = [],
  isPrivateMode = false,
  onAddSubscription,
  onEditSubscription,
  onEditSubscriptionWithScope,
  onDeleteSubscription,
  onAddRule,
  onEditRule,
  onDeleteRule
}: SubscriptionsManagerProps) {
  const [activeTab, setActiveTab] = useState<'subs' | 'rules'>('subs');
  const [showRenegotiation, setShowRenegotiation] = useState(false);

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
  const [subPayment, setSubPayment] = useState<'credit_card' | 'debit' | 'pix' | 'boleto'>('credit_card');
  const [subNotifyChannel, setSubNotifyChannel] = useState<'push' | 'email' | 'whatsapp'>('push');
  const [subNotifyDays, setSubNotifyDays] = useState('3');
  const [subAccountId, setSubAccountId] = useState('');
  const [editScope, setEditScope] = useState<'from_next' | 'history'>('from_next');
  const [retroactiveMonths, setRetroactiveMonths] = useState<number>(0);

  // Deletion modal states
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);

  // Automation Rules states
  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [condField, setCondField] = useState<'text_contains' | 'amount_greater' | 'source_account'>('text_contains');
  const [condVal, setCondVal] = useState('');
  const [actField, setActField] = useState<'category' | 'subcategory' | 'tag' | 'recurrence' | 'mark_paid'>('category');
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
    setSubPayment('credit_card');
    setSubNotifyChannel('push');
    setSubNotifyDays('3');
    setSubAccountId(accounts[0]?.id || '');
    setEditScope('from_next');
    setRetroactiveMonths(0);
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
    setSubPayment(sub.paymentMethod || 'credit_card');
    setSubNotifyChannel(sub.notifyChannel || 'push');
    setSubNotifyDays(String(sub.notifyDays ?? 3));
    setSubAccountId(sub.accountId || accounts[0]?.id || '');
    setEditScope('from_next');
    setRetroactiveMonths(0);
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

    const parsedNotifyDays = parseInt(subNotifyDays);
    if (isNaN(parsedNotifyDays) || parsedNotifyDays < 0 || parsedNotifyDays > 30) {
      alert('Informe um número de dias de antecedência entre 0 e 30.');
      return;
    }

    const payload = {
      name: subName.trim(),
      amount: parsedAmount,
      frequency: subFreq,
      category: subCat,
      billingDate: subBillDate,
      autoNotify: subNotify,
      memberId: subMember,
      paymentMethod: subPayment,
      notifyChannel: subNotifyChannel,
      notifyDays: parsedNotifyDays,
      accountId: subAccountId || undefined
    };

    if (editingSub) {
      const amountChanged = parsedAmount !== editingSub.amount;
      const dateChanged = subBillDate !== editingSub.billingDate;
      if (amountChanged || dateChanged) {
        onEditSubscriptionWithScope(editingSub.id, payload, editScope);
      } else {
        onEditSubscription(editingSub.id, payload);
      }
    } else {
      onAddSubscription(payload, retroactiveMonths);
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

  // 1.4 Renegotiation Intelligence: annual cost per subscription + suggestions
  const annualCost = (sub: Subscription): number => {
    switch (sub.frequency) {
      case 'yearly': return sub.amount;
      case 'weekly': return sub.amount * 52;
      default: return sub.amount * 12;
    }
  };

  const totalAnnualSubs = subscriptions.reduce((sum, s) => sum + annualCost(s), 0);

  // Total actually paid with subscriptions over the last 12 months (from transactions)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const subscriptionSpend = transactions
    .filter(t => !t.deleted_at && t.type === 'expense' && new Date(t.date) >= twelveMonthsAgo)
    .filter(t => subscriptions.some(s => t.notes.toLowerCase().includes(s.name.toLowerCase())))
    .reduce((sum, t) => sum + t.amount, 0);

  // Heuristic for cancellation candidates: notifications disabled (low priority) or very low cost
  const cancellationCandidates = subscriptions.filter(s => {
    if (!s.autoNotify) return true;
    if (annualCost(s) < 120) return true; // < R$10/mês → baixo valor, avaliar uso
    return false;
  });

  const PAYMENT_LABELS: Record<string, string> = {
    credit_card: 'Cartão de Crédito',
    debit: 'Débito Automático',
    pix: 'Pix',
    boleto: 'Boleto'
  };
  const CHANNEL_LABELS: Record<string, string> = {
    push: 'Push',
    email: 'E-mail',
    whatsapp: 'WhatsApp'
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
        <>
        {/* 1.4 Renegotiation Intelligence Panel */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm" id="renegotiation-panel">
          <button
            onClick={() => setShowRenegotiation(prev => !prev)}
            className="w-full flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <HandCoins size={16} />
              </div>
              <div className="text-left">
                <h3 className="text-xs font-display font-bold text-slate-900">Inteligência de Renegociação</h3>
                <p className="text-[10px] text-slate-400 font-semibold">Total acumulado por ano com assinaturas + sugestões de cancelamento</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[9px] text-slate-400 font-bold uppercase block">Custo anual</span>
                <span className="text-sm font-display font-extrabold text-amber-600">{isPrivateMode ? 'R$ ***' : `R$ ${totalAnnualSubs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
              </div>
              <span className="text-xs text-slate-400">{showRenegotiation ? '▲' : '▼'}</span>
            </div>
          </button>

          {showRenegotiation && (
            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/80">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Custo anual consolidado (assinaturas)</span>
                  <span className="text-lg font-display font-extrabold text-slate-900">{isPrivateMode ? 'R$ ***' : `R$ ${totalAnnualSubs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
                  <p className="text-[9px] text-slate-400 mt-0.5">Calculado a partir da frequência e valor de cada assinatura.</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/80">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Pago com assinaturas (12 meses)</span>
                  <span className="text-lg font-display font-extrabold text-slate-900">{isPrivateMode ? 'R$ ***' : `R$ ${subscriptionSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
                  <p className="text-[9px] text-slate-400 mt-0.5">Soma dos lançamentos vinculados a assinaturas no último ano.</p>
                </div>
              </div>

              {cancellationCandidates.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle size={11} className="text-amber-500" /> Sugestões de revisão / possível cancelamento
                  </h4>
                  {cancellationCandidates.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-amber-600" />
                        <div>
                          <span className="text-xs font-bold text-slate-700">{s.name}</span>
                          <span className="block text-[9px] text-slate-400">
                            {isPrivateMode ? 'R$ ***' : `R$ ${s.amount.toFixed(2)}`}/{s.frequency === 'yearly' ? 'ano' : s.frequency === 'weekly' ? 'semana' : 'mês'}
                            {!s.autoNotify ? ' • notificações desativadas' : ''}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700">{isPrivateMode ? 'R$ ***' : `R$ ${annualCost(s).toFixed(2)}/ano`}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 font-semibold">Nenhuma assinatura candidata a cancelamento no momento. Continue usando as notificações para manter o controle.</p>
              )}
            </div>
          )}
        </div>

        {/* Subscriptions Dashboard Grid */}
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
                    <span className="text-base font-display font-extrabold text-slate-900">{isPrivateMode ? 'R$ ***' : `R$ ${sub.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block flex items-center justify-end gap-1">
                      <Calendar size={10} /> Dia de Cobrança
                    </span>
                    <span className="text-xs font-bold text-slate-700">Dia {sub.billingDate}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-400">Forma de Pagamento:</span>
                    <span className="px-2 py-0.5 bg-slate-50 border border-slate-200/50 rounded-md font-bold text-slate-600">
                      {PAYMENT_LABELS[sub.paymentMethod || 'credit_card']}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-400">Notificação:</span>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border ${
                      sub.autoNotify
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                        : 'bg-slate-50 border-slate-200/50 text-slate-400'
                    }`}>
                      <Bell size={9} />
                      {sub.autoNotify
                        ? `${CHANNEL_LABELS[sub.notifyChannel || 'push']} • ${sub.notifyDays ?? 3} dias antes`
                        : 'Desativada'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-400">Responsável:</span>
                    <span className="px-2 py-0.5 bg-slate-50 border border-slate-200/50 rounded-md font-bold text-slate-600">
                      {member ? member.name : 'Geral'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-400">Custo anual estimado:</span>
                    <span className="font-bold text-slate-700">{isPrivateMode ? 'R$ ***' : `R$ ${annualCost(sub).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
                  </div>
                  {sub.accountId && (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-400">Conta de débito:</span>
                      <span className="px-2 py-0.5 bg-slate-50 border border-slate-200/50 rounded-md font-bold text-slate-600">
                        {accounts.find(a => a.id === sub.accountId)?.name || sub.accountId}
                      </span>
                    </div>
                  )}
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
        </>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Forma de Pagamento</label>
                  <select
                    value={subPayment}
                    onChange={(e) => setSubPayment(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="credit_card">Cartão de Crédito</option>
                    <option value="debit">Débito Automático</option>
                    <option value="pix">Pix</option>
                    <option value="boleto">Boleto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Canal de Notificação</label>
                  <select
                    value={subNotifyChannel}
                    onChange={(e) => setSubNotifyChannel(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="push">Push Notification</option>
                    <option value="email">E-mail</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Conta de Débito das Mensalidades</label>
                <select
                  required
                  value={subAccountId}
                  onChange={(e) => setSubAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                >
                  <option value="" disabled>Selecione a conta</option>
                  {accounts.filter(a => a.type !== 'credit').map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 mt-1">Cada mensalidade lançada gera uma despesa nesta conta (extrato geral).</p>
                {accounts.filter(a => a.type !== 'credit').length === 0 && (
                  <p className="text-[9px] text-amber-600 font-semibold mt-1">Cadastre uma conta corrente, dinheiro ou investimento para debitar as mensalidades.</p>
                )}
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Dias de Antecedência para Aviso</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  required
                  placeholder="Ex: 3"
                  value={subNotifyDays}
                  onChange={(e) => setSubNotifyDays(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {!editingSub && (
                <div className="p-3.5 bg-indigo-50/50 border border-indigo-100/80 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-bold">
                    <Calendar size={14} className="text-indigo-600" />
                    <span>Lançamentos Retroativos</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Deseja preencher seu histórico de transações gerando cobranças anteriores automaticamente?
                  </p>
                  <select
                    value={retroactiveMonths}
                    onChange={(e) => setRetroactiveMonths(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-[11px] border border-indigo-200 rounded-lg bg-white font-bold text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value={0}>Não gerar lançamentos passados (Apenas agendar futuros)</option>
                    <option value={1}>Gerar para o mês anterior (1 lançamento)</option>
                    <option value={3}>Gerar para os últimos 3 meses (3 lançamentos)</option>
                    <option value={6}>Gerar para os últimos 6 meses (6 lançamentos)</option>
                    <option value={12}>Gerar para os últimos 12 meses (12 lançamentos)</option>
                  </select>
                </div>
              )}

              {editingSub && (
                <div className="p-3.5 bg-amber-50/50 border border-amber-100/80 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                    <Repeat size={14} className="text-amber-600" />
                    <span>Aplicar alteração de valor / data</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Deseja aplicar o novo valor/data a partir do próximo vencimento ou atualizar o histórico?
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <label className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${editScope === 'from_next' ? 'bg-white border-indigo-300' : 'border-slate-200 bg-white/50'}`}>
                      <input
                        type="radio"
                        name="edit-scope"
                        checked={editScope === 'from_next'}
                        onChange={() => setEditScope('from_next')}
                        className="text-indigo-600"
                      />
                      <span className="text-[11px] font-bold text-slate-700">Aplicar a partir do próximo vencimento</span>
                    </label>
                    <label className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${editScope === 'history' ? 'bg-white border-amber-300' : 'border-slate-200 bg-white/50'}`}>
                      <input
                        type="radio"
                        name="edit-scope"
                        checked={editScope === 'history'}
                        onChange={() => setEditScope('history')}
                        className="text-amber-600"
                      />
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <History size={11} className="text-amber-600" /> Atualizar o histórico (inclui lançamentos passados)
                      </span>
                    </label>
                  </div>
                </div>
              )}

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
                      <option value="source_account">Conta de Origem</option>
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
                      <option value="subcategory">Definir Subcategoria</option>
                      <option value="tag">Definir Tag (#)</option>
                      <option value="recurrence">Tornar Recorrente</option>
                      <option value="mark_paid">Marcar como Pago</option>
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
                    ) : actField === 'subcategory' ? (
                      <select
                        value={actVal}
                        onChange={(e) => setActVal(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                      >
                        <option value="">Selecione...</option>
                        {categories
                          .filter(c => c.type === 'expense')
                          .flatMap(c => (c.subcategories || []).map(name => ({ id: `${c.name}::${name}`, name })))
                          .map(sub => (
                            <option key={sub.id} value={sub.name}>{sub.name}</option>
                          ))}
                      </select>
                    ) : actField === 'recurrence' ? (
                      <select
                        value={actVal}
                        onChange={(e) => setActVal(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                      >
                        <option value="">Selecione...</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                        <option value="yearly">Anual</option>
                      </select>
                    ) : actField === 'mark_paid' ? (
                      <select
                        value={actVal}
                        onChange={(e) => setActVal(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                      >
                        <option value="">Selecione...</option>
                        <option value="REALIZADO">Sim, marcar como Pago (Realizado)</option>
                        <option value="PENDENTE">Não, manter como Pendente</option>
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
