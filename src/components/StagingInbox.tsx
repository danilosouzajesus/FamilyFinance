import React, { useState, useMemo } from 'react';
import { Inbox, CheckCircle2, XCircle, Pencil, Tag, CreditCard, Calendar, ChevronDown, ChevronUp, Search, Filter } from 'lucide-react';
import { Transaction, Category, CreditCard as CreditCardType, Invoice } from '../types';
import { invoiceStatusLabel } from '../utils/invoiceEngine';

interface StagingInboxProps {
  transactions: Transaction[];
  categories: Category[];
  creditCards?: CreditCardType[];
  invoices?: Invoice[];
  familyMembers: { id: string; name: string }[];
  isPrivateMode?: boolean;
  onEditTransaction: (id: string, updatedFields: Partial<Transaction>, scope: 'only_this' | 'from_now' | 'all') => void;
  onDeleteTransaction: (id: string, scope: 'only_this' | 'from_now' | 'all') => void;
  onAddTransaction: (txData: Omit<Transaction, 'id'>) => void;
}

type StageTab = 'pending' | 'approved' | 'discarded';

export default function StagingInbox({
  transactions,
  categories,
  creditCards = [],
  invoices = [],
  familyMembers,
  isPrivateMode = false,
  onEditTransaction,
  onDeleteTransaction,
  onAddTransaction
}: StagingInboxProps) {
  const [activeTab, setActiveTab] = useState<StageTab>('pending');
  const [filterCard, setFilterCard] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [newCategoryId, setNewCategoryId] = useState('');

  const cardTxs = useMemo(() => transactions.filter(t => !t.deleted_at && t.creditCardId), [transactions]);

  const pendingTxs = useMemo(() => cardTxs.filter(t => t.status === 'PENDENTE'), [cardTxs]);
  const approvedTxs = useMemo(() => cardTxs.filter(t => t.status === 'REALIZADO'), [cardTxs]);
  const discardedTxs = useMemo(() => transactions.filter(t => t.deleted_at && t.creditCardId), [transactions]);

  const cardById = (id?: string) => creditCards.find(c => c.id === id);
  const invoiceById = (id?: string) => invoices.find(i => i.id === id);

  const applyFilters = (list: Transaction[]) =>
    list.filter(t => {
      const matchesCard = filterCard === 'all' || t.creditCardId === filterCard;
      const matchesSearch = !search || (t.notes || '').toLowerCase().includes(search.toLowerCase()) || (t.category || '').toLowerCase().includes(search.toLowerCase());
      return matchesCard && matchesSearch;
    });

  const visibleTxs = activeTab === 'pending' ? applyFilters(pendingTxs)
    : activeTab === 'approved' ? applyFilters(approvedTxs)
    : discardedTxs;

  const totalPending = pendingTxs.reduce((s, t) => s + t.amount, 0);
  const totalApproved = approvedTxs.reduce((s, t) => s + t.amount, 0);

  const handleClassify = (tx: Transaction) => {
    const cat = categories.find(c => c.id === newCategoryId);
    const catName = cat?.name || tx.category;
    const subcatName = cat?.name === tx.category ? tx.subcategory : '';
    onEditTransaction(tx.id, {
      categoryId: newCategoryId || tx.categoryId,
      category: catName,
      subcategory: subcatName,
      status: 'REALIZADO',
    }, 'only_this');
    setClassifyingId(null);
    setNewCategoryId('');
  };

  const handleApprove = (tx: Transaction) => {
    onEditTransaction(tx.id, { status: 'REALIZADO' }, 'only_this');
  };

  const handleDiscard = (tx: Transaction) => {
    if (window.confirm(`Descartar "${tx.notes || tx.category}"? O item será removido da fatura.`)) {
      onDeleteTransaction(tx.id, 'only_this');
    }
  };

  const monthLabel = (inv?: Invoice) => inv ? `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][inv.month - 1]}/${inv.year}` : '';

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden" id="staging-inbox">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <Inbox size={20} />
          </span>
          <div>
            <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Caixa de Entrada de Compras no Cartão</h1>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">
              Classifique, aprove ou descarte os lançamentos pendentes do cartão de crédito
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Aguardando aprovação</span>
          <span className="text-2xl font-black text-amber-600">
            {isPrivateMode ? 'R$ ***' : `R$ ${totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </span>
          <span className="block text-[10px] text-slate-400 font-semibold">{pendingTxs.length} lançamento(s)</span>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {([
            { key: 'pending', label: `Pendentes (${pendingTxs.length})`, color: 'amber' },
            { key: 'approved', label: `Aprovados (${approvedTxs.length})`, color: 'emerald' },
            { key: 'discarded', label: `Descartados (${discardedTxs.length})`, color: 'slate' },
          ] as { key: StageTab; label: string; color: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                activeTab === tab.key
                  ? tab.color === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : tab.color === 'emerald' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
              id={`staging-tab-${tab.key}`}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-40 pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="relative">
              <Filter size={13} className="absolute left-2.5 top-2 text-slate-400" />
              <select
                value={filterCard}
                onChange={(e) => setFilterCard(e.target.value)}
                className="w-44 pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                id="staging-filter-card"
              >
                <option value="all">Todos os cartões</option>
                {creditCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      {visibleTxs.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-200 text-center">
          <Inbox size={36} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">Nenhum lançamento nesta etapa</p>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {activeTab === 'pending'
              ? 'Compras no cartão com status "Pendente" aparecem aqui para aprovação.'
              : activeTab === 'approved'
              ? 'Compras aprovadas (REALIZADO) aparecem aqui.'
              : 'Compras descartadas aparecem aqui (soft delete).'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleTxs.map(tx => {
            const card = cardById(tx.creditCardId);
            const inv = invoiceById(tx.invoiceId);
            const isExpanded = expandedId === tx.id;
            const isClassifying = classifyingId === tx.id;
            return (
              <div key={tx.id} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.status === 'REALIZADO' ? 'bg-emerald-100 text-emerald-600'
                    : tx.deleted_at ? 'bg-slate-100 text-slate-400'
                    : 'bg-amber-100 text-amber-600'
                  }`}>
                    <CreditCard size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 truncate">{tx.notes || tx.category}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        tx.status === 'REALIZADO' ? 'bg-emerald-50 text-emerald-600'
                        : tx.deleted_at ? 'bg-slate-100 text-slate-500'
                        : 'bg-amber-50 text-amber-600'
                      }`}>
                        {tx.deleted_at ? 'DESCARTADO' : tx.status === 'REALIZADO' ? 'APROVADO' : 'PENDENTE'}
                      </span>
                      {tx.totalInstallments && tx.totalInstallments > 1 && (
                        <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                          {tx.installmentNumber}/{tx.totalInstallments}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold mt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Tag size={10} /> {tx.category}{tx.subcategory ? ` / ${tx.subcategory}` : ''}</span>
                      {card && <span className="inline-flex items-center gap-1"><CreditCard size={10} /> {card.name}</span>}
                      {inv && <span className="inline-flex items-center gap-1"><Calendar size={10} /> Fatura {monthLabel(inv)} • {invoiceStatusLabel[inv.status]}</span>}
                      <span>{new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-slate-800">
                      {isPrivateMode ? 'R$ ***' : `R$ ${tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {!tx.deleted_at && (
                  <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
                    {tx.status === 'PENDENTE' && (
                      <button
                        onClick={() => handleApprove(tx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        id={`staging-approve-${tx.id}`}
                      >
                        <CheckCircle2 size={13} /> Aprovar
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (isClassifying) { handleClassify(tx); } else {
                          setClassifyingId(tx.id);
                          setNewCategoryId(tx.categoryId);
                          setExpandedId(tx.id);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      id={`staging-classify-${tx.id}`}
                    >
                      <Pencil size={13} /> {isClassifying ? 'Salvar categoria' : 'Classificar'}
                    </button>
                    <button
                      onClick={() => handleDiscard(tx)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      id={`staging-discard-${tx.id}`}
                    >
                      <XCircle size={13} /> Descartar
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                      className="ml-auto p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                )}

                {isClassifying && (
                  <div className="px-4 pb-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Categoria</label>
                      <select
                        value={newCategoryId}
                        onChange={(e) => setNewCategoryId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                        id={`staging-category-${tx.id}`}
                      >
                        <option value="">-- Manter atual --</option>
                        {categories.filter(c => !c.parentId && c.type === 'expense').map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {isExpanded && !isClassifying && (
                  <div className="px-4 pb-4 text-[10px] text-slate-400 font-medium space-y-0.5 border-t border-slate-50 pt-3">
                    <div><b className="text-slate-600">Membro:</b> {familyMembers.find(m => m.id === tx.memberId)?.name || '—'}</div>
                    <div><b className="text-slate-600">ID:</b> {tx.id}</div>
                    {tx.pluggyTransactionId && <div><b className="text-slate-600">Origem Pluggy:</b> {tx.pluggyTransactionId}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}