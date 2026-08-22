import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Wallet,
  ArrowLeftRight,
  CheckSquare,
  Layers,
  Check
} from 'lucide-react';
import { Transaction, Category, Subcategory, Account, FamilyMember, RecurrenceType, TransactionType, Tag as TagType, CreditCard as CreditCardType, Invoice, PeriodPreference } from '@ff/shared';
import PeriodSelector from '@/components/PeriodSelector';
import { fetchAppPreference, saveAppPreference } from '@/lib/supabase';
import { assignInvoicePeriod, invoiceIdFor, buildInstallmentTransactions, invoiceStatusLabel, parseInvoiceId, dueDateFor } from '@ff/shared';

interface TransactionsManagerProps {
  transactions: Transaction[];
  categories: Category[];
  subcategories?: Subcategory[];
  accounts: Account[];
  familyMembers: FamilyMember[];
  allTags: TagType[];
  creditCards: CreditCardType[];
  invoices: Invoice[];
  isPrivateMode: boolean;
  onAddTag: (newTag: TagType) => Promise<void> | void;
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  onEditTransaction: (id: string, transaction: Partial<Transaction>, scope: 'only_this' | 'all') => void;
  onDeleteTransaction: (id: string, scope: 'only_this' | 'all') => void;
}

const DEFAULT_TAG_COLOR = '#6366F1';

function resolveTxTagNames(tagIds: string[], allTags: TagType[]): string[] {
  return tagIds
    .map(id => allTags.find(tag => tag.id === id)?.name || id)
    .filter((name): name is string => !!name);
}

