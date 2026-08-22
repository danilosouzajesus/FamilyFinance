import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Wallet, 
  Landmark, 
  CreditCard, 
  AlertTriangle, 
  PiggyBank,
  Check,
  TrendingUp,
  TrendingDown,
  Building2
} from 'lucide-react';
import { Account, Transaction, CreditCard as CreditCardType, Invoice } from '@ff/shared';
import { invoiceStatusLabel } from '@ff/shared';

const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const shortMonthLabel = (year: number, month: number) => `${SHORT_MONTHS[month - 1]}/${year}`;

interface AccountsAndCardsManagerProps {
  accounts: Account[];
  transactions: Transaction[];
  creditCards?: CreditCardType[];
  invoices?: Invoice[];
  isPrivateMode?: boolean;
  onAddAccount: (acc: Account) => void;
  onEditAccount: (id: string, updated: Partial<Account>) => void;
  onDeleteAccount: (id: string, remapAccountId?: string) => void;
  onAddCreditCard?: (card: Omit<CreditCardType, 'id'>) => void;
  onEditCreditCard?: (id: string, updated: Partial<CreditCardType>) => void;
  onDeleteCreditCard?: (id: string) => void;
  onPayInvoice?: (invoiceId: string) => void;
}

export default function AccountsAndCardsManager({
  accounts = [],
  transactions = [],
  creditCards = [],
  invoices = [],
  isPrivateMode = false,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onAddCreditCard,
  onEditCreditCard,
  onDeleteCreditCard,
  onPayInvoice
}: AccountsAndCardsManagerProps) {
  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Credit card modal state
  const [isCardFormOpen, setIsCardFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardType | null>(null);
  const [cardName, setCardName] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  const [cardClosingDay, setCardClosingDay] = useState('10');
  const [cardDueDay, setCardDueDay] = useState('15');
  const [cardAccountId, setCardAccountId] = useState('');
  const [cardColor, setCardColor] = useState('#8B5CF6');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<'cash' | 'bank' | 'investment'>('bank');
  const [balance, setBalance] = useState<number>(0);
  const [color, setColor] = useState('#6366F1');

  // Deletion modal
  const [deletingAcc, setDeletingAcc] = useState<Account | null>(null);
  const [remapAccId, setRemapAccId] = useState('');

  // Filter state
  const [activeFilter, setActiveFilter] = useState<'all' | 'cash' | 'bank' | 'investment'>('all');

  // Predefined colors
  const colors = [
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#06B6D4', // Cyan
    '#3B82F6', // Blue
    '#6366F1', // Indigo
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#84CC16', // Lime
    '#6B7280', // Gray
    '#0F172A'  // Slate
  ];

  const resolveColor = (colorStr: string) => {
    if (!colorStr) return '#6366F1';
    if (colorStr.startsWith('#')) return colorStr;
    // Map Tailwind classes to hex
    if (colorStr.includes('orange')) return '#F97316';
    if (colorStr.includes('purple')) return '#8B5CF6';
    if (colorStr.includes('emerald')) return '#10B981';
    if (colorStr.includes('slate') || colorStr.includes('gray')) return '#64748B';
    return '#6366F1';
  };

  const handleOpenAdd = () => {
    setEditingAccount(null);
    setName('');
    setType('bank');
    setBalance(0);
    setColor('#6366F1');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type === 'credit' ? 'bank' : acc.type);
    setBalance(acc.balance);
    setColor(acc.color || '#6366F1');
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingAccount) {
      onEditAccount(editingAccount.id, {
        name: name.trim(),
        type,
        balance: Number(balance),
        color
      });
    } else {
      const newAcc: Account = {
        id: `acc_${Date.now()}`,
        name: name.trim(),
        type,
        balance: Number(balance),
        color
      };
      onAddAccount(newAcc);
    }
    setIsFormOpen(false);
  };

  const handleOpenAddCard = () => {
    setEditingCard(null);
    setCardName('');
    setCardLimit('');
    setCardClosingDay('10');
    setCardDueDay('15');
    setCardAccountId(accounts.find(a => a.type === 'bank')?.id || accounts[0]?.id || '');
    setCardColor('#8B5CF6');
    setIsCardFormOpen(true);
  };

  const handleOpenEditCard = (card: CreditCardType) => {
    setEditingCard(card);
    setCardName(card.name);
    setCardLimit(String(card.limitAmount));
    setCardClosingDay(String(card.closingDay));
    setCardDueDay(String(card.dueDay));
    setCardAccountId(card.accountId);
    setCardColor(card.color || '#8B5CF6');
    setIsCardFormOpen(true);
  };

  const handleCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim()) return;

    const parsedLimit = parseFloat(cardLimit) || 0;
    const parsedClosing = parseInt(cardClosingDay, 10) || 1;
    const parsedDue = parseInt(cardDueDay, 10) || 1;

    if (editingCard && onEditCreditCard) {
      onEditCreditCard(editingCard.id, {
        name: cardName.trim(),
        limitAmount: parsedLimit,
        closingDay: parsedClosing,
        dueDay: parsedDue,
        accountId: cardAccountId || editingCard.accountId,
        color: cardColor
      });
    } else if (onAddCreditCard) {
      onAddCreditCard({
        name: cardName.trim(),
        limitAmount: parsedLimit,
        closingDay: parsedClosing,
        dueDay: parsedDue,
        accountId: cardAccountId || 'acc_itau',
        color: cardColor
      });
    }
    setIsCardFormOpen(false);
  };

  const [deletingCard, setDeletingCard] = useState<CreditCardType | null>(null);

  const handleDeleteCardRequest = (card: CreditCardType) => {
    setDeletingCard(card);
  };

  const handleDeleteRequest = (acc: Account) => {
    // Check if there are transactions associated
    const count = transactions.filter(t => t.accountId === acc.id).length;
    if (count > 0) {
      setDeletingAcc(acc);
      // Auto-select first other account for remapping
      const alternative = accounts.find(a => a.id !== acc.id);
      setRemapAccId(alternative ? alternative.id : '');
    } else {
      setDeletingAcc(acc);
      setRemapAccId('');
    }
  };

  const handleConfirmDeleteWithRemap = () => {
    if (!deletingAcc) return;
    onDeleteAccount(deletingAcc.id, remapAccId || undefined);
    setDeletingAcc(null);
    setRemapAccId('');
  };

  // Calculations for summary cards
  const totalCash = accounts
    .filter(a => a.type === 'cash')
    .reduce((sum, a) => sum + a.balance, 0);

  const totalBank = accounts
    .filter(a => a.type === 'bank')
    .reduce((sum, a) => sum + a.balance, 0);

  const totalInvestment = accounts
    .filter(a => a.type === 'investment')
    .reduce((sum, a) => sum + a.balance, 0);

  const totalBalance = totalCash + totalBank + totalInvestment;

  // Filtered accounts
  const filteredAccounts = accounts.filter(a => {
    if (activeFilter === 'all') return true;
    return a.type === activeFilter;
  });

  const getAccountIcon = (accType: Account['type']) => {
    switch (accType) {
      case 'cash':
        return <Wallet size={18} />;
      case 'bank':
        return <Landmark size={18} />;
      case 'investment':
        return <TrendingUp size={18} />;
      case 'credit':
        return <CreditCard size={18} />;
    }
  };

  const getAccountTypeLabel = (accType: Account['type']) => {
    switch (accType) {
      case 'cash':
        return 'Dinheiro em Espécie';
      case 'bank':
        return 'Conta Bancária';
      case 'investment':
        return 'Conta de Investimento';
      case 'credit':
        return 'Cartão de Crédito';
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden" id="accounts-manager-wrapper">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            Contas & Cartões
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Gerencie carteiras de dinheiro, contas correntes e cartões de crédito da sua família.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleOpenAddCard}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shadow-amber-100"
            id="btn-add-credit-card-top"
          >
            <CreditCard size={16} /> Criar Cartão de Crédito
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shadow-indigo-100"
            id="btn-add-account"
          >
            <Plus size={16} /> Adicionar Nova Conta
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="accounts-summary-grid">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Dinheiro em Espécie</span>
            <span className="text-lg font-black text-slate-900 block">
              R$ {totalCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Wallet size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Bancos & Contas</span>
            <span className="text-lg font-black text-slate-900 block">
              R$ {totalBank.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Landmark size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Contas de Investimento</span>
            <span className={`text-lg font-black block ${totalInvestment >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              R$ {totalInvestment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Patrimônio Líquido</span>
            <span className={`text-lg font-black block ${totalBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <PiggyBank size={18} />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200/60 pb-px gap-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
            activeFilter === 'all' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Todos ({accounts.length})
        </button>
        <button
          onClick={() => setActiveFilter('bank')}
          className={`px-4 py-2 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
            activeFilter === 'bank' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Contas Bancárias ({accounts.filter(a => a.type === 'bank').length})
        </button>
        <button
          onClick={() => setActiveFilter('cash')}
          className={`px-4 py-2 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
            activeFilter === 'cash' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Dinheiro ({accounts.filter(a => a.type === 'cash').length})
        </button>
        <button
          onClick={() => setActiveFilter('investment')}
          className={`px-4 py-2 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap cursor-pointer ${
            activeFilter === 'investment' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Investimentos ({accounts.filter(a => a.type === 'investment').length})
        </button>
      </div>

      {/* Contas Segment */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Wallet size={16} className="text-emerald-600" />
              Contas
            </h2>
            <p className="text-[10px] text-slate-400 font-medium">
              Suas contas bancárias e dinheiro.
            </p>
          </div>
        </div>

      {/* Grid containing Cards/Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="accounts-grid-items">
        {filteredAccounts.map((acc) => {
          const assocTxCount = transactions.filter(t => t.accountId === acc.id).length;
          const resolvedColorHex = resolveColor(acc.color);
          
          return (
            <div 
              key={acc.id}
              className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col justify-between"
              style={{ borderLeft: `5px solid ${resolvedColorHex}` }}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span 
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                      style={{ 
                        color: resolvedColorHex, 
                        borderColor: `${resolvedColorHex}20`, 
                        backgroundColor: `${resolvedColorHex}10` 
                      }}
                    >
                      {getAccountIcon(acc.type)} {getAccountTypeLabel(acc.type)}
                    </span>
                    <h3 className="text-sm font-black text-slate-800 pt-1 leading-snug">
                      {acc.name}
                    </h3>
                  </div>
                  
                  {/* Action group */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(acc)}
                      className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                      title="Editar Conta"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(acc)}
                      className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Excluir Conta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Saldo da Carteira</span>
                  <span className={`text-xl font-black ${acc.balance < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Card Footer Info */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                <span>{assocTxCount} Transações associadas</span>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: resolvedColorHex }} />
              </div>
            </div>
          );
        })}

        {/* Empty state for filtered accounts */}
        {filteredAccounts.length === 0 && (
          <div className="col-span-full bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Building2 size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800">Nenhum registro encontrado</h4>
              <p className="text-[10px] text-slate-400 font-medium">Nenhuma conta ou cartão deste tipo foi cadastrado ainda.</p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg transition-all cursor-pointer border border-indigo-100"
            >
              Criar Primeiro Registro
            </button>
          </div>
        )}
      </div>
    </div>

      {/* Cartões Segment */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <CreditCard size={16} className="text-amber-600" />
              Cartões de Crédito
            </h2>
            <p className="text-[10px] text-slate-400 font-medium">
              Fechamento, vencimento, limite e faturas por ciclo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="credit-cards-grid">
          {creditCards.map((card) => {
            const cardInvoices = invoices.filter(i => i.creditCardId === card.id);
            const openInvoices = cardInvoices.filter(i => i.status !== 'PAID');
            const resolvedColorHex = resolveColor(card.color || '#8B5CF6');
            const isExpanded = expandedCardId === card.id;

            return (
              <div
                key={card.id}
                className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col justify-between"
                style={{ borderTop: `4px solid ${resolvedColorHex}` }}
              >
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
                        <CreditCard size={12} /> Cartão de Crédito
                      </span>
                      <h3 className="text-sm font-black text-slate-800 leading-snug pt-1">{card.name}</h3>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditCard(card)}
                        className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                        title="Editar Cartão"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteCardRequest(card)}
                        className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Excluir Cartão"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Limite do Cartão</span>
                      <span className="text-lg font-black text-slate-800">
                        {isPrivateMode ? 'R$ ***' : `R$ ${card.limitAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Faturas</span>
                      <span className={`text-lg font-black ${openInvoices.length > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {cardInvoices.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                  <button
                    onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                    className="w-full flex items-center justify-between text-[10px] text-slate-500 font-bold hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <span>{cardInvoices.length} Faturas</span>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: resolvedColorHex }} />
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-2">
                      {cardInvoices.length === 0 && (
                        <p className="text-[10px] text-slate-400 font-medium">Nenhuma fatura gerada ainda.</p>
                      )}
                      {cardInvoices.map(inv => (
                        <div key={inv.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-slate-800">{shortMonthLabel(inv.year, inv.month)}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-600'
                              : inv.status === 'OVERDUE' ? 'bg-rose-50 text-rose-600'
                              : 'bg-amber-50 text-amber-600'
                            }`}>
                              {invoiceStatusLabel[inv.status]}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-bold">
                              {isPrivateMode ? 'R$ ***' : `R$ ${inv.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            </span>
                            <span className="text-[9px] text-slate-400">Vence {new Date(inv.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                          </div>
                          {inv.status !== 'PAID' && onPayInvoice && (
                            <button
                              onClick={() => onPayInvoice(inv.id)}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                            >
                              Pagar Fatura de {shortMonthLabel(inv.year, inv.month)}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {creditCards.length === 0 && (
            <div className="col-span-full bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mx-auto text-amber-500">
                <CreditCard size={18} />
              </div>
              <h4 className="text-xs font-bold text-slate-700">Nenhum cartão de crédito cadastrado</h4>
              <p className="text-[10px] text-slate-400 font-medium max-w-sm mx-auto">
                Cadastre cartões com dia de fechamento e vencimento para gerar faturas automaticamente.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Add/Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden border border-slate-100 animate-slide-up">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {editingAccount ? 'Editar Conta' : 'Nova Conta'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Account Name */}
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold uppercase">Nome da Conta</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Banco Itaú, Carteira, Nubank Visa"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              {/* Account Type */}
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold uppercase">Tipo de Conta</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('bank')}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      type === 'bank' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Landmark size={16} />
                    <span>Banco</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('investment')}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      type === 'investment' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <TrendingUp size={16} />
                    <span>Investimento</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('cash')}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      type === 'cash' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Wallet size={16} />
                    <span>Dinheiro</span>
                  </button>
                </div>
              </div>

              {/* Balance */}
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold uppercase">
                  {'Saldo Inicial / Atual'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={balance}
                    onChange={(e) => setBalance(Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
              </div>

              {/* Color selector */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-400 font-bold uppercase">Cor de Identificação</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-6 h-6 rounded-lg transition-transform cursor-pointer relative shrink-0 flex items-center justify-center hover:scale-110"
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check size={12} className="text-white font-black" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  {editingAccount ? 'Salvar Alterações' : 'Criar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Card Add/Edit Form Modal */}
      {isCardFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden border border-slate-100 animate-slide-up">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/20">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {editingCard ? 'Editar Cartão de Crédito' : 'Novo Cartão de Crédito'}
              </h3>
              <button 
                onClick={() => setIsCardFormOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCardSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold uppercase">Nome do Cartão</label>
                <input
                  type="text"
                  required
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="Ex: Banco Itaú, Nubank, XP"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase">Limite do Cartão (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cardLimit}
                    onChange={(e) => setCardLimit(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase">Conta p/ Pagamento</label>
                  <select
                    value={cardAccountId}
                    onChange={(e) => setCardAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="">-- Selecionar --</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase">Dia de Fechamento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={cardClosingDay}
                    onChange={(e) => setCardClosingDay(e.target.value)}
                    placeholder="10"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase">Dia de Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={cardDueDay}
                    onChange={(e) => setCardDueDay(e.target.value)}
                    placeholder="15"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCardFormOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  {editingCard ? 'Salvar Alterações' : 'Criar Cartão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remap / Delete Modal when deleting an account */}
      {deletingAcc && (() => {
        const count = transactions.filter(t => t.accountId === deletingAcc.id).length;
        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/10">
                <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {count > 0 ? 'Reatribuir Transações Ativas' : 'Excluir Conta'}
                </h3>
                <button 
                  onClick={() => setDeletingAcc(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {count > 0 ? (
                  <>
                    <div className="space-y-2 text-xs text-slate-500 font-medium leading-relaxed">
                      <p>
                        A conta <b>&quot;{deletingAcc.name}&quot;</b> possui transações vinculadas no sistema.
                      </p>
                      <p>
                        Para excluí-la com segurança, você precisa escolher outra conta ativa para onde as transações existentes serão migradas.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase">Conta de Destino</label>
                      <select
                        required
                        value={remapAccId}
                        onChange={(e) => setRemapAccId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-bold"
                      >
                        <option value="">-- Selecione uma conta destino --</option>
                        {accounts
                          .filter(a => a.id !== deletingAcc.id)
                          .map(a => (
                            <option key={a.id} value={a.id}>{a.name} (R$ {a.balance.toLocaleString('pt-BR')})</option>
                          ))
                        }
                      </select>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-600">
                    Tem certeza de que deseja excluir a conta <b>&quot;{deletingAcc.name}&quot;</b>?
                  </p>
                )}

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletingAcc(null)}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={count > 0 && !remapAccId}
                    onClick={handleConfirmDeleteWithRemap}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {count > 0 ? 'Reatribuir e Excluir' : 'Excluir'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Credit Card Modal */}
      {deletingCard && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-800">Excluir Cartão de Crédito</h3>
            <p className="text-xs text-slate-500">
              Tem certeza de que deseja excluir o cartão &quot;{deletingCard.name}&quot;?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCard(null)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteCreditCard) onDeleteCreditCard(deletingCard.id);
                  setDeletingCard(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
