import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Edit2, 
  Tag, 
  Paperclip, 
  X, 
  Calendar,
  DollarSign,
  User,
  CreditCard,
  Grid,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Transaction, Category, Account, FamilyMember, RecurrenceType, TransactionType } from '../types';

interface TransactionsManagerProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  familyMembers: FamilyMember[];
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  onEditTransaction: (id: string, transaction: Partial<Transaction>, scope: 'only_this' | 'all') => void;
  onDeleteTransaction: (id: string, scope: 'only_this' | 'all') => void;
}

export default function TransactionsManager({
  transactions,
  categories,
  accounts,
  familyMembers,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction
}: TransactionsManagerProps) {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // UI States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Recurrence confirmation states
  const [recurrenceAction, setRecurrenceAction] = useState<{
    type: 'edit' | 'delete';
    transactionId: string;
    pendingData?: Partial<Transaction>;
  } | null>(null);

  // Form Fields
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurring, setRecurring] = useState<RecurrenceType>('none');
  const [notes, setNotes] = useState('');
  const [memberId, setMemberId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  // Form Validations & Errors
  const [validationError, setValidationError] = useState<string | null>(null);

  // Attachment File Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Open Form for Adding
  const handleOpenAddForm = () => {
    setEditingTransaction(null);
    setType('expense');
    setCategory(categories.find(c => c.type === 'expense')?.name || '');
    setSubcategory('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setRecurring('none');
    setNotes('');
    setMemberId(familyMembers[0]?.id || '');
    setAccountId(accounts[0]?.id || '');
    setTags([]);
    setAttachmentName('');
    setValidationError(null);
    setIsFormOpen(true);
  };

  // Open Form for Editing
  const handleOpenEditForm = (t: Transaction) => {
    setEditingTransaction(t);
    setType(t.type);
    setCategory(t.category);
    setSubcategory(t.subcategory);
    setAmount(t.amount.toString());
    setDate(t.date);
    setRecurring(t.recurring);
    setNotes(t.notes);
    setMemberId(t.memberId);
    setAccountId(t.accountId);
    setTags(t.tags);
    setAttachmentName(t.attachmentName || '');
    setValidationError(null);
    setIsFormOpen(true);
  };

  // Add tag to list
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentTag.trim()) {
      e.preventDefault();
      if (!tags.includes(currentTag.trim())) {
        setTags([...tags, currentTag.trim()]);
      }
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Simulated File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachmentName(file.name);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachmentName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setValidationError('O valor deve ser maior que zero.');
      return;
    }
    if (!category) {
      setValidationError('A categoria é obrigatória.');
      return;
    }
    if (!date) {
      setValidationError('A data informada é inválida.');
      return;
    }

    const transactionData = {
      type,
      category,
      subcategory,
      tags,
      amount: parsedAmount,
      date,
      recurring,
      notes,
      memberId,
      accountId,
      attachmentName: attachmentName || undefined,
    };

    if (editingTransaction) {
      // Is it a recurring transaction? If so, ask scope
      if (editingTransaction.recurring !== 'none' || recurring !== 'none') {
        setRecurrenceAction({
          type: 'edit',
          transactionId: editingTransaction.id,
          pendingData: transactionData
        });
        setIsFormOpen(false);
      } else {
        // Plain edit
        onEditTransaction(editingTransaction.id, transactionData, 'only_this');
        setIsFormOpen(false);
      }
    } else {
      // Create new
      onAddTransaction(transactionData);
      setIsFormOpen(false);
    }
  };

  // Delete Click
  const handleDeleteClick = (id: string, isRecurring: boolean) => {
    if (isRecurring) {
      setRecurrenceAction({
        type: 'delete',
        transactionId: id
      });
    } else {
      if (window.confirm('Tem certeza de que deseja excluir esta transação?')) {
        onDeleteTransaction(id, 'only_this');
      }
    }
  };

  // Confirm Recurrence Choice
  const handleRecurrenceScopeConfirm = (scope: 'only_this' | 'all') => {
    if (!recurrenceAction) return;

    if (recurrenceAction.type === 'edit' && recurrenceAction.pendingData) {
      onEditTransaction(recurrenceAction.transactionId, recurrenceAction.pendingData, scope);
    } else if (recurrenceAction.type === 'delete') {
      onDeleteTransaction(recurrenceAction.transactionId, scope);
    }

    setRecurrenceAction(null);
  };

  // List Filtering Logic
  const filteredTransactions = transactions.filter(t => {
    // 1. Search term match
    const matchesSearch = 
      t.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subcategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    // 2. Type filter
    const matchesType = filterType === 'all' || t.type === filterType;

    // 3. Category filter
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;

    // 4. Account filter
    const matchesAccount = filterAccount === 'all' || t.accountId === filterAccount;

    // 5. Member filter
    const matchesMember = filterMember === 'all' || t.memberId === filterMember;

    // 6. Date Range filter
    const matchesStartDate = !filterStartDate || t.date >= filterStartDate;
    const matchesEndDate = !filterEndDate || t.date <= filterEndDate;

    return matchesSearch && matchesType && matchesCategory && matchesAccount && matchesMember && matchesStartDate && matchesEndDate;
  });

  // Selected Category Object to list correct subcategories
  const selectedCategoryObj = categories.find(c => c.name === category);

  return (
    <div className="space-y-6" id="tx-manager-container">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Controle de Despesas e Receitas</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Gerencie os fluxos monetários da sua família de forma granular</p>
        </div>
        <button
          onClick={handleOpenAddForm}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
          id="add-tx-btn"
        >
          <Plus size={16} /> Nova Transação
        </button>
      </div>

      {/* Advanced Filter Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Filter size={16} className="text-indigo-600" />
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Painel de Busca e Filtros Avançados</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Keyword Search */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Pesquisar por termo</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex: Supermercado, bônus, Pedro..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                id="search-input-field"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Tipo</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              id="filter-type-select"
            >
              <option value="all">Todas as transações</option>
              <option value="income">Apenas Receitas (+)</option>
              <option value="expense">Apenas Despesas (-)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Categoria</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              id="filter-category-select"
            >
              <option value="all">Todas as categorias</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Account Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Conta de Origem/Destino</label>
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              id="filter-account-select"
            >
              <option value="all">Todas as contas</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Member Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Membro da Família</label>
            <select
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              id="filter-member-select"
            >
              <option value="all">Todos os membros</option>
              {familyMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Data Inicial</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              id="filter-start-date"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Data Final</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              id="filter-end-date"
            />
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterType('all');
                setFilterCategory('all');
                setFilterAccount('all');
                setFilterMember('all');
                setFilterStartDate('');
                setFilterEndDate('');
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              id="clear-filters-btn"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Grid/Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transações Encontradas ({filteredTransactions.length})</h3>
          <span className="text-xs text-slate-400 font-semibold">Mostrando itens filtrados</span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <AlertCircle size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold">Nenhuma transação atende aos filtros atuais.</p>
            <p className="text-xs text-slate-400 mt-1">Experimente buscar por outros termos ou limpar os filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse" id="txs-table">
              <thead>
                <tr className="border-b border-slate-50 text-left">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descrição / Observações</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Membro</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conta</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoria / Subcat</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frequência</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((t) => {
                  const member = familyMembers.find(m => m.id === t.memberId);
                  const account = accounts.find(a => a.id === t.accountId);
                  const categoryObj = categories.find(c => c.name === t.category);

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Date */}
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString('pt-BR')}
                      </td>
                      {/* Description / Notes */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-800 block">
                            {t.notes || t.category}
                          </span>
                          {/* Tags block */}
                          {t.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {t.tags.map((tag, i) => (
                                <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[9px] font-semibold">
                                  <Tag size={8} /> {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Attachment Indicator */}
                          {t.attachmentName && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-500 font-semibold bg-indigo-50/40 px-1.5 py-0.5 rounded">
                              <Paperclip size={10} /> {t.attachmentName}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Member */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-50 text-[10px] font-bold text-slate-600 border border-slate-100">
                          <User size={10} /> {member?.name || 'Geral'}
                        </span>
                      </td>
                      {/* Account */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${account?.color || 'bg-slate-500'}`} />
                          {account?.name || 'N/A'}
                        </span>
                      </td>
                      {/* Category */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span 
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white"
                            style={{ backgroundColor: categoryObj?.color || '#3B82F6' }}
                          >
                            {t.category}
                          </span>
                          {t.subcategory && (
                            <span className="text-[10px] text-slate-400 font-semibold block ml-1">
                              &bull; {t.subcategory}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Recurrence */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                        {t.recurring === 'none' && 'Única'}
                        {t.recurring === 'weekly' && 'Semanal'}
                        {t.recurring === 'monthly' && 'Mensal'}
                        {t.recurring === 'yearly' && 'Anual'}
                      </td>
                      {/* Amount */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-xs font-bold ${
                          t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'
                        }`}>
                          {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditForm(t)}
                            className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-colors cursor-pointer"
                            title="Editar"
                            id={`edit-tx-btn-${t.id}`}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(t.id, t.recurring !== 'none')}
                            className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-rose-600 hover:bg-rose-50 hover:border-rose-100 transition-colors cursor-pointer"
                            title="Excluir"
                            id={`delete-tx-btn-${t.id}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recurring Transaction Decision Modal Prompt */}
      {recurrenceAction && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Transação Recorrente</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Esta transação faz parte de um ciclo recorrente. Como você deseja aplicar a ação de{' '}
                  <span className="font-bold text-indigo-600">
                    {recurrenceAction.type === 'edit' ? 'Edição' : 'Exclusão'}
                  </span>
                  ?
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleRecurrenceScopeConfirm('only_this')}
                className="p-3 border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/20 rounded-xl text-xs font-bold text-slate-700 text-left transition-colors cursor-pointer"
                id="scope-only-this-btn"
              >
                Apenas esta ocorrência
                <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                  Aplica a alteração estritamente à ocorrência selecionada.
                </span>
              </button>

              <button
                onClick={() => handleRecurrenceScopeConfirm('all')}
                className="p-3 border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/20 rounded-xl text-xs font-bold text-slate-700 text-left transition-colors cursor-pointer"
                id="scope-all-btn"
              >
                Todas as ocorrências
                <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                  Aplica a alteração a esta e a todas as ocorrências futuras.
                </span>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setRecurrenceAction(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600"
                id="cancel-scope-btn"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inclusão / Edição Slide-over Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-end">
          <div className="bg-white h-full max-w-lg w-full shadow-2xl border-l border-slate-200 flex flex-col justify-between" id="tx-form-container">
            {/* Form Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/25">
              <div>
                <h3 className="text-sm font-display font-extrabold text-slate-900 uppercase tracking-wider">
                  {editingTransaction ? 'Editar Transação' : 'Nova Transação'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">Insira os detalhes abaixo para contabilização</p>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                id="close-tx-form-btn"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {validationError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Type Switcher */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Transação</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType('expense');
                      setCategory(categories.find(c => c.type === 'expense')?.name || '');
                    }}
                    className={`py-2 px-4 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                      type === 'expense'
                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    id="tx-form-type-expense"
                  >
                    Despesa (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('income');
                      setCategory(categories.find(c => c.type === 'income')?.name || '');
                    }}
                    className={`py-2 px-4 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                      type === 'income'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    id="tx-form-type-income"
                  >
                    Receita (+)
                  </button>
                </div>
              </div>

              {/* Amount and Date row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor (R$)*</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                      id="tx-form-amount"
                    />
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data*</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                      id="tx-form-date"
                    />
                  </div>
                </div>
              </div>

              {/* Category and Subcategory row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Category Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoria*</label>
                  <select
                    value={category}
                    required
                    onChange={(e) => {
                      setCategory(e.target.value);
                      const catObj = categories.find(c => c.name === e.target.value);
                      setSubcategory(catObj && catObj.subcategories.length > 0 ? catObj.subcategories[0] : '');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                    id="tx-form-category"
                  >
                    {categories.filter(c => c.type === type).map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Subcategory selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subcategoria</label>
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                    id="tx-form-subcategory"
                  >
                    <option value="">Nenhuma</option>
                    {selectedCategoryObj?.subcategories.map((sub, i) => (
                      <option key={i} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Accounts & Members row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Account */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conta / Cartão</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                    id="tx-form-account"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                {/* Family Member */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Membro Responsável</label>
                  <select
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                    id="tx-form-member"
                  >
                    {familyMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Recurrence Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recorrência / Repetição</label>
                <select
                  value={recurring}
                  onChange={(e) => setRecurring(e.target.value as RecurrenceType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                  id="tx-form-recurrence"
                >
                  <option value="none">Transação Única (Não se repete)</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>

              {/* Tags Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tags / Marcadores (Pressione Enter para adicionar)</label>
                <div className="space-y-2">
                  <div className="relative">
                    <Tag className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input
                      type="text"
                      value={currentTag}
                      onChange={(e) => setCurrentTag(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder="Adicione marcadores (ex: Carro, Viagem, Pedro)"
                      className="w-full pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                      id="tx-form-tag-input"
                    />
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 bg-slate-50 p-2 border border-slate-100 rounded-xl">
                      {tags.map((tag, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-xs font-semibold">
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="p-0.5 hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 rounded-full cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* File Attachment Upload */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nota Fiscal / Comprovante (Anexo)</label>
                <div className="border-2 border-dashed border-slate-200 p-4 rounded-xl text-center space-y-2 hover:border-indigo-500 transition-colors">
                  <Paperclip size={24} className="mx-auto text-slate-400" />
                  <div className="text-xs text-slate-500">
                    {attachmentName ? (
                      <div className="flex items-center justify-center gap-2 font-semibold text-indigo-600">
                        <span>{attachmentName}</span>
                        <button
                          type="button"
                          onClick={handleRemoveAttachment}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Remover arquivo"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                          Selecione um arquivo
                        </button>{' '}
                        ou arraste para cá
                        <span className="block text-[10px] text-slate-400 mt-1">Formatos suportados: PNG, JPG, PDF (Max 5MB)</span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,.pdf"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Observações / Comentários</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais da transação..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  id="tx-form-notes"
                />
              </div>
            </form>

            {/* Form Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/25 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                id="cancel-tx-form-btn"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
                id="save-tx-form-btn"
              >
                Salvar Transação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