export default function TransactionsManager({
  transactions,
  categories,
  subcategories = [],
  accounts,
  familyMembers,
  allTags,
  creditCards,
  invoices,
  onAddTag,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction
}: TransactionsManagerProps) {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string[]>([]);
  const [accountFilterOpen, setAccountFilterOpen] = useState(false);
  const [accountFilterSearch, setAccountFilterSearch] = useState('');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // UI States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);
  
  // Recurrence confirmation states
  const [recurrenceAction, setRecurrenceAction] = useState<{
    type: 'edit' | 'delete';
    transactionId: string;
    pendingData?: Partial<Transaction>;
  } | null>(null);

  // Form Fields
  const [type, setType] = useState<TransactionType | 'transfer'>('expense');
  const [destinationAccountId, setDestinationAccountId] = useState('');
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

  // Credit Card / Invoice form states
  const [creditCardId, setCreditCardId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [installments, setInstallments] = useState('1');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Multi-selection states
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Bulk Edit Form fields
  const [bulkCategory, setBulkCategory] = useState<string>('__keep__');
  const [bulkSubcategory, setBulkSubcategory] = useState<string>('__keep__');
  const [bulkAccountId, setBulkAccountId] = useState<string>('__keep__');
  const [bulkMemberId, setBulkMemberId] = useState<string>('__keep__');
  const [bulkApplyDate, setBulkApplyDate] = useState<boolean>(false);
  const [bulkDate, setBulkDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bulkStatus, setBulkStatus] = useState<string>('__keep__');
  const [bulkTag, setBulkTag] = useState<string>('');

  // Period (PeriodSelector) state
  const [periodPref, setPeriodPref] = useState<PeriodPreference | null>(null);
  const [periodRange, setPeriodRange] = useState<{ start: string; end: string } | null>(null);

  // Load saved period default from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    fetchAppPreference('transactions_period_default').then((v) => {
      if (!cancelled && v) setPeriodPref(v as PeriodPreference);
    });
    return () => { cancelled = true; };
  }, []);

  const handlePeriodApply = useCallback((start: string, end: string) => {
    setPeriodRange({ start, end });
  }, []);

  const handlePeriodSaveDefault = useCallback((pref: PeriodPreference) => {
    return saveAppPreference('transactions_period_default', pref);
  }, []);

  // Recompute the invoice whenever the credit card or purchase date changes
  useEffect(() => {
    const card = creditCards.find(c => c.id === creditCardId);
    if (card && date) {
      const { year, month } = assignInvoicePeriod(card, date);
      setInvoiceId(invoiceIdFor(card.id, year, month));
    }
  }, [creditCardId, date, creditCards]);

  // Form Validations & Errors
  const [validationError, setValidationError] = useState<string | null>(null);

  // Attachment File Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Memoized available categories for the currently active form type (income vs expense)
  const availableCategoriesForForm = useMemo(() => {
    return categories.filter(c => !c.parentId && (c.type === type || c.name.toLowerCase().includes('transferência') || c.name.toLowerCase().includes('transferencia')));
  }, [categories, type]);

  const selectedCategoryObj = useMemo(() => {
    return categories.find(c => c.name === category && c.type === type) 
      || categories.find(c => c.name === category);
  }, [categories, category, type]);

  const availableSubcategoriesForForm = useMemo(() => {
    if (!selectedCategoryObj) return [];
    const subsFromCat = selectedCategoryObj.subcategories || [];
    const subsFromTable = (subcategories || []).filter(s => s.categoryId === selectedCategoryObj.id).map(s => s.name);
    const subsFromChildren = categories.filter(c => c.parentId === selectedCategoryObj.id && c.type === type).map(c => c.name);
    return Array.from(new Set([...subsFromCat, ...subsFromTable, ...subsFromChildren].filter(Boolean)));
  }, [selectedCategoryObj, subcategories, categories, type]);

  // Open Form for Adding
  const handleOpenAddForm = () => {
    setEditingTransaction(null);
    setType('expense');
    const firstExpenseCat = categories.find(c => c.type === 'expense' && !c.parentId) || categories.find(c => c.type === 'expense');
    setCategory(firstExpenseCat?.name || '');
    const firstExpenseSub = firstExpenseCat?.subcategories?.[0]
      || subcategories.find(s => s.categoryId === firstExpenseCat?.id)?.name
      || categories.find(c => c.parentId === firstExpenseCat?.id && c.type === 'expense')?.name
      || '';
    setSubcategory(firstExpenseSub);
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setRecurring('none');
    setNotes('');
    setMemberId(familyMembers[0]?.id || '');
    setAccountId(accounts[0]?.id || '');
    setDestinationAccountId(accounts.find(a => a.id !== accounts[0]?.id)?.id || accounts[1]?.id || '');
    setTags([]);
    setAttachmentName('');
    setCreditCardId('');
    setInvoiceId('');
    setInstallments('1');
    setValidationError(null);
    setIsFormOpen(true);
  };

  // Open Form for Adding Transfer between accounts
  const handleOpenAddTransferForm = () => {
    setEditingTransaction(null);
    setType('transfer');
    const transfCat = categories.find(c => c.name.toLowerCase().includes('transferência') || c.name.toLowerCase().includes('transferencia'));
    setCategory(transfCat?.name || 'Transferências');
    const transfSub = subcategories.find(s => s.categoryId === transfCat?.id && s.name.toLowerCase().includes('entre contas'))
      || subcategories.find(s => s.categoryId === transfCat?.id);
    setSubcategory(transfSub?.name || 'Transferência entre Contas');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setRecurring('none');
    setNotes('');
    setMemberId(familyMembers[0]?.id || '');
    const defaultSourceId = accounts[0]?.id || '';
    setAccountId(defaultSourceId);
    setDestinationAccountId(accounts.find(a => a.id !== defaultSourceId)?.id || accounts[1]?.id || '');
    setTags([]);
    setAttachmentName('');
    setCreditCardId('');
    setInvoiceId('');
    setInstallments('1');
    setValidationError(null);
    setIsFormOpen(true);
  };

  // Open Form for Editing
  const handleOpenEditForm = (t: Transaction) => {
    setEditingTransaction(t);
    const isTransfCategory = (t.category || '').toLowerCase().includes('transferência') || (t.category || '').toLowerCase().includes('transferencia');
    setType(isTransfCategory ? 'transfer' : t.type);
    setCategory(t.category);
    setSubcategory(t.subcategory);
    setAmount(t.amount.toString());
    setDate(t.date);
    setRecurring(t.recurring);
    setNotes(t.notes);
    setMemberId(t.memberId);
    setAccountId(t.accountId);
    const otherAccount = accounts.find(a => a.id !== t.accountId)?.id || accounts[0]?.id || '';
    setDestinationAccountId(otherAccount);
    setTags(resolveTxTagNames(t.tagIds, allTags));
    setAttachmentName(t.attachmentNames?.[0] || '');
    setCreditCardId(t.creditCardId || '');
    setInvoiceId(t.invoiceId || '');
    setInstallments(t.totalInstallments?.toString() || '1');
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

    if (type === 'transfer') {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setValidationError('O valor deve ser maior que zero.');
        return;
      }
      if (!accountId) {
        setValidationError('Selecione a conta de origem.');
        return;
      }
      if (!destinationAccountId) {
        setValidationError('Selecione a conta de destino.');
        return;
      }
      if (accountId === destinationAccountId) {
        setValidationError('A conta de origem e a conta de destino devem ser diferentes.');
        return;
      }
      if (!date) {
        setValidationError('A data informada é inválida.');
        return;
      }

      const sourceAcc = accounts.find(a => a.id === accountId);
      const destAcc = accounts.find(a => a.id === destinationAccountId);
      const transfCat = categories.find(c => c.name.toLowerCase().includes('transferência') || c.name.toLowerCase().includes('transferencia'));
      const transfSub = subcategories.find(s => s.categoryId === transfCat?.id && s.name.toLowerCase().includes('entre contas'))
        || subcategories.find(s => s.categoryId === transfCat?.id);

      const tagIds = tags.map((name, i) => {
        const existing = allTags.find(t => t.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing.id;
        const newTag: TagType = { id: `tag_${Date.now()}_${i}`, name, color: DEFAULT_TAG_COLOR };
        if (onAddTag) onAddTag(newTag);
        return newTag.id;
      });

      if (editingTransaction) {
        // Atualiza a transação atual (origem)
        onEditTransaction(
          editingTransaction.id,
          {
            type: 'expense',
            categoryId: transfCat?.id || '',
            category: transfCat?.name || 'Transferências',
            subcategoryId: transfSub?.id,
            subcategory: transfSub?.name || 'Transferência entre Contas',
            tagIds,
            amount: parsedAmount,
            date,
            recurring,
            notes: notes ? `${notes} (Destino: ${destAcc?.name || 'Conta Destino'})` : `Transferência para ${destAcc?.name || 'Conta Destino'}`,
            memberId: memberId || familyMembers[0]?.id || 'mem_geral',
            accountId,
            attachmentUrls: attachmentName ? [attachmentName] : [],
            attachmentNames: attachmentName ? [attachmentName] : [],
            status: 'REALIZADO',
          },
          'only_this'
        );

        // Gera lançamento correspondente de crédito na conta destino
        onAddTransaction({
          type: 'income',
          categoryId: transfCat?.id || '',
          category: transfCat?.name || 'Transferências',
          subcategoryId: transfSub?.id,
          subcategory: transfSub?.name || 'Transferência entre Contas',
          tagIds,
          amount: parsedAmount,
          date,
          recurring,
          notes: notes ? `${notes} (Origem: ${sourceAcc?.name || 'Conta Origem'})` : `Transferência de ${sourceAcc?.name || 'Conta Origem'}`,
          memberId: memberId || familyMembers[0]?.id || 'mem_geral',
          accountId: destinationAccountId,
          attachmentUrls: attachmentName ? [attachmentName] : [],
          attachmentNames: attachmentName ? [attachmentName] : [],
          status: 'REALIZADO',
        });
      } else {
        // 1. Débito na conta de origem (Despesa)
        onAddTransaction({
          type: 'expense',
          categoryId: transfCat?.id || '',
          category: transfCat?.name || 'Transferências',
          subcategoryId: transfSub?.id,
          subcategory: transfSub?.name || 'Transferência entre Contas',
          tagIds,
          amount: parsedAmount,
          date,
          recurring,
          notes: notes ? `${notes} (Destino: ${destAcc?.name || 'Conta Destino'})` : `Transferência para ${destAcc?.name || 'Conta Destino'}`,
          memberId: memberId || familyMembers[0]?.id || 'mem_geral',
          accountId,
          attachmentUrls: attachmentName ? [attachmentName] : [],
          attachmentNames: attachmentName ? [attachmentName] : [],
          status: 'REALIZADO',
        });

        // 2. Crédito na conta de destino (Receita)
        onAddTransaction({
          type: 'income',
          categoryId: transfCat?.id || '',
          category: transfCat?.name || 'Transferências',
          subcategoryId: transfSub?.id,
          subcategory: transfSub?.name || 'Transferência entre Contas',
          tagIds,
          amount: parsedAmount,
          date,
          recurring,
          notes: notes ? `${notes} (Origem: ${sourceAcc?.name || 'Conta Origem'})` : `Transferência de ${sourceAcc?.name || 'Conta Origem'}`,
          memberId: memberId || familyMembers[0]?.id || 'mem_geral',
          accountId: destinationAccountId,
          attachmentUrls: attachmentName ? [attachmentName] : [],
          attachmentNames: attachmentName ? [attachmentName] : [],
          status: 'REALIZADO',
        });
      }

      setIsFormOpen(false);
      return;
    }

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

    const categoryObj = categories.find(c => c.name === category);
    const tagIds = tags.map((name, i) => {
      const existing = allTags.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing.id;
      const newTag: TagType = { id: `tag_${Date.now()}_${i}`, name, color: DEFAULT_TAG_COLOR };
      if (onAddTag) onAddTag(newTag);
      return newTag.id;
    });

    const transactionData: Omit<Transaction, 'id'> = {
      type,
      categoryId: categoryObj?.id || '',
      category,
      subcategoryId: categoryObj?.parentId ? categoryObj.id : undefined,
      subcategory,
      tagIds,
      amount: parsedAmount,
      date,
      recurring,
      notes,
      memberId,
      accountId,
      attachmentUrls: attachmentName ? [attachmentName] : [],
      attachmentNames: attachmentName ? [attachmentName] : [],
      status: 'REALIZADO',
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
      return;
    }

    // Credit card purchase: assign invoice automatically and (optionally) split installments
    const selectedCard = creditCards.find(c => c.id === creditCardId);
    if (selectedCard) {
      const { year, month } = assignInvoicePeriod(selectedCard, date);
      const numInstallments = Math.max(1, parseInt(installments, 10) || 1);
      const cardBase = {
        ...transactionData,
        creditCardId: selectedCard.id,
        includeInBalanceSum: false,
      };
      if (numInstallments > 1) {
        const installmentTxs = buildInstallmentTransactions(
          { ...cardBase, invoiceId: invoiceIdFor(selectedCard.id, year, month) },
          { year, month },
          numInstallments
        );
        installmentTxs.forEach(tx => onAddTransaction(tx));
      } else {
        onAddTransaction({
          ...cardBase,
          invoiceId,
          installmentNumber: 1,
          totalInstallments: 1,
        });
      }
      setIsFormOpen(false);
      return;
    }

    // Create new (plain)
    onAddTransaction(transactionData);
    setIsFormOpen(false);
  };

  // Delete Click
  const handleDeleteClick = (id: string, isRecurring: boolean) => {
    if (isRecurring) {
      setRecurrenceAction({
        type: 'delete',
        transactionId: id
      });
    } else {
      setConfirmDeleteTxId(id);
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
  // Filters that apply to both plain transactions and invoice purchases.
  const matchesAllFilters = (t: Transaction) => {
    // 1. Search term match
    const matchesSearch =
      t.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subcategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resolveTxTagNames(t.tagIds, allTags).some(tagName => tagName.toLowerCase().includes(searchTerm.toLowerCase()));

    // 2. Type filter
    const matchesType = filterType === 'all' || t.type === filterType;

    // 3. Category filter
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;

    // 4. Account filter
    const matchesAccount = filterAccount.length === 0 || filterAccount.includes(t.accountId);

    // 5. Member filter
    const matchesMember = filterMember === 'all' || t.memberId === filterMember;

    // 6. Date Range filter
    const matchesStartDate = !filterStartDate || t.date >= filterStartDate;
    const matchesEndDate = !filterEndDate || t.date <= filterEndDate;

    return matchesSearch && matchesType && matchesCategory && matchesAccount && matchesMember && matchesStartDate && matchesEndDate;
  };

  const matchesPeriodDate = (date: string) => !periodRange || (date >= periodRange.start && date <= periodRange.end);

  // Build invoice groups from every transaction that passes the non-period filters.
  // The period filter for invoices is applied on their due date (not purchase date),
  // so faturas with vencimento fora do ciclo não entram na listagem.
  const invoiceGroups = new Map<string, Transaction[]>();
  const plainTransactions: Transaction[] = [];
  for (const t of transactions) {
    if (t.deleted_at) continue;
    if (!matchesAllFilters(t)) continue;
    if (t.invoiceId) {
      const arr = invoiceGroups.get(t.invoiceId) || [];
      arr.push(t);
      invoiceGroups.set(t.invoiceId, arr);
    } else {
      plainTransactions.push(t);
    }
  }
  const invoiceRows = [...invoiceGroups.entries()].map(([invId, txs]) => {
    const { year, month } = parseInvoiceId(invId);
    const card = creditCards.find(c => c.id === txs[0].creditCardId);
    const invoice = invoices.find(i => i.id === invId);
    const dueDate = invoice?.dueDate
      ?? (card ? dueDateFor(card, year, month) : `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`);
    return { invoiceId: invId, txs, card, invoice, dueDate };
  });

  // Filter plain transactions by their own date, invoices by their due date.
  const filteredPlain = plainTransactions.filter(t => matchesPeriodDate(t.date));
  const filteredInvoiceRows = invoiceRows.filter(row => matchesPeriodDate(row.dueDate));

  // Combined list sorted by date so invoices appear on their due date.
  const tableRows: Array<
    { kind: 'tx'; tx: Transaction; date: string }
    | { kind: 'invoice'; row: typeof filteredInvoiceRows[number]; date: string }
  > = [
    ...filteredPlain.map(tx => ({ kind: 'tx' as const, tx, date: tx.date })),
    ...filteredInvoiceRows.map(row => ({ kind: 'invoice' as const, row, date: row.dueDate })),
  ];
  tableRows.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  // All visible transaction IDs for the select-all toggle
  const allVisibleTxIds = useMemo(() => {
    return tableRows.flatMap(row => row.kind === 'tx' ? [row.tx.id] : row.row.txs.map(t => t.id));
  }, [tableRows]);

  const isAllSelected = allVisibleTxIds.length > 0 && allVisibleTxIds.every(id => selectedTxIds.includes(id));
  const isSomeSelected = selectedTxIds.length > 0 && !isAllSelected;

  const selectedTransactions = useMemo(() => {
    return transactions.filter(t => selectedTxIds.includes(t.id) && !t.deleted_at);
  }, [transactions, selectedTxIds]);

  const selectedIncomesTotal = selectedTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const selectedExpensesTotal = selectedTransactions
    .filter(t => t.type === 'expense' || t.type === 'invoice_payment')
    .reduce((sum, t) => sum + t.amount, 0);

  const selectedNetTotal = selectedIncomesTotal - selectedExpensesTotal;
  const hasSelectedIncomes = selectedIncomesTotal > 0;
  const hasSelectedExpenses = selectedExpensesTotal > 0;

  const handleToggleSelect = (id: string) => {
    setSelectedTxIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectInvoice = (invoiceTxs: Transaction[]) => {
    const invIds = invoiceTxs.map(t => t.id);
    const allSelected = invIds.length > 0 && invIds.every(id => selectedTxIds.includes(id));
    if (allSelected) {
      setSelectedTxIds(prev => prev.filter(id => !invIds.includes(id)));
    } else {
      setSelectedTxIds(prev => Array.from(new Set([...prev, ...invIds])));
    }
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTxIds(prev => prev.filter(id => !allVisibleTxIds.includes(id)));
    } else {
      setSelectedTxIds(prev => Array.from(new Set([...prev, ...allVisibleTxIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedTxIds([]);
  };

  const handleOpenBulkEdit = () => {
    setBulkCategory('__keep__');
    setBulkSubcategory('__keep__');
    setBulkAccountId('__keep__');
    setBulkMemberId('__keep__');
    setBulkApplyDate(false);
    setBulkDate(new Date().toISOString().split('T')[0]);
    setBulkStatus('__keep__');
    setBulkTag('');
    setIsBulkEditModalOpen(true);
  };

  const handleApplyBulkEdit = async () => {
    if (selectedTxIds.length === 0) return;

    let tagIdToAdd: string | undefined;
    if (bulkTag.trim()) {
      const trimmedTag = bulkTag.trim();
      const existingTagObj = allTags.find(tag => tag.name.toLowerCase() === trimmedTag.toLowerCase());
      if (existingTagObj) {
        tagIdToAdd = existingTagObj.id;
      } else {
        tagIdToAdd = `tag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await onAddTag({ id: tagIdToAdd, name: trimmedTag, color: DEFAULT_TAG_COLOR });
      }
    }

    for (const id of selectedTxIds) {
      const original = transactions.find(t => t.id === id);
      const patch: Partial<Transaction> = {};

      if (bulkCategory !== '__keep__') {
        patch.category = bulkCategory;
        const catObj = categories.find(c => c.name === bulkCategory);
        if (catObj) {
          patch.categoryId = catObj.id;
        }
        if (bulkSubcategory !== '__keep__') {
          patch.subcategory = bulkSubcategory;
        }
      }

      if (bulkAccountId !== '__keep__') {
        patch.accountId = bulkAccountId;
      }

      if (bulkMemberId !== '__keep__') {
        patch.memberId = bulkMemberId;
      }

      if (bulkApplyDate && bulkDate) {
        patch.date = bulkDate;
      }

      if (bulkStatus !== '__keep__') {
        patch.status = bulkStatus as 'REALIZADO' | 'PENDENTE';
      }

      if (tagIdToAdd) {
        const existingTags = original?.tagIds || [];
        if (!existingTags.includes(tagIdToAdd)) {
          patch.tagIds = [...existingTags, tagIdToAdd];
        }
      }

      if (Object.keys(patch).length > 0) {
        onEditTransaction(id, patch, 'only_this');
      }
    }

    setSelectedTxIds([]);
    setIsBulkEditModalOpen(false);
  };

  const handleOpenBulkDelete = () => {
    setIsBulkDeleteModalOpen(true);
  };

  const handleConfirmBulkDelete = () => {
    for (const id of selectedTxIds) {
      onDeleteTransaction(id, 'only_this');
    }
    setSelectedTxIds([]);
    setIsBulkDeleteModalOpen(false);
  };

  const availableSubcategoriesForBulk = useMemo(() => {
    if (bulkCategory === '__keep__' || !bulkCategory) return [];
    const selectedCat = categories.find(c => c.name === bulkCategory);
    if (!selectedCat) return [];
    const fromSub = subcategories.filter(s => s.categoryId === selectedCat.id).map(s => s.name);
    const fromNested = categories.filter(c => c.parentId === selectedCat.id).map(c => c.name);
    const direct = selectedCat.subcategories || [];
    return Array.from(new Set([...fromSub, ...fromNested, ...direct]));
  }, [bulkCategory, categories, subcategories]);

  /**
   * Saldo do cartão/conta: compras no cartão (includeInBalanceSum=false) e
   * transações de pagamento de fatura NÃO debitam individualmente. A fatura
   * contabiliza todas elas e apenas o valor da fatura é retirado do saldo.
   */
  const computeAccountBalanceAt = (accountId: string, anchor?: { txId?: string; invoiceId?: string; beforeDate?: string }): number => {
    const events: { date: string; signed: number; ref?: string }[] = [];
    for (const tx of transactions) {
      if (tx.accountId !== accountId || tx.deleted_at) continue;
      if (tx.includeInBalanceSum === false) continue;
      if (tx.type === 'invoice_payment') continue;
      events.push({ date: tx.date, signed: tx.type === 'income' ? tx.amount : -tx.amount, ref: tx.id });
    }
    for (const inv of invoices) {
      if (inv.totalAmount <= 0) continue;
      const card = creditCards.find(c => c.id === inv.creditCardId);
      if (!card || card.accountId !== accountId) continue;
      events.push({ date: inv.dueDate, signed: -inv.totalAmount, ref: `inv:${inv.id}` });
    }
    events.sort((a, b) => a.date.localeCompare(b.date));

    // Se solicitado o saldo antes de uma data (fechamento do dia/período anterior)
    if (anchor?.beforeDate) {
      let balanceBefore = 0;
      for (const ev of events) {
        if (ev.date < anchor.beforeDate) {
          balanceBefore += ev.signed;
        }
      }
      return balanceBefore;
    }

    let balance = 0;
    for (const ev of events) {
      balance += ev.signed;
      if (anchor?.invoiceId && ev.ref === `inv:${anchor.invoiceId}`) return balance;
      if (anchor?.txId && ev.ref === anchor.txId) return balance;
    }
    return balance;
  };

  // Contas consideradas no cálculo de saldo (todas ou filtradas)
  const targetAccounts = filterAccount.length > 0
    ? accounts.filter(a => filterAccount.includes(a.id))
    : accounts;

  // Data inicial do período/filtro para calcular o saldo de abertura (fechamento do dia anterior)
  const effectiveStartDate = filterStartDate || periodRange?.start || '';

  // Formata o dia anterior para exibição clara (ex: "até 31/07/2026" ou "até 14/08/2026")
  const previousDayFormatted = (() => {
    if (!effectiveStartDate) return null;
    const [y, m, d] = effectiveStartDate.split('-').map(Number);
    const prevDate = new Date(y, m - 1, d - 1);
    return prevDate.toLocaleDateString('pt-BR');
  })();

  // Cálculo dos saldos por conta e total no fechamento anterior
  const accountOpeningBalances = targetAccounts.map(acc => {
    const openingBal = effectiveStartDate 
      ? computeAccountBalanceAt(acc.id, { beforeDate: effectiveStartDate })
      : acc.balance;
    return {
      account: acc,
      balance: openingBal,
    };
  });

  const totalOpeningBalance = accountOpeningBalances.reduce((sum, item) => sum + item.balance, 0);

  const renderTransactionCells = (t: Transaction, showSaldo = true) => {
    const member = familyMembers.find(m => m.id === t.memberId);
    const account = accounts.find(a => a.id === t.accountId);
    const categoryObj = categories.find(c => c.name === t.category);
    const isSelected = selectedTxIds.includes(t.id);
    return (
      <>
        {/* Checkbox */}
        <td className="px-4 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => handleToggleSelect(t.id)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            id={`select-tx-${t.id}`}
            aria-label={`Selecionar transação ${t.notes || t.category}`}
          />
        </td>
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
            {(() => {
              const txTagNames = resolveTxTagNames(t.tagIds, allTags);
              if (txTagNames.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1">
                  {txTagNames.map((tagName, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[9px] font-semibold">
                      <Tag size={8} /> {tagName}
                    </span>
                  ))}
                </div>
              );
            })()}
            {/* Attachment Indicator */}
            {t.attachmentNames && t.attachmentNames.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-indigo-500 font-semibold bg-indigo-50/40 px-1.5 py-0.5 rounded">
                <Paperclip size={10} /> {t.attachmentNames[0]}
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
        {/* Saldo Pós-Transação */}
        <td className="px-6 py-4 whitespace-nowrap">
          {showSaldo ? (
            (() => {
              const acc = accounts.find(a => a.id === t.accountId);
              if (!acc) return <span className="text-xs text-slate-400">N/A</span>;
              const balance = computeAccountBalanceAt(t.accountId, { txId: t.id });
              return (
                <span className={`text-xs font-bold ${balance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                  R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              );
            })()
          ) : (
            <span className="text-xs text-slate-300">&mdash;</span>
          )}
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
      </>
    );
  };

  // Selected credit card & invoice options for the form
  const selectedCardObj = creditCards.find(c => c.id === creditCardId);
  const cardInvoiceOptions = Array.from(new Set([
    ...invoices.filter(i => i.creditCardId === creditCardId).map(i => i.id),
    invoiceId,
  ].filter(Boolean)));
  const invoiceOptionLabel = (invId: string) => {
    const { year: iy, month: im } = parseInvoiceId(invId);
    const mName = new Date(iy, im - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
    return `Fatura ${mName}/${iy}`;
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden" id="tx-manager-container">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Controle de Despesas e Receitas</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Gerencie os fluxos monetários da sua família de forma granular</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenAddTransferForm}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200/80 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
            id="add-transfer-btn"
          >
            <ArrowLeftRight size={15} /> Transferência entre Contas
          </button>
          <button
            onClick={handleOpenAddForm}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
            id="add-tx-btn"
          >
            <Plus size={16} /> Nova Transação
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <PeriodSelector
        pref={periodPref}
        onApply={handlePeriodApply}
        onSaveDefault={handlePeriodSaveDefault}
      />

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
                placeholder="Descrição, categoria, tags..."
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
              {categories
                .filter(c => filterType === 'all' || c.type === filterType)
                .map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name} {filterType === 'all' ? `(${c.type === 'income' ? 'Receita' : 'Despesa'})` : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Account Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Conta de Origem/Destino</label>
            <div className="relative">
              <div 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 cursor-pointer"
                onClick={() => setAccountFilterOpen(!accountFilterOpen)}
              >
                <div className="flex items-center justify-between">
                  <span>
                    {filterAccount.length === 0 
                      ? 'Todas as contas' 
                      : filterAccount.map(id => accounts.find(a => a.id === id)?.name).filter(Boolean).join(', ')}
                  </span>
                  <span className="text-slate-400">{accountFilterOpen ? '▲' : '▼'}</span>
                </div>
              </div>
              {accountFilterOpen && (
                <div className="absolute z-10 w-full max-h-60 overflow-y-auto mt-1 bg-white border border-slate-200 rounded-xl shadow-lg">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="text"
                      placeholder="Buscar conta..."
                      value={accountFilterSearch}
                      onChange={(e) => setAccountFilterSearch(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterAccount.length === 0}
                        onChange={() => setFilterAccount([])}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-700">Todas as contas</span>
                    </label>
                    {accounts
                      .filter(a => a.name.toLowerCase().includes(accountFilterSearch.toLowerCase()))
                      .map(a => (
                        <label key={a.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filterAccount.includes(a.id)}
                            onChange={(e) => setFilterAccount(e.target.checked 
                              ? [...filterAccount, a.id] 
                              : filterAccount.filter(id => id !== a.id)
                            )}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-slate-700 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                            {a.name}
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>
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
                setFilterAccount([]);
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

      {/* Opening Balance Summary Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm" id="opening-balance-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Wallet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {targetAccounts.length === 1 
                    ? `Saldo Inicial da Conta (${targetAccounts[0].name})` 
                    : filterAccount.length > 0 
                      ? `Saldo Inicial das Contas Filtradas (${targetAccounts.length})` 
                      : 'Saldo Inicial Consolidado (Todas as Contas)'}
                </span>
                {previousDayFormatted && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                    Fechamento de {previousDayFormatted}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span 
                  className={`text-2xl font-display font-extrabold tracking-tight ${
                    totalOpeningBalance >= 0 ? 'text-slate-900' : 'text-rose-600'
                  }`}
                  id="total-opening-balance-value"
                >
                  R$ {totalOpeningBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  saldo antes do período selecionado
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown por conta quando há mais de 1 conta */}
          {targetAccounts.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              {accountOpeningBalances.map(({ account, balance }) => (
                <div 
                  key={account.id} 
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: account.color }} />
                  <span className="text-slate-600 font-medium">{account.name}:</span>
                  <span className={`font-bold ${balance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                    R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Selection Action Bar */}
      {selectedTxIds.length > 0 && (
        <div 
          className="sticky top-4 z-30 bg-slate-900/95 text-white backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
          id="tx-bulk-actions-bar"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-indigo-600/30 border border-indigo-500/40 px-3 py-1.5 rounded-xl">
              <CheckSquare size={16} className="text-indigo-400" />
              <span className="text-xs font-bold text-white tracking-wide" id="bulk-selected-count">
                {selectedTxIds.length} {selectedTxIds.length === 1 ? 'transação selecionada' : 'transações selecionadas'}
              </span>
            </div>

            {/* Totais das transações selecionadas */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/50 text-xs font-semibold" id="bulk-selected-totals">
              <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold">Total:</span>
              {hasSelectedIncomes && hasSelectedExpenses ? (
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">
                    +{selectedIncomesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="text-slate-500">/</span>
                  <span className="text-rose-400 font-bold">
                    -{selectedExpensesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400 text-[10px] uppercase">Líq:</span>
                  <span className={`font-bold ${selectedNetTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedNetTotal >= 0 ? '+' : ''}{selectedNetTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              ) : hasSelectedIncomes ? (
                <span className="text-emerald-400 font-bold">
                  +{selectedIncomesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' })}
                </span>
              ) : (
                <span className="text-rose-400 font-bold">
                  -{selectedExpensesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Botão Editar em Lote */}
            <button
              type="button"
              onClick={handleOpenBulkEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm border border-indigo-400/30"
              id="bulk-edit-btn"
            >
              <Edit2 size={14} />
              <span>Editar ({selectedTxIds.length})</span>
            </button>

            {/* Botão Excluir em Lote */}
            <button
              type="button"
              onClick={handleOpenBulkDelete}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm border border-rose-400/30"
              id="bulk-delete-btn"
            >
              <Trash2 size={14} />
              <span>Excluir ({selectedTxIds.length})</span>
            </button>

            {/* Botão Limpar Seleção */}
            <button
              type="button"
              onClick={handleClearSelection}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              id="bulk-clear-btn"
              title="Limpar seleção"
            >
              <X size={14} />
              <span>Desmarcar</span>
            </button>
          </div>
        </div>
      )}

      {/* Transactions Grid/Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transações Encontradas ({tableRows.length})</h3>
          <span className="text-xs text-slate-400 font-semibold">Mostrando itens filtrados</span>
        </div>

        {tableRows.length === 0 ? (
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
                  <th className="px-4 py-4 w-10 text-center">
                    <input 
                      type="checkbox"
                      checked={isAllSelected}
                      ref={el => {
                        if (el) {
                          el.indeterminate = isSomeSelected;
                        }
                      }}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      id="select-all-txs-checkbox"
                      aria-label="Selecionar todas as transações visíveis"
                      title={isAllSelected ? "Desmarcar todas" : "Selecionar todas as transações visíveis"}
                    />
                  </th>
                  <th 
                    className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider select-none cursor-pointer hover:text-indigo-600 transition-colors group"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    id="sort-date-col-btn"
                    title={sortOrder === 'asc' ? 'Ordenação: Data crescente (mais antigas primeiro). Clique para alternar para decrescente.' : 'Ordenação: Data decrescente (mais recentes primeiro). Clique para alternar para crescente.'}
                  >
                    <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-indigo-600">
                      <span>Data</span>
                      <span className="inline-flex items-center justify-center p-0.5 rounded bg-slate-100 group-hover:bg-indigo-50 text-slate-500 group-hover:text-indigo-600 transition-colors">
                        {sortOrder === 'asc' ? (
                          <ArrowUp size={11} className="text-indigo-600 stroke-[2.5]" />
                        ) : (
                          <ArrowDown size={11} className="text-indigo-600 stroke-[2.5]" />
                        )}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descrição / Observações</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Membro</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conta</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoria / Subcat</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frequência</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Pós-Transação</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableRows.map((entry) => {
                  if (entry.kind === 'tx') {
                    const t = entry.tx;
                    const isSelected = selectedTxIds.includes(t.id);
                    return (
                      <tr key={t.id} className={`${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'} transition-colors`}>
                        {renderTransactionCells(t)}
                      </tr>
                    );
                  }
                  const row = entry.row;
                  const isOpen = expandedInvoiceId === row.invoiceId;
                  const { year, month } = parseInvoiceId(row.invoiceId);
                  const monthName = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
                  const total = row.invoice?.totalAmount ?? row.txs.reduce((s, tx) => s + tx.amount, 0);
                  const statusLabel = row.invoice ? invoiceStatusLabel[row.invoice.status] : 'Aberta';
                  const acc = accounts.find(a => a.id === (row.card?.accountId || row.txs[0]?.accountId));
                  const member = familyMembers.find(m => m.id === row.txs[0]?.memberId);
                  const invoiceBalance = computeAccountBalanceAt(acc?.id || '', { invoiceId: row.invoiceId });
                  const isInvoiceSelected = row.txs.length > 0 && row.txs.every(tx => selectedTxIds.includes(tx.id));
                  return (
                    <React.Fragment key={row.invoiceId}>
                      <tr
                        className={`${isInvoiceSelected ? 'bg-indigo-100/60' : 'bg-indigo-50/40'} border-b border-slate-100 cursor-pointer hover:bg-indigo-50/60 transition-colors`}
                        onClick={() => setExpandedInvoiceId(isOpen ? null : row.invoiceId)}
                      >
                        {/* Checkbox for invoice */}
                        <td className="px-4 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isInvoiceSelected}
                            ref={el => {
                              if (el) {
                                const some = row.txs.some(tx => selectedTxIds.includes(tx.id));
                                el.indeterminate = some && !isInvoiceSelected;
                              }
                            }}
                            onChange={() => handleToggleSelectInvoice(row.txs)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            id={`select-invoice-${row.invoiceId}`}
                            aria-label={`Selecionar todas as compras da fatura ${row.card?.name || 'Cartão'}`}
                            title="Selecionar todas as compras desta fatura"
                          />
                        </td>
                        {/* Date (vencimento) */}
                        <td className="px-6 py-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
                          {new Date(row.dueDate).toLocaleDateString('pt-BR')}
                        </td>
                        {/* Description: Fatura <card> */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-indigo-700 block uppercase tracking-wider flex items-center gap-2">
                              <CreditCard size={12} className="text-indigo-500" />
                              Fatura {row.card?.name?.toUpperCase() || 'Cartão'}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {monthName}/{year} &bull; {statusLabel}
                            </span>
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
                            <span className={`w-2 h-2 rounded-full ${acc?.color || 'bg-slate-500'}`} />
                            {acc?.name || 'N/A'}
                          </span>
                        </td>
                        {/* Category */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white bg-indigo-600">
                            Fatura
                          </span>
                        </td>
                        {/* Recurrence */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                          Única
                        </td>
                        {/* Amount: fatura sai da conta */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-bold text-slate-800">
                            - R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        {/* Saldo Pós-Transação: saldo menos valor da fatura */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-xs font-bold ${invoiceBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                            R$ {invoiceBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => setExpandedInvoiceId(isOpen ? null : row.invoiceId)}
                            className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
                            aria-label={isOpen ? 'Recolher fatura' : 'Expandir fatura'}
                          >
                            {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </td>
                      </tr>
                      {isOpen && [...row.txs].sort((a, b) => sortOrder === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)).map((t) => {
                        const isTxSelected = selectedTxIds.includes(t.id);
                        return (
                          <tr key={t.id} className={`${isTxSelected ? 'bg-indigo-100/50' : 'bg-indigo-50/10 hover:bg-slate-50/50'} transition-colors`}>
                            {renderTransactionCells(t, false)}
                          </tr>
                        );
                      })}
                    </React.Fragment>
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

      {/* Delete Confirmation Modal */}
      {confirmDeleteTxId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" id="delete-tx-modal">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Excluir Transação</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tem certeza de que deseja excluir esta transação? Esta ação não poderá ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTxId(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-colors cursor-pointer"
                id="cancel-delete-tx-btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTransaction(confirmDeleteTxId, 'only_this');
                  setConfirmDeleteTxId(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                id="confirm-delete-tx-btn"
              >
                Excluir
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
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setType('expense');
                      const catObj = categories.find(c => c.type === 'expense' && !c.parentId) || categories.find(c => c.type === 'expense');
                      setCategory(catObj?.name || '');
                      const firstSub = catObj?.subcategories?.[0]
                        || subcategories.find(s => s.categoryId === catObj?.id)?.name
                        || categories.find(c => c.parentId === catObj?.id && c.type === 'expense')?.name
                        || '';
                      setSubcategory(firstSub);
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
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
                      const catObj = categories.find(c => c.type === 'income' && !c.parentId) || categories.find(c => c.type === 'income');
                      setCategory(catObj?.name || '');
                      const firstSub = catObj?.subcategories?.[0]
                        || subcategories.find(s => s.categoryId === catObj?.id)?.name
                        || categories.find(c => c.parentId === catObj?.id && c.type === 'income')?.name
                        || '';
                      setSubcategory(firstSub);
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                      type === 'income'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    id="tx-form-type-income"
                  >
                    Receita (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('transfer');
                      const transfCat = categories.find(c => c.name.toLowerCase().includes('transferência') || c.name.toLowerCase().includes('transferencia'));
                      setCategory(transfCat?.name || 'Transferências');
                      const transfSub = subcategories.find(s => s.categoryId === transfCat?.id && s.name.toLowerCase().includes('entre contas'))
                        || subcategories.find(s => s.categoryId === transfCat?.id);
                      setSubcategory(transfSub?.name || 'Transferência entre Contas');
                      if (!destinationAccountId) {
                        setDestinationAccountId(accounts.find(a => a.id !== accountId)?.id || '');
                      }
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                      type === 'transfer'
                        ? 'bg-violet-50 border-violet-200 text-violet-700 font-extrabold'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    id="tx-form-type-transfer"
                  >
                    Transferência ⇄
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

              {type === 'transfer' ? (
                /* Transfer Account Selection Box */
                <div className="space-y-4 bg-violet-50/50 p-4 rounded-2xl border border-violet-100">
                  <div className="flex items-center gap-2 text-violet-800 text-xs font-bold border-b border-violet-100/80 pb-2">
                    <ArrowLeftRight size={15} />
                    <span>Contas Envolvidas na Transferência</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Conta Origem (Saída)*</label>
                      <select
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-violet-500"
                        id="tx-form-source-account"
                      >
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Conta Destino (Entrada)*</label>
                      <select
                        value={destinationAccountId}
                        onChange={(e) => setDestinationAccountId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-violet-500"
                        id="tx-form-dest-account"
                      >
                        {accounts.map(a => (
                          <option key={a.id} value={a.id} disabled={a.id === accountId}>
                            {a.name} {a.id === accountId ? '(Mesma conta)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Membro Responsável</label>
                    <select
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-violet-500"
                      id="tx-form-transfer-member"
                    >
                      {familyMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  {/* Category and Subcategory row */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Category Selection */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoria*</label>
                      <select
                        value={category}
                        required
                        onChange={(e) => {
                          const newCatName = e.target.value;
                          setCategory(newCatName);
                          const catObj = categories.find(c => c.name === newCatName && c.type === type) || categories.find(c => c.name === newCatName);
                          const firstSub = catObj?.subcategories?.[0]
                            || subcategories.find(s => s.categoryId === catObj?.id)?.name
                            || categories.find(c => c.parentId === catObj?.id && c.type === type)?.name
                            || '';
                          setSubcategory(firstSub);
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                        id="tx-form-category"
                      >
                        {availableCategoriesForForm.map(c => (
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
                        {availableSubcategoriesForForm.map((sub, i) => (
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
                </>
              )}

              {/* Credit Card Purchase */}
              {type === 'expense' && creditCards.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cartão de Crédito (compras no crédito)</label>
                  <select
                    value={creditCardId}
                    onChange={(e) => setCreditCardId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                    id="tx-form-credit-card"
                  >
                    <option value="">Sem cartão (débito / dinheiro)</option>
                    {creditCards.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {creditCardId && selectedCardObj && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Invoice */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fatura</label>
                    <select
                      value={invoiceId}
                      onChange={(e) => setInvoiceId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                      id="tx-form-invoice"
                    >
                      {cardInvoiceOptions.map(invId => (
                        <option key={invId} value={invId}>{invoiceOptionLabel(invId)}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Atribuída automaticamente pela data e fechamento do cartão.
                    </p>
                  </div>

                  {/* Installments */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parcelas</label>
                    <input
                      type="number"
                      min="1"
                      max="48"
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                      id="tx-form-installments"
                    />
                  </div>
                </div>
              )}

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

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" id="bulk-edit-modal">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Edit2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Editar Transações em Lote</h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {selectedTxIds.length} {selectedTxIds.length === 1 ? 'transação selecionada' : 'transações selecionadas'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                id="close-bulk-edit-modal-btn"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-800 font-medium leading-relaxed">
                Apenas os campos preenchidos abaixo serão atualizados em todas as <strong>{selectedTxIds.length} transações</strong> selecionadas. Os demais campos permanecerão inalterados.
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoria</label>
                <select
                  value={bulkCategory}
                  onChange={(e) => {
                    setBulkCategory(e.target.value);
                    setBulkSubcategory('__keep__');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                  id="bulk-edit-category-select"
                >
                  <option value="__keep__">-- Manter inalterada --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Subcategory (if category changed) */}
              {bulkCategory !== '__keep__' && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subcategoria</label>
                  <select
                    value={bulkSubcategory}
                    onChange={(e) => setBulkSubcategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                    id="bulk-edit-subcategory-select"
                  >
                    <option value="__keep__">-- Manter inalterada --</option>
                    <option value="">(Sem subcategoria / Limpar)</option>
                    {availableSubcategoriesForBulk.map((sub, idx) => (
                      <option key={idx} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Account */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conta</label>
                <select
                  value={bulkAccountId}
                  onChange={(e) => setBulkAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                  id="bulk-edit-account-select"
                >
                  <option value="__keep__">-- Manter inalterada --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>

              {/* Member */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Membro Responsável</label>
                <select
                  value={bulkMemberId}
                  onChange={(e) => setBulkMemberId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                  id="bulk-edit-member-select"
                >
                  <option value="__keep__">-- Manter inalterado --</option>
                  {familyMembers.map(mem => (
                    <option key={mem.id} value={mem.id}>{mem.name}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status da Transação</label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                  id="bulk-edit-status-select"
                >
                  <option value="__keep__">-- Manter inalterado --</option>
                  <option value="REALIZADO">Realizado (Efetivado)</option>
                  <option value="PENDENTE">Pendente</option>
                </select>
              </div>

              {/* Date Update Option */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkApplyDate}
                    onChange={(e) => setBulkApplyDate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    id="bulk-edit-apply-date-checkbox"
                  />
                  <span className="text-xs font-bold text-slate-700">Alterar data de todas as selecionadas</span>
                </label>
                {bulkApplyDate && (
                  <input
                    type="date"
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                    id="bulk-edit-date-input"
                  />
                )}
              </div>

              {/* Add Tag to all */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Adicionar Tag / Marcador</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <input
                    type="text"
                    value={bulkTag}
                    onChange={(e) => setBulkTag(e.target.value)}
                    placeholder="Nome da tag para vincular a todas (ex: Viagem, Reforma)"
                    className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
                    id="bulk-edit-tag-input"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  A tag será adicionada a todas as transações selecionadas sem remover as tags que elas já possuem.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBulkEditModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                id="cancel-bulk-edit-btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyBulkEdit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100/50 transition-all cursor-pointer"
                id="confirm-bulk-edit-btn"
              >
                Aplicar Alterações ({selectedTxIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" id="bulk-delete-modal">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
                  <Trash2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Excluir Transações em Lote</h3>
                  <p className="text-[11px] text-rose-500 font-medium">Ação irreversível</p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                id="close-bulk-delete-modal-btn"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Tem certeza de que deseja excluir permanentemente as <strong className="text-slate-800 font-bold">{selectedTxIds.length} transações</strong> selecionadas?
              </p>

              {/* Financial summary of items to be deleted */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Resumo Financeiro dos Itens Selecionados:</span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total de Receitas:</span>
                  <span className="font-bold text-emerald-600">
                    +R$ {selectedIncomesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total de Despesas:</span>
                  <span className="font-bold text-rose-600">
                    -R$ {selectedExpensesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Transactions preview list */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Itens que serão removidos:</span>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl bg-slate-50/40">
                  {selectedTransactions.map((tx) => (
                    <div key={tx.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div className="space-y-0.5 max-w-[70%]">
                        <p className="font-bold text-slate-800 truncate">{tx.notes || tx.category}</p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(tx.date).toLocaleDateString('pt-BR')} &bull; {tx.category}
                        </p>
                      </div>
                      <span className={`font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {tx.type === 'income' ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                id="cancel-bulk-delete-btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-100/50 transition-all cursor-pointer"
                id="confirm-bulk-delete-btn"
              >
                Excluir {selectedTxIds.length} {selectedTxIds.length === 1 ? 'Transação' : 'Transações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
