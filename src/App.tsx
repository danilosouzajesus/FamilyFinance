import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionsManager from './components/TransactionsManager';
import StagingInbox from './components/StagingInbox';
import FamilyBudgets from './components/FamilyBudgets';
import FamilyGoals from './components/FamilyGoals';
import FamilyMembers from './components/FamilyMembers';
import Reports from './components/Reports';
import AIAdvisor from './components/AIAdvisor';
import CategoryManager from './components/CategoryManager';
import SubscriptionsManager from './components/SubscriptionsManager';
import InvestmentsManager from './components/InvestmentsManager';
import BankIntegration from './components/BankIntegration';
import SecurityAndSettings from './components/SecurityAndSettings';
import NotificationsCenter from './components/NotificationsCenter';
import AccountsAndCardsManager from './components/AccountsAndCardsManager';
import AuthModal from './components/AuthModal';
import PasswordResetScreen from './components/PasswordResetScreen';
import UserMenu from './components/UserMenu';
import PremiumFeatures from './components/PremiumFeatures';
import { getInitialState, saveState } from './utils/initialData';
import { FinancialState, Transaction, Budget, MonthlyGoal, Goal, FamilyMember, Account, Subscription, Debt, Investment, AutomationRule, Category, Subcategory, Tag, AuditLog, AppNotification, CreditCard, Invoice } from './types';
import { Download, Upload, RefreshCw, Database, AlertCircle, CheckCircle2, User as UserIcon, LogIn, LogOut, Loader2, AlertTriangle } from 'lucide-react';
import { User, Session } from '@supabase/supabase-js';
import { 
  getSupabaseClient, 
  fetchStateFromSupabase, 
  runSupabaseDiagnostics,
  SupabaseDiagnosticInfo,
  syncTransaction, 
  syncCategory, 
  syncAccount, 
  syncBudget, 
  syncMonthlyGoal,
  syncGoal, 
  syncSubscription, 
  syncDebt, 
  syncInvestment, 
  syncAutomationRule, 
  syncFamilyMember,
  syncTag,
  syncCreditCard,
  syncInvoice
} from './lib/supabase';
import {
  ensureInvoice,
  ensureInstallmentInvoices,
  assignInvoicePeriod,
  recalcInvoiceTotals,
  computeInvoiceTotal,
  parseInvoiceId,
  autoUpdateInvoiceStatuses,
  pad2,
} from './utils/invoiceEngine';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
            <AlertTriangle size={48} className="text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Oops! Algo deu errado</h2>
            <p className="text-slate-500 mb-6">Ocorreu um erro inesperado. Tente recarregar a página.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Recarregar página
            </button>
            {this.state.error && (
              <details className="mt-4 text-left text-xs text-slate-400">
                <summary className="cursor-pointer mb-2">Detalhes do erro</summary>
                <pre className="bg-slate-100 p-2 rounded overflow-auto">{this.state.error.toString()}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


export default function App() {
  // Load initial state (loads from localStorage or defaults)
  const [state, setState] = useState<FinancialState>(() => getInitialState());
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isPrivateMode, setIsPrivateMode] = useState<boolean>(false);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(() => !!getSupabaseClient());
  const [supabaseDiagnostic, setSupabaseDiagnostic] = useState<SupabaseDiagnosticInfo | null>(null);

  // Supabase Auth states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  const handleFetchFromSupabase = async () => {
    const client = getSupabaseClient();
    if (!client) {
      setSupabaseConnected(false);
      setSupabaseDiagnostic(null);
      return;
    }
    setSupabaseConnected(true);
    setIsSyncing(true);
    try {
      const diag = await runSupabaseDiagnostics();
      setSupabaseDiagnostic(diag);

      const remoteState = await fetchStateFromSupabase();
      if (remoteState) {
        setState(prev => ({
          ...prev,
          ...remoteState,
        }));
      }
    } catch (err) {
      console.error('Error fetching state from Supabase:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    handleFetchFromSupabase();

    // Listen to credential changes (e.g., from settings page)
    const onConfigChanged = () => {
      handleFetchFromSupabase();
    };

    window.addEventListener('supabase_config_changed', onConfigChanged);
    return () => {
      window.removeEventListener('supabase_config_changed', onConfigChanged);
    };
  }, []);

  // Listen to Supabase Auth Session
  useEffect(() => {
    const client = getSupabaseClient();
    if (client) {
      const checkSession = async () => {
        try {
          const { data: { session } } = await client.auth.getSession();
          setCurrentSession(session);
          setCurrentUser(session?.user ?? null);
        } catch (err) {
          console.error('Error getting Supabase session:', err);
        } finally {
          setIsAuthReady(true);
        }
      };
      checkSession();

      // Safety net: never keep the app on the loading screen if the session
      // request hangs (offline, CORS, project not ready, etc.)
      const safetyTimer = setTimeout(() => setIsAuthReady(true), 4000);

      const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        setCurrentSession(session);
        setCurrentUser(session?.user ?? null);
        setIsAuthReady(true);
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
          // Remove o code da URL para não reutilizar o token em um refresh
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        if (session) {
          handleFetchFromSupabase();
        }
      });

      return () => {
        subscription.unsubscribe();
        clearTimeout(safetyTimer);
      };
    } else {
      setCurrentSession(null);
      setCurrentUser(null);
      setIsAuthReady(true);
    }
  }, [supabaseConnected]);

  // Redirect to the login screen when the user is not authenticated
  const requireLogin = isAuthReady && !currentUser;

  const handleSignOut = async () => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    setCurrentSession(null);
    setCurrentUser(null);
  };

  // Sync state to LocalStorage on changes

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Combined Total Balance calculation
  const totalBalance = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);

  // Unread notification count + periodic alert checks
  const unreadNotifications = (state.notifications || []).filter(n => !n.read).length;

  useEffect(() => {
    handleCheckAlerts();
    const interval = setInterval(() => handleCheckAlerts(), 1000 * 60 * 30);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automação de status das faturas (OPEN → CLOSED → OVERDUE)
  useEffect(() => {
    const applyInvoiceAutomation = () => {
      setState(prev => {
        const invoices = prev.invoices || [];
        if (!invoices.length) return prev;
        const updated = autoUpdateInvoiceStatuses(invoices);
        const changed = updated.filter((inv, i) => inv.status !== invoices[i].status);
        if (!changed.length) return prev;
        // Persiste apenas as faturas cujo status mudou
        changed.forEach(inv => { syncInvoice(inv); });
        return { ...prev, invoices: updated };
      });
    };
    applyInvoiceAutomation();
    const interval = setInterval(applyInvoiceAutomation, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  // ==========================================
  // TRANSACTION CRUD HANDLERS
  // ==========================================
  const handleAddTransaction = async (newTxData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...newTxData,
      id: `tx_${Date.now()}`
    };

    let targetAccount: Account | null = null;
    let affectedInvoices: Invoice[] = [];
    setState(prev => {
      // Compras de cartão (includeInBalanceSum=false) não debitam o saldo na compra.
      // Pagamentos de fatura (invoice_payment) debitam o saldo da conta de pagamento.
      const shouldAdjustBalance = newTx.includeInBalanceSum !== false && newTx.type !== 'invoice_payment';

      const updatedAccounts = prev.accounts.map(acc => {
        if (acc.id === newTx.accountId && shouldAdjustBalance && newTx.status !== 'PENDENTE') {
          const multiplier = newTx.type === 'income' ? 1 : -1;
          const updated = {
            ...acc,
            balance: acc.balance + (newTx.amount * multiplier)
          };
          targetAccount = updated;
          return updated;
        }
        return acc;
      });

      // Recálculo do total da fatura vinculada (criando a fatura se necessário)
      let updatedInvoices = prev.invoices || [];
      if (newTx.invoiceId && newTx.type !== 'invoice_payment') {
        const existingIdx = updatedInvoices.findIndex(i => i.id === newTx.invoiceId);
        if (existingIdx === -1 && newTx.creditCardId) {
          const card = (prev.creditCards || []).find(c => c.id === newTx.creditCardId);
          if (card) {
            const { year: iy, month: im } = parseInvoiceId(newTx.invoiceId);
            if (iy && im) {
              const inv = ensureInvoice(prev.invoices || [], card, iy, im);
              inv.totalAmount = computeInvoiceTotal([newTx, ...prev.transactions], newTx.invoiceId);
              updatedInvoices = [...updatedInvoices, inv];
              affectedInvoices.push(inv);
            }
          }
        } else if (existingIdx !== -1) {
          const updated = {
            ...updatedInvoices[existingIdx],
            totalAmount: computeInvoiceTotal([newTx, ...prev.transactions], newTx.invoiceId)
          };
          updatedInvoices = updatedInvoices.map(i => i.id === newTx.invoiceId ? updated : i);
          affectedInvoices.push(updated);
        }
      }

      return {
        ...prev,
        transactions: [newTx, ...prev.transactions],
        accounts: updatedAccounts,
        invoices: updatedInvoices
      };
    });

    // Write to Supabase (fatura primeiro, pois transactions tem FK para invoices)
    for (const inv of affectedInvoices) {
      await syncInvoice(inv);
    }
    await syncTransaction(newTx);
    if (targetAccount) {
      await syncAccount(targetAccount);
    }
  };

  const handleEditTransaction = async (
    id: string, 
    updatedFields: Partial<Transaction>, 
    scope: 'only_this' | 'from_now' | 'all'
  ) => {
    let affectedTxs: Transaction[] = [];
    let affectedAccounts: Account[] = [];
    let affectedInvoices: Invoice[] = [];

    setState(prev => {
      const originalTx = prev.transactions.find(t => t.id === id);
      if (!originalTx) return prev;

      // Identify transaction IDs to edit based on scope
      const targetIds = new Set<string>();
      targetIds.add(id);

      const groupId = originalTx.recurrenceGroupId;

      if (scope === 'all' && originalTx.recurring !== 'none') {
        prev.transactions.forEach(t => {
          if (!t.deleted_at && (
            (groupId && t.recurrenceGroupId === groupId) ||
            (!groupId && t.category === originalTx.category && t.recurring === originalTx.recurring)
          )) {
            targetIds.add(t.id);
          }
        });
      } else if (scope === 'from_now' && originalTx.recurring !== 'none') {
        prev.transactions.forEach(t => {
          if (!t.deleted_at && t.date >= originalTx.date && (
            (groupId && t.recurrenceGroupId === groupId) ||
            (!groupId && t.category === originalTx.category && t.recurring === originalTx.recurring)
          )) {
            targetIds.add(t.id);
          }
        });
      }

      // Recalculate balances: Revert old tx values, apply new ones
      const updatedAccounts = [...prev.accounts];

      const newTransactions = prev.transactions.map(t => {
        if (targetIds.has(t.id)) {
          const finalTx = { ...t, ...updatedFields };
          affectedTxs.push(finalTx);

          // Revert old transaction effect on account (only if status was REALIZADO and affects balance)
          if (t.status !== 'PENDENTE' && t.includeInBalanceSum !== false && t.type !== 'invoice_payment') {
            const accIdxOld = updatedAccounts.findIndex(a => a.id === t.accountId);
            if (accIdxOld !== -1) {
              const oldMultiplier = t.type === 'income' ? -1 : 1;
              updatedAccounts[accIdxOld] = {
                ...updatedAccounts[accIdxOld],
                balance: updatedAccounts[accIdxOld].balance + (t.amount * oldMultiplier)
              };
            }
          }

          // Apply new transaction effect on account (only if new status is REALIZADO and affects balance)
          if (finalTx.status !== 'PENDENTE' && finalTx.includeInBalanceSum !== false && finalTx.type !== 'invoice_payment') {
            const accIdxNew = updatedAccounts.findIndex(a => a.id === finalTx.accountId);
            if (accIdxNew !== -1) {
              const newMultiplier = finalTx.type === 'income' ? 1 : -1;
              updatedAccounts[accIdxNew] = {
                ...updatedAccounts[accIdxNew],
                balance: updatedAccounts[accIdxNew].balance + (finalTx.amount * newMultiplier)
              };
            }
          }

          return finalTx;
        }
        return t;
      });

      affectedAccounts = updatedAccounts;

      // Recalcula totais das faturas afetadas pelas transações editadas
      const invoiceIdsAffected = new Set(affectedTxs.map(t => t.invoiceId).filter(Boolean));
      const recalculated = recalcInvoiceTotals(newTransactions, prev.invoices || []);
      affectedInvoices = recalculated.filter(i => invoiceIdsAffected.has(i.id) && i.status !== 'PAID');

      return {
        ...prev,
        transactions: newTransactions,
        accounts: updatedAccounts,
        invoices: recalculated
      };
    });

    // Sync to Supabase
    for (const tx of affectedTxs) {
      await syncTransaction(tx);
    }
    for (const acc of affectedAccounts) {
      await syncAccount(acc);
    }
    for (const inv of affectedInvoices) {
      await syncInvoice(inv);
    }
  };

  const handleDeleteTransaction = async (id: string, scope: 'only_this' | 'from_now' | 'all') => {
    let softDeletedTxs: Transaction[] = [];
    let affectedAccounts: Account[] = [];
    let affectedInvoices: Invoice[] = [];
    const now = new Date().toISOString();

    setState(prev => {
      const originalTx = prev.transactions.find(t => t.id === id);
      if (!originalTx) return prev;

      // Identify transaction IDs to soft-delete based on scope
      const targetIds = new Set<string>();
      targetIds.add(id);

      const groupId = originalTx.recurrenceGroupId;

      if (scope === 'all' && originalTx.recurring !== 'none') {
        prev.transactions.forEach(t => {
          if (!t.deleted_at && (
            (groupId && t.recurrenceGroupId === groupId) ||
            (!groupId && t.category === originalTx.category && t.recurring === originalTx.recurring)
          )) {
            targetIds.add(t.id);
          }
        });
      } else if (scope === 'from_now' && originalTx.recurring !== 'none') {
        prev.transactions.forEach(t => {
          if (!t.deleted_at && t.date >= originalTx.date && (
            (groupId && t.recurrenceGroupId === groupId) ||
            (!groupId && t.category === originalTx.category && t.recurring === originalTx.recurring)
          )) {
            targetIds.add(t.id);
          }
        });
      }

      // Revert account balances only for REALIZADO transactions
      const updatedAccounts = [...prev.accounts];
      
      prev.transactions.forEach(t => {
        if (targetIds.has(t.id) && !t.deleted_at) {
          const withDeleted = { ...t, deleted_at: now };
          softDeletedTxs.push(withDeleted);
          // Only revert balance if transaction was already realized and affects balance
          if (t.status !== 'PENDENTE' && t.includeInBalanceSum !== false && t.type !== 'invoice_payment') {
            const accIdx = updatedAccounts.findIndex(a => a.id === t.accountId);
            if (accIdx !== -1) {
              const revertMultiplier = t.type === 'income' ? -1 : 1;
              updatedAccounts[accIdx] = {
                ...updatedAccounts[accIdx],
                balance: updatedAccounts[accIdx].balance + (t.amount * revertMultiplier)
              };
            }
          }
        }
      });

      // Apply soft delete (mark deleted_at, keep in array)
      const newTransactions = prev.transactions.map(t =>
        targetIds.has(t.id) && !t.deleted_at ? { ...t, deleted_at: now } : t
      );
      affectedAccounts = updatedAccounts;

      // Recalcula totais das faturas das transações excluídas
      const invoiceIdsAffected = new Set(softDeletedTxs.map(t => t.invoiceId).filter(Boolean));
      const recalculated = recalcInvoiceTotals(newTransactions, prev.invoices || []);
      affectedInvoices = recalculated.filter(i => invoiceIdsAffected.has(i.id) && i.status !== 'PAID');

      return {
        ...prev,
        transactions: newTransactions,
        accounts: updatedAccounts,
        invoices: recalculated
      };
    });

    // Sync to Supabase
    for (const tx of softDeletedTxs) {
      await syncTransaction(tx, true);
    }
    for (const acc of affectedAccounts) {
      await syncAccount(acc);
    }
    for (const inv of affectedInvoices) {
      await syncInvoice(inv);
    }
  };


  // ==========================================
  // ACCOUNT CRUD HANDLERS
  // ==========================================
  const handleAddAccount = async (newAcc: Account) => {
    setState(prev => ({
      ...prev,
      accounts: [...prev.accounts, newAcc]
    }));
    await syncAccount(newAcc);
  };

  const handleEditAccount = async (id: string, updatedFields: Partial<Account>) => {
    let targetAcc: Account | null = null;
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.map(a => {
        if (a.id === id) {
          targetAcc = { ...a, ...updatedFields };
          return targetAcc;
        }
        return a;
      })
    }));
    if (targetAcc) {
      await syncAccount(targetAcc);
    }
  };

  const handleDeleteAccount = async (id: string, remapAccountId?: string) => {
    let remappedTxs: Transaction[] = [];
    let targetRemapAcc: Account | null = null;

    setState(prev => {
      let currentTransactions = [...prev.transactions];
      let currentAccounts = prev.accounts.filter(a => a.id !== id);

      if (remapAccountId) {
        // Move all transactions from deleted account to remap account
        currentTransactions = prev.transactions.map(t => {
          if (t.accountId === id) {
            const updatedTx = { ...t, accountId: remapAccountId };
            remappedTxs.push(updatedTx);
            return updatedTx;
          }
          return t;
        });

        // Adjust the balance of the remap account by adding the deleted account's balance
        const deletedAcc = prev.accounts.find(a => a.id === id);
        if (deletedAcc) {
          currentAccounts = currentAccounts.map(a => {
            if (a.id === remapAccountId) {
              const updatedAcc = { ...a, balance: a.balance + deletedAcc.balance };
              targetRemapAcc = updatedAcc;
              return updatedAcc;
            }
            return a;
          });
        }
      }

      return {
        ...prev,
        transactions: currentTransactions,
        accounts: currentAccounts
      };
    });

    // Delete account from Supabase
    await syncAccount({ id } as Account, true);

    // Sync all modified/remapped transactions and account balances to Supabase
    for (const tx of remappedTxs) {
      await syncTransaction(tx);
    }
    if (targetRemapAcc) {
      await syncAccount(targetRemapAcc);
    }
  };


  // ==========================================
  // CREDIT CARD CRUD HANDLERS
  // ==========================================
  const handleAddCreditCard = async (newCardData: Omit<CreditCard, 'id'>) => {
    const newCard: CreditCard = {
      ...newCardData,
      id: `card_${Date.now()}`
    };
    setState(prev => ({
      ...prev,
      creditCards: [...(prev.creditCards || []), newCard]
    }));
    await syncCreditCard(newCard);
  };

  const handleEditCreditCard = async (id: string, updatedFields: Partial<CreditCard>) => {
    let targetCard: CreditCard | null = null;
    setState(prev => ({
      ...prev,
      creditCards: (prev.creditCards || []).map(c => {
        if (c.id === id) {
          targetCard = { ...c, ...updatedFields };
          return targetCard;
        }
        return c;
      })
    }));
    if (targetCard) {
      await syncCreditCard(targetCard);
    }
  };

  const handleDeleteCreditCard = async (id: string) => {
    let orphanTxs: Transaction[] = [];
    let affectedInvoices: Invoice[] = [];
    setState(prev => {
      orphanTxs = prev.transactions
        .filter(t => !t.deleted_at && t.creditCardId === id)
        .map(t => ({ ...t, creditCardId: undefined, invoiceId: undefined }));
      affectedInvoices = (prev.invoices || []).filter(i => i.creditCardId === id);
      return {
        ...prev,
        creditCards: (prev.creditCards || []).filter(c => c.id !== id),
        invoices: (prev.invoices || []).filter(i => i.creditCardId !== id),
        transactions: prev.transactions.map(t => {
          if (t.creditCardId === id) {
            return { ...t, creditCardId: undefined, invoiceId: undefined };
          }
          return t;
        }),
      };
    });
    await syncCreditCard({ id } as CreditCard, true);
    for (const tx of orphanTxs) {
      await syncTransaction(tx);
    }
    for (const inv of affectedInvoices) {
      await syncInvoice(inv, true);
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    const inv = state.invoices?.find(i => i.id === invoiceId);
    if (!inv) return;
    const card = (state.creditCards || []).find(c => c.id === inv.creditCardId);
    if (!card) return;

    const payTx: Transaction = {
      id: `tx_${Date.now()}_inv`,
      type: 'invoice_payment',
      categoryId: '',
      category: 'Pagamento de Fatura',
      subcategory: '',
      tagIds: [],
      amount: inv.totalAmount,
      date: new Date().toISOString().split('T')[0],
      recurring: 'none',
      notes: `Pagamento da fatura do cartão ${card.name} (${pad2(inv.month)}/${inv.year})`,
      memberId: state.familyMembers[0]?.id || '',
      accountId: card.accountId,
      attachmentUrls: [],
      attachmentNames: [],
      status: 'REALIZADO',
      includeInBalanceSum: true,
    };

    let targetAccount: Account | null = null;
    setState(prev => {
      const updatedAccounts = prev.accounts.map(acc => {
        if (acc.id === card.accountId) {
          const updated = { ...acc, balance: acc.balance - inv.totalAmount };
          targetAccount = updated;
          return updated;
        }
        return acc;
      });
      const paidInv: Invoice = { ...inv, status: 'PAID', paidAt: new Date().toISOString() };
      return {
        ...prev,
        transactions: [payTx, ...prev.transactions],
        accounts: updatedAccounts,
        invoices: (prev.invoices || []).map(i => i.id === invoiceId ? paidInv : i),
      };
    });

    await syncTransaction(payTx);
    await syncInvoice({ ...inv, status: 'PAID', paidAt: new Date().toISOString() });
    if (targetAccount) {
      await syncAccount(targetAccount);
    }
  };


  // ==========================================
  // BUDGET CRUD HANDLERS
  // ==========================================
  const handleAddBudget = async (newBudgetData: Omit<Budget, 'id'>) => {
    const newBudget: Budget = {
      ...newBudgetData,
      id: `bud_${Date.now()}`
    };
    setState(prev => ({
      ...prev,
      budgets: [...prev.budgets, newBudget]
    }));
    await syncBudget(newBudget);
  };

  const handleEditBudget = async (id: string, updatedFields: Partial<Budget>) => {
    let targetBud: Budget | null = null;
    setState(prev => ({
      ...prev,
      budgets: prev.budgets.map(b => {
        if (b.id === id) {
          targetBud = { ...b, ...updatedFields };
          return targetBud;
        }
        return b;
      })
    }));
    if (targetBud) {
      await syncBudget(targetBud);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    setState(prev => ({
      ...prev,
      budgets: prev.budgets.filter(b => b.id !== id)
    }));
    await syncBudget({ id } as Budget, true);
  };

  // ==========================================
  // MONTHLY GOAL (METAS DE GASTOS GERAIS) CRUD HANDLERS
  // ==========================================
  const handleAddMonthlyGoal = async (newGoalData: Omit<MonthlyGoal, 'id'>) => {
    const newGoal: MonthlyGoal = {
      ...newGoalData,
      id: `mgoal_${Date.now()}`
    };
    setState(prev => ({
      ...prev,
      monthlyGoals: [...(prev.monthlyGoals || []), newGoal]
    }));
    await syncMonthlyGoal(newGoal);
  };

  const handleEditMonthlyGoal = async (id: string, updatedFields: Partial<MonthlyGoal>) => {
    let targetGoal: MonthlyGoal | null = null;
    setState(prev => ({
      ...prev,
      monthlyGoals: (prev.monthlyGoals || []).map(g => {
        if (g.id === id) {
          targetGoal = { ...g, ...updatedFields };
          return targetGoal;
        }
        return g;
      })
    }));
    if (targetGoal) {
      await syncMonthlyGoal(targetGoal);
    }
  };

  const handleDeleteMonthlyGoal = async (id: string) => {
    setState(prev => ({
      ...prev,
      monthlyGoals: (prev.monthlyGoals || []).filter(g => g.id !== id)
    }));
    await syncMonthlyGoal({ id } as MonthlyGoal, true);
  };

  // ==========================================
  // SAVINGS GOAL CRUD HANDLERS
  // ==========================================
  const handleAddGoal = async (newGoalData: Omit<Goal, 'id'>) => {
    const newGoal: Goal = {
      ...newGoalData,
      id: `goal_${Date.now()}`
    };
    let extraTxList: Transaction[] = [];
    let targetAccounts: Account[] = [];

    setState(prev => {
      let updatedAccounts = prev.accounts;
      const initialContribs = newGoal.contributions || [];

      if (initialContribs.length > 0) {
        const accId = newGoal.accountId || prev.accounts[0]?.id || 'acc_itau';
        const linkedAccount = prev.accounts.find(a => a.id === accId);

        for (const c of initialContribs) {
          const isDeposit = c.type === 'deposit';
          const newTx: Transaction = {
            id: `tx_goalcontrib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: isDeposit ? 'expense' : 'income',
            categoryId: newGoal.categoryId || prev.categories.find(cat => cat.name === 'Outras Receitas')?.id || '',
            category: prev.categories.find(cat => cat.id === newGoal.categoryId)?.name || 'Outras',
            subcategory: isDeposit ? 'Aporte em Meta' : 'Resgate de Meta',
            tagIds: [],
            amount: c.amount,
            date: c.date || new Date().toISOString().split('T')[0],
            recurring: 'none',
            notes: isDeposit
              ? `Aporte de R$ ${c.amount.toFixed(2)} na meta "${newGoal.name}"`
              : `Resgate de R$ ${c.amount.toFixed(2)} da meta "${newGoal.name}"`,
            memberId: c.memberId || 'mem_geral',
            accountId: accId,
            attachmentUrls: [],
            attachmentNames: [],
            status: 'REALIZADO'
          };
          extraTxList.push(newTx);

          if (linkedAccount) {
            updatedAccounts = prev.accounts.map(acc => {
              if (acc.id === accId) {
                const updatedAcc = {
                  ...acc,
                  balance: isDeposit ? acc.balance - c.amount : acc.balance + c.amount
                };
                targetAccounts = targetAccounts.filter(a => a.id !== accId);
                targetAccounts.push(updatedAcc);
                return updatedAcc;
              }
              return acc;
            });
          }
        }
      }

      return {
        ...prev,
        goals: [...prev.goals, newGoal],
        transactions: [...extraTxList, ...prev.transactions],
        accounts: updatedAccounts
      };
    });

    await syncGoal(newGoal);
    for (const extraTx of extraTxList) {
      await syncTransaction(extraTx);
    }
    for (const targetAccount of targetAccounts) {
      await syncAccount(targetAccount);
    }
  };

  const handleEditGoal = async (id: string, updatedFields: Partial<Goal>) => {
    let targetGoal: Goal | null = null;
    let extraTxList: Transaction[] = [];
    let targetAccounts: Account[] = [];

    setState(prev => {
      const currentGoal = prev.goals.find(g => g.id === id);

      // Detect new contributions (aportes/resgates) to move money from/to the linked account
      const oldContribs = currentGoal?.contributions || [];
      const newContribs = updatedFields.contributions || oldContribs;

      let updatedAccounts = prev.accounts;

      if (currentGoal) {
        const accId = currentGoal.accountId || prev.accounts[0]?.id || 'acc_itau';
        const today = new Date().toISOString().split('T')[0];
        const linkedAccount = prev.accounts.find(a => a.id === accId);

        const newOnes = newContribs.slice(oldContribs.length);
        for (const c of newOnes) {
          const isDeposit = c.type === 'deposit';
          const newTx: Transaction = {
            id: `tx_goalcontrib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: isDeposit ? 'expense' : 'income',
            categoryId: currentGoal.categoryId || prev.categories.find(cat => cat.name === 'Outras Receitas')?.id || '',
            category: prev.categories.find(cat => cat.id === currentGoal.categoryId)?.name || 'Outras',
            subcategory: isDeposit ? 'Aporte em Meta' : 'Resgate de Meta',
            tagIds: [],
            amount: c.amount,
            date: c.date || today,
            recurring: 'none',
            notes: isDeposit
              ? `Aporte de R$ ${c.amount.toFixed(2)} na meta "${currentGoal.name}"`
              : `Resgate de R$ ${c.amount.toFixed(2)} da meta "${currentGoal.name}"`,
            memberId: c.memberId || 'mem_geral',
            accountId: accId,
            attachmentUrls: [],
            attachmentNames: [],
            status: 'REALIZADO'
          };
          extraTxList.push(newTx);

          if (linkedAccount) {
            updatedAccounts = prev.accounts.map(acc => {
              if (acc.id === accId) {
                const updatedAcc = {
                  ...acc,
                  balance: isDeposit ? acc.balance - c.amount : acc.balance + c.amount
                };
                targetAccounts = targetAccounts.filter(a => a.id !== accId);
                targetAccounts.push(updatedAcc);
                return updatedAcc;
              }
              return acc;
            });
          }
        }
      }

      const newGoals = prev.goals.map(g => {
        if (g.id === id) {
          targetGoal = { ...g, ...updatedFields };
          return targetGoal;
        }
        return g;
      });

      return {
        ...prev,
        goals: newGoals,
        transactions: [...extraTxList, ...prev.transactions],
        accounts: updatedAccounts
      };
    });

    if (targetGoal) {
      await syncGoal(targetGoal);
    }
    for (const extraTx of extraTxList) {
      await syncTransaction(extraTx);
    }
    for (const targetAccount of targetAccounts) {
      await syncAccount(targetAccount);
    }
  };

  const handleDeleteGoal = async (id: string, revertTransactions: boolean = false) => {
    let reversedTx: Transaction | null = null;
    let targetAccount: Account | null = null;

    setState(prev => {
      const targetGoal = prev.goals.find(g => g.id === id);
      let updatedAccounts = prev.accounts;

      if (revertTransactions && targetGoal && targetGoal.currentAmount > 0) {
        const newTx: Transaction = {
          id: `tx_goalrev_${Date.now()}`,
          type: 'income',
          categoryId: targetGoal.categoryId || 'cat_rec_outros',
          category: prev.categories.find(c => c.id === targetGoal.categoryId)?.name || 'Outras Receitas',
          subcategoryId: undefined,
          subcategory: '',
          tagIds: [],
          amount: targetGoal.currentAmount,
          date: new Date().toISOString().split('T')[0],
          recurring: 'none',
          notes: `Reversão de valores acumulados da meta "${targetGoal.name}"`,
          memberId: 'mem_geral',
          accountId: targetGoal.accountId || prev.accounts[0]?.id || 'acc_itau',
          attachmentUrls: [],
          attachmentNames: [],
          status: 'REALIZADO',
        };
        reversedTx = newTx;
        updatedAccounts = prev.accounts.map(acc => {
          if (acc.id === newTx.accountId) {
            const updated = { ...acc, balance: acc.balance + newTx.amount };
            targetAccount = updated;
            return updated;
          }
          return acc;
        });
      }

      return {
        ...prev,
        goals: prev.goals.filter(g => g.id !== id),
        transactions: reversedTx ? [reversedTx, ...prev.transactions] : prev.transactions,
        accounts: updatedAccounts
      };
    });

    await syncGoal({ id } as Goal, true);
    if (reversedTx) {
      await syncTransaction(reversedTx);
    }
    if (targetAccount) {
      await syncAccount(targetAccount);
    }
  };

  // ==========================================
  // FAMILY MEMBER CRUD HANDLERS
  // ==========================================
  const handleAddMember = async (newMemberData: Omit<FamilyMember, 'id'>) => {
    const newMember: FamilyMember = {
      ...newMemberData,
      id: `mem_${Date.now()}`
    };
    setState(prev => ({
      ...prev,
      familyMembers: [...prev.familyMembers, newMember]
    }));
    await syncFamilyMember(newMember);
  };

  const handleEditMember = async (id: string, updatedFields: Partial<FamilyMember>) => {
    let targetMem: FamilyMember | null = null;
    setState(prev => ({
      ...prev,
      familyMembers: prev.familyMembers.map(m => {
        if (m.id === id) {
          targetMem = { ...m, ...updatedFields };
          return targetMem;
        }
        return m;
      })
    }));
    if (targetMem) {
      await syncFamilyMember(targetMem);
    }
  };

  const handleDeleteMember = async (id: string) => {
    let affectedTxs: Transaction[] = [];
    setState(prev => {
      // Reassign transactions associated with deleted member to General Family ('mem_geral')
      const updatedTxs = prev.transactions.map(t => {
        if (t.memberId === id) {
          const updated = { ...t, memberId: 'mem_geral' };
          affectedTxs.push(updated);
          return updated;
        }
        return t;
      });

      return {
        ...prev,
        familyMembers: prev.familyMembers.filter(m => m.id !== id),
        transactions: updatedTxs
      };
    });

    await syncFamilyMember({ id } as FamilyMember, true);
    for (const tx of affectedTxs) {
      await syncTransaction(tx);
    }
  };


  // ==========================================
  // CATEGORIES CRUD HANDLERS
  // ==========================================
  const handleAddCategory = async (newCat: Category) => {
    setState(prev => ({
      ...prev,
      categories: [...prev.categories, newCat]
    }));
    await syncCategory(newCat);
  };

  const handleEditCategory = async (id: string, updatedFields: Partial<Category>) => {
    let targetCat: Category | null = null;
    setState(prev => ({
      ...prev,
      categories: prev.categories.map(c => {
        if (c.id === id) {
          targetCat = { ...c, ...updatedFields };
          return targetCat;
        }
        return c;
      })
    }));
    if (targetCat) {
      await syncCategory(targetCat);
    }
  };

  const handleDeleteCategory = async (id: string, remapCategoryId?: string) => {
    let remappedTxs: Transaction[] = [];
    let remappedSubs: Subcategory[] = [];
    setState(prev => {
      const targetCat = prev.categories.find(c => c.id === id);
      const remapCat = prev.categories.find(c => c.id === remapCategoryId);
      let updatedTxs = prev.transactions;
      let updatedSubs = prev.subcategories || [];
      
      if (targetCat && remapCat) {
        updatedTxs = prev.transactions.map(t => {
          if (t.categoryId === targetCat.id && !t.subcategoryId) {
            const updated = { ...t, categoryId: remapCat.id, category: remapCat.name };
            remappedTxs.push(updated);
            return updated;
          }
          return t;
        });
        updatedSubs = (prev.subcategories || []).map(s => {
          if (s.categoryId === targetCat.id) {
            const updated = { ...s, categoryId: remapCat.id };
            remappedSubs.push(updated);
            return updated;
          }
          return s;
        });
      }

      return {
        ...prev,
        categories: prev.categories.filter(c => c.id !== id),
        subcategories: updatedSubs,
        transactions: updatedTxs
      };
    });

    await syncCategory({ id } as Category, true);
    for (const tx of remappedTxs) {
      await syncTransaction(tx);
    }
    for (const sub of remappedSubs) {
      await syncCategory(sub as unknown as Category);
    }
  };

  // ==========================================
  // SUBCATEGORY CRUD HANDLERS
  // ==========================================
  const handleAddSubcategory = async (newSub: Subcategory) => {
    setState(prev => ({
      ...prev,
      subcategories: [...(prev.subcategories || []), newSub]
    }));
    await syncCategory(newSub as unknown as Category);
  };

  const handleEditSubcategory = async (id: string, updatedFields: Partial<Subcategory>) => {
    let targetSub: Subcategory | null = null;
    setState(prev => ({
      ...prev,
      subcategories: (prev.subcategories || []).map(s => {
        if (s.id === id) {
          targetSub = { ...s, ...updatedFields };
          return targetSub;
        }
        return s;
      })
    }));
    if (targetSub) {
      await syncCategory(targetSub as unknown as Category);
    }
  };

  const handleDeleteSubcategory = async (id: string, remapCategoryId?: string) => {
    let remappedTxs: Transaction[] = [];
    setState(prev => {
      const targetSub = (prev.subcategories || []).find(s => s.id === id);
      const remapSub = (prev.subcategories || []).find(s => s.id === remapCategoryId);
      let updatedTxs = prev.transactions;
      
      if (targetSub && remapSub) {
        updatedTxs = prev.transactions.map(t => {
          if (t.subcategoryId === targetSub.id) {
            const updated = { ...t, subcategoryId: remapSub.id, subcategory: remapSub.name };
            remappedTxs.push(updated);
            return updated;
          }
          return t;
        });
      }

      return {
        ...prev,
        subcategories: (prev.subcategories || []).filter(s => s.id !== id),
        transactions: updatedTxs
      };
    });

    for (const tx of remappedTxs) {
      await syncTransaction(tx);
    }
  };

  // ==========================================
  // TAG CRUD HANDLERS
  // ==========================================
  const handleAddTag = async (newTag: Tag) => {
    setState(prev => ({
      ...prev,
      tags: [...(prev.tags || []), newTag]
    }));
    await syncTag(newTag);
  };

  const handleEditTag = async (id: string, updatedFields: Partial<Tag>) => {
    let targetTag: Tag | null = null;
    setState(prev => ({
      ...prev,
      tags: (prev.tags || []).map(t => {
        if (t.id === id) {
          targetTag = { ...t, ...updatedFields };
          return targetTag;
        }
        return t;
      })
    }));
    if (targetTag) {
      await syncTag(targetTag);
    }
  };

  const handleDeleteTag = async (id: string) => {
    let remappedTxs: Transaction[] = [];
    setState(prev => {
      const updatedTxs = prev.transactions.map(t => {
        if (t.tagIds.includes(id)) {
          const updated = { ...t, tagIds: t.tagIds.filter(tagId => tagId !== id) };
          remappedTxs.push(updated);
          return updated;
        }
        return t;
      });
      return {
        ...prev,
        tags: (prev.tags || []).filter(t => t.id !== id),
        transactions: updatedTxs
      };
    });

    for (const tx of remappedTxs) {
      await syncTransaction(tx);
    }
    await syncTag({ id } as Tag, true);
  };

  // ==========================================
  // SUBSCRIPTION CRUD HANDLERS
  // ==========================================
  const handleAddSubscription = async (newSubData: Omit<Subscription, 'id'>, retroactiveMonths?: number) => {
    const newSub: Subscription = {
      ...newSubData,
      id: `sub_${Date.now()}`
    };

    let generatedTxs: Transaction[] = [];
    let affectedAccounts: Account[] = [];

    setState(prev => {
      const now = new Date();
      const billingDay = parseInt(newSub.billingDate) || now.getDate();
      const retroTxs: Transaction[] = [];
      let totalDeduction = 0;
      const targetAccountId = newSub.accountId || prev.accounts[0]?.id || 'acc_itau';

      for (let i = 1; i <= (retroactiveMonths || 0); i++) {
        const pastDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const daysInMonth = new Date(pastDate.getFullYear(), pastDate.getMonth() + 1, 0).getDate();
        const actualDay = Math.min(billingDay, daysInMonth);

        const year = pastDate.getFullYear();
        const month = String(pastDate.getMonth() + 1).padStart(2, '0');
        const day = String(actualDay).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const monthNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthLabel = monthNames[pastDate.getMonth()];

        retroTxs.push({
          id: `tx_retro_${Date.now()}_${i}`,
          type: 'expense',
          categoryId: prev.categories.find(c => c.name === newSub.category)?.id || '',
          category: newSub.category,
          subcategory: 'Mensalidade',
          tagIds: [],
          amount: newSub.amount,
          date: dateStr,
          recurring: 'none',
          notes: `Assinatura: ${newSub.name} - ${monthLabel} de ${year}`,
          memberId: newSub.memberId || 'mem_geral',
          accountId: targetAccountId,
          attachmentUrls: [],
          attachmentNames: [],
          status: 'REALIZADO'
        });

        totalDeduction += newSub.amount;
      }

      generatedTxs = retroTxs;

      const updatedAccounts = prev.accounts.map(acc => {
        if (acc.id === targetAccountId) {
          const updated = { ...acc, balance: acc.balance - totalDeduction };
          affectedAccounts.push(updated);
          return updated;
        }
        return acc;
      });

      return {
        ...prev,
        subscriptions: [...(prev.subscriptions || []), newSub],
        transactions: [...retroTxs, ...prev.transactions],
        accounts: updatedAccounts
      };
    });

    await syncSubscription(newSub);
    for (const tx of generatedTxs) {
      await syncTransaction(tx);
    }
    for (const acc of affectedAccounts) {
      await syncAccount(acc);
    }
  };

  const handleEditSubscription = async (id: string, updatedFields: Partial<Subscription>) => {
    let targetSub: Subscription | null = null;
    setState(prev => ({
      ...prev,
      subscriptions: (prev.subscriptions || []).map(s => {
        if (s.id === id) {
          targetSub = { ...s, ...updatedFields };
          return targetSub;
        }
        return s;
      })
    }));
    if (targetSub) {
      await syncSubscription(targetSub);
    }
  };

  const handleEditSubscriptionWithScope = async (
    id: string,
    updatedFields: Partial<Subscription>,
    scope: 'from_next' | 'history'
  ) => {
    let targetSub: Subscription | null = null;
    let affectedTxs: Transaction[] = [];
    let affectedAccounts: Account[] = [];

    setState(prev => {
      const currentSub = (prev.subscriptions || []).find(s => s.id === id);
      let updatedTxs = prev.transactions;

      if (currentSub && scope === 'history') {
        const oldAmount = currentSub.amount;
        const newAmount = updatedFields.amount ?? oldAmount;
        const delta = newAmount - oldAmount;
        const newAccountId = updatedFields.accountId ?? currentSub.accountId;

        updatedTxs = prev.transactions.map(t => {
          const isLinked = !t.deleted_at && t.notes.toLowerCase().includes(currentSub.name.toLowerCase());
          if (isLinked) {
            const updated = {
              ...t,
              amount: newAmount,
              category: updatedFields.category ?? t.category,
              accountId: newAccountId ?? t.accountId
            };
            affectedTxs.push(updated);

            if (t.status !== 'PENDENTE') {
              const accountChanged = newAccountId && newAccountId !== t.accountId;
              const multiplier = t.type === 'income' ? 1 : -1;

              // Estorna do saldo da conta antiga e debita/credita na nova conta
              if (accountChanged) {
                const oldAccIdx = affectedAccounts.findIndex(a => a.id === t.accountId);
                const oldBaseAcc = oldAccIdx !== -1 ? affectedAccounts[oldAccIdx] : prev.accounts.find(a => a.id === t.accountId);
                if (oldBaseAcc) {
                  const oldRestored = { ...oldBaseAcc, balance: oldBaseAcc.balance - (newAmount * multiplier) };
                  if (oldAccIdx !== -1) {
                    affectedAccounts[oldAccIdx] = oldRestored;
                  } else {
                    affectedAccounts.push(oldRestored);
                  }
                }

                const newAccIdx = affectedAccounts.findIndex(a => a.id === newAccountId);
                const newBaseAcc = newAccIdx !== -1 ? affectedAccounts[newAccIdx] : prev.accounts.find(a => a.id === newAccountId);
                if (newBaseAcc) {
                  const newCharged = { ...newBaseAcc, balance: newBaseAcc.balance + (newAmount * multiplier) };
                  if (newAccIdx !== -1) {
                    affectedAccounts[newAccIdx] = newCharged;
                  } else {
                    affectedAccounts.push(newCharged);
                  }
                }
              } else {
                const accIdx = affectedAccounts.findIndex(a => a.id === t.accountId);
                const baseAcc = accIdx !== -1 ? affectedAccounts[accIdx] : prev.accounts.find(a => a.id === t.accountId);
                if (baseAcc) {
                  const withDelta = { ...baseAcc, balance: baseAcc.balance + (delta * multiplier) };
                  if (accIdx !== -1) {
                    affectedAccounts[accIdx] = withDelta;
                  } else {
                    affectedAccounts.push(withDelta);
                  }
                }
              }
            }
            return updated;
          }
          return t;
        });
      }

      return {
        ...prev,
        subscriptions: (prev.subscriptions || []).map(s => {
          if (s.id === id) {
            targetSub = { ...s, ...updatedFields };
            return targetSub;
          }
          return s;
        }),
        transactions: updatedTxs
      };
    });

    if (targetSub) {
      await syncSubscription(targetSub);
    }
    for (const tx of affectedTxs) {
      await syncTransaction(tx);
    }
    for (const acc of affectedAccounts) {
      await syncAccount(acc);
    }
  };

  const handleDeleteSubscription = async (id: string, deleteAssociatedTransactions: boolean) => {
    let deletedTxs: Transaction[] = [];
    setState(prev => {
      const targetSub = (prev.subscriptions || []).find(s => s.id === id);
      let updatedTxs = prev.transactions;
      
      if (deleteAssociatedTransactions && targetSub) {
        deletedTxs = prev.transactions.filter(t => t.notes.toLowerCase().includes(targetSub.name.toLowerCase()));
        updatedTxs = prev.transactions.filter(t => !t.notes.toLowerCase().includes(targetSub.name.toLowerCase()));
      }

      return {
        ...prev,
        subscriptions: (prev.subscriptions || []).filter(s => s.id !== id),
        transactions: updatedTxs
      };
    });

    await syncSubscription({ id } as Subscription, true);
    for (const tx of deletedTxs) {
      await syncTransaction(tx, true);
    }
  };

  // ==========================================
  // AUTOMATION RULES CRUD HANDLERS
  // ==========================================
  const handleAddRule = async (newRuleData: Omit<AutomationRule, 'id'>) => {
    const newRule: AutomationRule = {
      ...newRuleData,
      id: `rule_${Date.now()}`
    };
    setState(prev => ({
      ...prev,
      automationRules: [...(prev.automationRules || []), newRule]
    }));
    await syncAutomationRule(newRule);
  };

  const handleEditRule = async (id: string, updatedFields: Partial<AutomationRule>) => {
    let targetRule: AutomationRule | null = null;
    setState(prev => ({
      ...prev,
      automationRules: (prev.automationRules || []).map(r => {
        if (r.id === id) {
          targetRule = { ...r, ...updatedFields };
          return targetRule;
        }
        return r;
      })
    }));
    if (targetRule) {
      await syncAutomationRule(targetRule);
    }
  };

  const handleDeleteRule = async (id: string) => {
    setState(prev => ({
      ...prev,
      automationRules: (prev.automationRules || []).filter(r => r.id !== id)
    }));
    await syncAutomationRule({ id } as AutomationRule, true);
  };

  // ==========================================
  // DEBTS CRUD HANDLERS
  // ==========================================
  const handleAddDebt = async (newDebtData: Omit<Debt, 'id'>) => {
    const newDebt: Debt = {
      ...newDebtData,
      id: `debt_${Date.now()}`
    };
    let extraTxList: Transaction[] = [];
    let targetAccounts: Account[] = [];

    setState(prev => {
      const paidCount = newDebt.paidInstallments || 0;
      let updatedAccounts = prev.accounts;

      if (paidCount > 0) {
        const accId = newDebt.accountId || prev.accounts[0]?.id || 'acc_itau';
        const today = new Date().toISOString().split('T')[0];
        const debitAccount = prev.accounts.find(a => a.id === accId);

        for (let i = 0; i < paidCount; i++) {
          const installmentNum = i + 1;
          const newTx: Transaction = {
            id: `tx_debt_${Date.now()}_${i}`,
            type: 'expense',
            categoryId: prev.categories.find(c => c.name === newDebt.category)?.id || '',
            category: newDebt.category,
            subcategory: 'Parcelas',
            tagIds: [],
            amount: newDebt.installmentAmount,
            date: today,
            recurring: 'none',
            notes: `Pago parcela ${installmentNum} de ${newDebt.name}`,
            memberId: 'mem_geral',
            accountId: accId,
            attachmentUrls: [],
            attachmentNames: [],
            status: 'REALIZADO'
          };
          extraTxList.push(newTx);
        }

        if (debitAccount) {
          updatedAccounts = prev.accounts.map(acc => {
            if (acc.id === accId) {
              const updatedAcc = {
                ...acc,
                balance: acc.balance - newDebt.installmentAmount * paidCount
              };
              targetAccounts.push(updatedAcc);
              return updatedAcc;
            }
            return acc;
          });
        }
      }

      return {
        ...prev,
        debts: [...(prev.debts || []), newDebt],
        transactions: [...extraTxList, ...prev.transactions],
        accounts: updatedAccounts
      };
    });

    await syncDebt(newDebt);
    for (const extraTx of extraTxList) {
      await syncTransaction(extraTx);
    }
    for (const targetAccount of targetAccounts) {
      await syncAccount(targetAccount);
    }
  };

  const handleEditDebt = async (id: string, updatedFields: Partial<Debt>) => {
    let targetDebt: Debt | null = null;
    let extraTxList: Transaction[] = [];
    let targetAccounts: Account[] = [];

    setState(prev => {
      const currentDebt = (prev.debts || []).find(d => d.id === id);
      const paidUpdated = updatedFields.paidInstallments !== undefined && currentDebt && updatedFields.paidInstallments > currentDebt.paidInstallments;
      const delta = paidUpdated && currentDebt ? (updatedFields.paidInstallments! - currentDebt.paidInstallments) : 0;

      let updatedAccounts = prev.accounts;

      if (delta > 0 && currentDebt) {
        const accId = currentDebt.accountId || prev.accounts[0]?.id || 'acc_itau';
        const today = new Date().toISOString().split('T')[0];
        const debitAccount = prev.accounts.find(a => a.id === accId);

        for (let i = 0; i < delta; i++) {
          const installmentNum = currentDebt.paidInstallments + i + 1;
          const newTx: Transaction = {
            id: `tx_debt_${Date.now()}_${i}`,
            type: 'expense',
            categoryId: prev.categories.find(c => c.name === currentDebt.category)?.id || '',
            category: currentDebt.category,
            subcategory: 'Parcelas',
            tagIds: [],
            amount: currentDebt.installmentAmount,
            date: today,
            recurring: 'none',
            notes: `Pago parcela ${installmentNum} de ${currentDebt.name}`,
            memberId: 'mem_geral',
            accountId: accId,
            attachmentUrls: [],
            attachmentNames: [],
            status: 'REALIZADO'
          };
          extraTxList.push(newTx);
        }

        if (debitAccount) {
          updatedAccounts = prev.accounts.map(acc => {
            if (acc.id === accId) {
              const updatedAcc = {
                ...acc,
                balance: acc.balance - currentDebt.installmentAmount * delta
              };
              targetAccounts.push(updatedAcc);
              return updatedAcc;
            }
            return acc;
          });
        }
      }

      const newDebts = (prev.debts || []).map(d => {
        if (d.id === id) {
          targetDebt = { ...d, ...updatedFields };
          return targetDebt;
        }
        return d;
      });

      return {
        ...prev,
        debts: newDebts,
        transactions: [...extraTxList, ...prev.transactions],
        accounts: updatedAccounts
      };
    });

    if (targetDebt) {
      await syncDebt(targetDebt);
    }
    for (const extraTx of extraTxList) {
      await syncTransaction(extraTx);
    }
    for (const targetAccount of targetAccounts) {
      await syncAccount(targetAccount);
    }
  };

  const handleDeleteDebt = async (id: string, revertInstallments: boolean = false) => {
    let deletedTxs: Transaction[] = [];
    let targetAccounts: Account[] = [];

    setState(prev => {
      const targetDebt = (prev.debts || []).find(d => d.id === id);
      let updatedTxs = prev.transactions;
      let updatedAccounts = prev.accounts;

      if (revertInstallments && targetDebt && (targetDebt.paidInstallments || 0) > 0) {
        const accId = targetDebt.accountId || prev.accounts[0]?.id || 'acc_itau';
        const totalPaid = (targetDebt.paidInstallments || 0) * targetDebt.installmentAmount;
        const today = new Date().toISOString().split('T')[0];

        // Reversão única pelo valor total já debitado das parcelas pagas
        const reversalTx: Transaction = {
          id: `tx_debtrev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'income',
          categoryId: prev.categories.find(cat => cat.name === targetDebt.category)?.id || '',
          category: targetDebt.category,
          subcategory: 'Reversão de Dívida',
          tagIds: [],
          amount: totalPaid,
          date: today,
          recurring: 'none',
          notes: `Reversão dos valores pagos da dívida "${targetDebt.name}"`,
          memberId: 'mem_geral',
          accountId: accId,
          attachmentUrls: [],
          attachmentNames: [],
          status: 'REALIZADO'
        };
        deletedTxs = [reversalTx];
        updatedTxs = [reversalTx, ...prev.transactions];

        updatedAccounts = prev.accounts.map(acc => {
          if (acc.id === accId) {
            const updatedAcc = { ...acc, balance: acc.balance + totalPaid };
            targetAccounts.push(updatedAcc);
            return updatedAcc;
          }
          return acc;
        });
      }

      return {
        ...prev,
        debts: (prev.debts || []).filter(d => d.id !== id),
        transactions: updatedTxs,
        accounts: updatedAccounts
      };
    });

    await syncDebt({ id } as Debt, true);
    for (const tx of deletedTxs) {
      await syncTransaction(tx);
    }
    for (const targetAccount of targetAccounts) {
      await syncAccount(targetAccount);
    }
  };

  // ==========================================
  // INVESTMENTS CRUD HANDLERS
  // ==========================================
  const handleAddInvestment = async (newInvData: Omit<Investment, 'id'>) => {
    const newInv: Investment = {
      ...newInvData,
      id: `inv_${Date.now()}`
    };
    let extraTxList: Transaction[] = [];
    let targetAccounts: Account[] = [];

    setState(prev => {
      let updatedAccounts = prev.accounts;
      const accId = newInv.accountId;

      if (accId && newInv.initialAmount > 0) {
        const today = new Date().toISOString().split('T')[0];
        const linkedAccount = prev.accounts.find(a => a.id === accId);

        const newTx: Transaction = {
          id: `tx_inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'expense',
          categoryId: prev.categories.find(cat => cat.name === 'Investimentos')?.id || '',
          category: 'Investimentos',
          subcategory: 'Aporte Inicial',
          tagIds: [],
          amount: newInv.initialAmount,
          date: today,
          recurring: 'none',
          notes: `Aporte inicial de R$ ${newInv.initialAmount.toFixed(2)} no ativo "${newInv.name}"`,
          memberId: 'mem_geral',
          accountId: accId,
          attachmentUrls: [],
          attachmentNames: [],
          status: 'REALIZADO'
        };
        extraTxList.push(newTx);

        if (linkedAccount) {
          updatedAccounts = prev.accounts.map(acc => {
            if (acc.id === accId) {
              const updatedAcc = {
                ...acc,
                balance: acc.balance - newInv.initialAmount
              };
              targetAccounts.push(updatedAcc);
              return updatedAcc;
            }
            return acc;
          });
        }
      }

      return {
        ...prev,
        investments: [...(prev.investments || []), newInv],
        transactions: [...extraTxList, ...prev.transactions],
        accounts: updatedAccounts
      };
    });

    await syncInvestment(newInv);
    for (const extraTx of extraTxList) {
      await syncTransaction(extraTx);
    }
    for (const targetAccount of targetAccounts) {
      await syncAccount(targetAccount);
    }
  };

  const handleEditInvestment = async (id: string, updatedFields: Partial<Investment>) => {
    let targetInv: Investment | null = null;
    let extraTxList: Transaction[] = [];
    let targetAccounts: Account[] = [];

    setState(prev => {
      const currentInv = (prev.investments || []).find(i => i.id === id);
      let updatedAccounts = prev.accounts;

      if (currentInv && currentInv.accountId) {
        const contribDelta = (updatedFields.contributionsCount ?? currentInv.contributionsCount) - (currentInv.contributionsCount || 0);
        const withdrawDelta = ((updatedFields.withdrawalsCount ?? currentInv.withdrawalsCount) || 0) - (currentInv.withdrawalsCount || 0);
        const amountDelta = (updatedFields.currentAmount ?? currentInv.currentAmount) - currentInv.currentAmount;

        // Aportes/resgates rápidos alteram os contadores; cada alteração gera a movimentação correspondente na conta vinculada.
        const isDeposit = contribDelta > 0;
        const isWithdraw = withdrawDelta > 0;
        const txAmount = isDeposit ? amountDelta : (isWithdraw ? -amountDelta : 0);

        if (txAmount > 0) {
          const accId = currentInv.accountId;
          const today = new Date().toISOString().split('T')[0];
          const linkedAccount = prev.accounts.find(a => a.id === accId);

          const newTx: Transaction = {
            id: `tx_inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: isDeposit ? 'expense' : 'income',
            categoryId: prev.categories.find(cat => cat.name === 'Investimentos')?.id || '',
            category: 'Investimentos',
            subcategory: isDeposit ? 'Aporte em Ativo' : 'Resgate de Ativo',
            tagIds: [],
            amount: txAmount,
            date: today,
            recurring: 'none',
            notes: isDeposit
              ? `Aporte de R$ ${txAmount.toFixed(2)} no ativo "${currentInv.name}"`
              : `Resgate de R$ ${txAmount.toFixed(2)} do ativo "${currentInv.name}"`,
            memberId: 'mem_geral',
            accountId: accId,
            attachmentUrls: [],
            attachmentNames: [],
            status: 'REALIZADO'
          };
          extraTxList.push(newTx);

          if (linkedAccount) {
            updatedAccounts = prev.accounts.map(acc => {
              if (acc.id === accId) {
                const updatedAcc = {
                  ...acc,
                  balance: isDeposit ? acc.balance - txAmount : acc.balance + txAmount
                };
                targetAccounts = targetAccounts.filter(a => a.id !== accId);
                targetAccounts.push(updatedAcc);
                return updatedAcc;
              }
              return acc;
            });
          }
        }
      }

      const newInvs = (prev.investments || []).map(i => {
        if (i.id === id) {
          targetInv = { ...i, ...updatedFields };
          return targetInv;
        }
        return i;
      });

      return {
        ...prev,
        investments: newInvs,
        transactions: [...extraTxList, ...prev.transactions],
        accounts: updatedAccounts
      };
    });

    if (targetInv) {
      await syncInvestment(targetInv);
    }
    for (const extraTx of extraTxList) {
      await syncTransaction(extraTx);
    }
    for (const targetAccount of targetAccounts) {
      await syncAccount(targetAccount);
    }
  };

  const handleDeleteInvestment = async (id: string, revertCapital: boolean = false) => {
    let deletedTxs: Transaction[] = [];
    let targetAccounts: Account[] = [];

    setState(prev => {
      const targetInv = (prev.investments || []).find(i => i.id === id);
      let updatedTxs = prev.transactions;
      let updatedAccounts = prev.accounts;

      if (revertCapital && targetInv && targetInv.accountId && targetInv.currentAmount > 0) {
        const accId = targetInv.accountId;
        const today = new Date().toISOString().split('T')[0];

        const reversalTx: Transaction = {
          id: `tx_invrev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'income',
          categoryId: prev.categories.find(cat => cat.name === 'Investimentos')?.id || '',
          category: 'Investimentos',
          subcategory: 'Reversão de Ativo',
          tagIds: [],
          amount: targetInv.currentAmount,
          date: today,
          recurring: 'none',
          notes: `Reversão do valor aplicado no ativo "${targetInv.name}"`,
          memberId: 'mem_geral',
          accountId: accId,
          attachmentUrls: [],
          attachmentNames: [],
          status: 'REALIZADO'
        };
        deletedTxs = [reversalTx];
        updatedTxs = [reversalTx, ...prev.transactions];

        updatedAccounts = prev.accounts.map(acc => {
          if (acc.id === accId) {
            const updatedAcc = { ...acc, balance: acc.balance + targetInv.currentAmount };
            targetAccounts.push(updatedAcc);
            return updatedAcc;
          }
          return acc;
        });
      }

      return {
        ...prev,
        investments: (prev.investments || []).filter(i => i.id !== id),
        transactions: updatedTxs,
        accounts: updatedAccounts
      };
    });

    await syncInvestment({ id } as Investment, true);
    for (const tx of deletedTxs) {
      await syncTransaction(tx);
    }
    for (const targetAccount of targetAccounts) {
      await syncAccount(targetAccount);
    }
  };

  // Importa ativos vindos da Pluggy (carteira) e os persiste no app, já
  // vinculados à conta de investimento selecionada e marcados como conciliados.
  const handleImportInvestments = async (newInvestments: Omit<Investment, 'id'>[]) => {
    const withIds: Investment[] = newInvestments.map(inv => ({
      ...inv,
      id: `inv_pluggy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    }));
    setState(prev => ({
      ...prev,
      investments: [...(prev.investments || []), ...withIds]
    }));
    await Promise.all(withIds.map(inv => syncInvestment(inv)));
  };

  // ==========================================
  // BANK IMPORT & CONCILIATION HANDLER
  // ==========================================
  const handleImportTransactions = async (importedTxs: any[]) => {
    let syncTxs: Transaction[] = [];
    let syncAccounts: Account[] = [];

    setState(prev => {
      let currentTransactions = [...prev.transactions];
      let currentAccounts = [...prev.accounts];

      importedTxs.forEach((txData, index) => {
        // Respeita um id já existente (Pluggy) e evita duplicar a mesma transação
        const existingPluggyTx = currentTransactions.find(
          t => !t.deleted_at && txData.pluggyTransactionId && t.pluggyTransactionId === txData.pluggyTransactionId
        );
        if (existingPluggyTx) return;

        const newId = txData.id || `tx_imp_${Date.now()}_${index}`;
        const categoryId = txData.categoryId || prev.categories.find(c => c.name === txData.category)?.id || '';
        const newTx: Transaction = {
          type: txData.type,
          categoryId,
          category: txData.category,
          subcategoryId: txData.subcategoryId || undefined,
          subcategory: txData.subcategory || '',
          tagIds: Array.isArray(txData.tagIds) ? txData.tagIds : [],
          amount: txData.amount,
          date: txData.date || new Date().toISOString().split('T')[0],
          recurring: txData.recurring || 'none',
          recurrenceConfig: txData.recurrenceConfig,
          notes: txData.notes || txData.description || '',
          memberId: txData.memberId || 'mem_geral',
          accountId: txData.accountId || prev.accounts[0]?.id || 'acc_itau',
          attachmentUrls: txData.attachmentUrls || [],
          attachmentNames: txData.attachmentNames || [],
          status: txData.status || 'REALIZADO',
          origin: txData.origin || 'MANUAL',
          pluggyTransactionId: txData.pluggyTransactionId || undefined,
          isReconciled: txData.isReconciled ?? false,
          paymentMethod: txData.paymentMethod || undefined,
          id: newId
        };
        currentTransactions = [newTx, ...currentTransactions];
        syncTxs.push(newTx);

        currentAccounts = currentAccounts.map(acc => {
          if (acc.id === newTx.accountId) {
            const multiplier = newTx.type === 'income' ? 1 : -1;
            const updatedAcc = {
              ...acc,
              balance: acc.balance + (newTx.amount * multiplier)
            };
            const existingIdx = syncAccounts.findIndex(a => a.id === acc.id);
            if (existingIdx !== -1) {
              syncAccounts[existingIdx] = updatedAcc;
            } else {
              syncAccounts.push(updatedAcc);
            }
            return updatedAcc;
          }
          return acc;
        });
      });

      return {
        ...prev,
        transactions: currentTransactions,
        accounts: currentAccounts
      };
    });

    for (const tx of syncTxs) {
      await syncTransaction(tx);
    }
    for (const acc of syncAccounts) {
      await syncAccount(acc);
    }
  };


  // ==========================================
  // RECURRING TRANSACTIONS ENGINE (2.4)
  // ==========================================
  const handleGenerateRecurring = async () => {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const generated: Transaction[] = [];
    let generatedCount = 0;

    setState(prev => {
      const templates = prev.transactions.filter(t => !t.deleted_at && t.recurring !== 'none' && t.recurrenceConfig);
      const existing = new Set(prev.transactions.filter(t => t.date.startsWith(currentMonth)).map(t => t.recurrenceGroupId).filter(Boolean));
      let currentTransactions = [...prev.transactions];
      let currentAccounts = [...prev.accounts];

      templates.forEach((tpl, idx) => {
        const groupId = tpl.recurrenceGroupId || `rg_${tpl.id}`;
        if (existing.has(groupId)) return;

        const cfg = tpl.recurrenceConfig!;
        let occDate: Date | null = null;

        if (cfg.frequency === 'weekly') {
          occDate = new Date(today);
          const templateDay = new Date(tpl.date + 'T00:00:00');
          while (occDate.getDay() !== templateDay.getDay()) occDate.setDate(occDate.getDate() + 1);
        } else if (cfg.frequency === 'yearly') {
          occDate = new Date(tpl.date + 'T00:00:00');
          occDate.setFullYear(today.getFullYear());
          if (occDate < new Date(today.getFullYear(), today.getMonth(), 1)) {
            occDate.setFullYear(today.getFullYear() + 1);
            if (occDate.getMonth() !== today.getMonth()) return;
          }
        } else {
          // monthly / custom (interval in months)
          const tplDate = new Date(tpl.date + 'T00:00:00');
          occDate = new Date(today.getFullYear(), today.getMonth(), tplDate.getDate());
          if (cfg.interval && cfg.interval > 1 && (today.getMonth() - tplDate.getMonth()) % cfg.interval !== 0) return;
          if (occDate > new Date(today.getFullYear(), today.getMonth() + 1, 0)) return;
        }

        const occDateStr = `${occDate.getFullYear()}-${String(occDate.getMonth() + 1).padStart(2, '0')}-${String(occDate.getDate()).padStart(2, '0')}`;

        const newTx: Transaction = {
          ...tpl,
          id: `tx_rec_${Date.now()}_${idx}`,
          date: occDateStr,
          recurrenceGroupId: groupId,
          status: 'PENDENTE'
        };
        currentTransactions = [newTx, ...currentTransactions];
        generated.push(newTx);
        generatedCount++;
      });

      return { ...prev, transactions: currentTransactions, accounts: currentAccounts };
    });

    for (const tx of generated) {
      await syncTransaction(tx);
    }
    if (generatedCount > 0) {
      handleAddNotification('system', 'Recorrências geradas', `Foram geradas ${generatedCount} transação(ões) recorrente(s) previstas para o mês atual.`);
    }
    return generatedCount;
  };

  // ==========================================
  // IN-APP NOTIFICATIONS (2.5)
  // ==========================================
  const handleAddNotification = (type: AppNotification['type'], title: string, message: string) => {
    setState(prev => ({
      ...prev,
      notifications: [
        { id: `notif_${Date.now()}`, type, title, message, createdAt: new Date().toISOString(), read: false },
        ...(prev.notifications || []),
      ].slice(0, 50)
    }));
  };

  const handleMarkNotificationRead = (id: string) => {
    setState(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n => n.id === id ? { ...n, read: true } : n)
    }));
  };

  const handleMarkAllNotificationsRead = () => {
    setState(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n => ({ ...n, read: true }))
    }));
  };

  const handleClearNotifications = () => {
    setState(prev => ({ ...prev, notifications: [] }));
  };
  // Check triggers: upcoming due dates, budget thresholds, goals reached, expense averages
  const handleCheckAlerts = () => {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const monthExpenses = state.transactions
      .filter(t => !t.deleted_at && t.type === 'expense' && t.date.startsWith(currentMonth))
      .reduce((s, t) => s + t.amount, 0);
    const existing = new Set((state.notifications || []).map(n => n.message));

    const push = (type: AppNotification['type'], title: string, message: string) => {
      if (existing.has(message)) return;
      handleAddNotification(type, title, message);
    };

    // Subscriptions due within notifyDays
    state.subscriptions.forEach(sub => {
      const bd = String(sub.billingDate || '1');
      const day = parseInt(bd.split('-')[2] || bd || '1') || 1;
      const due = new Date(today.getFullYear(), today.getMonth(), day);
      const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const daysAhead = sub.notifyDays ?? 3;
      if (diff >= 0 && diff <= daysAhead) {
        push('due_date', 'Assinatura vence em breve', `"${sub.name}" vence em ${diff === 0 ? 'hoje' : `${diff} dia(s)`} (${sub.amount.toFixed(2)}).`);
      }
    });

    // Debts installment due within 3 days
    state.debts.forEach(debt => {
      const due = new Date(debt.nextDueDate + 'T00:00:00');
      const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff <= 3) {
        push('due_date', 'Parcela a vencer', `"${debt.name}" — parcela ${debt.paidInstallments + 1}/${debt.installmentsCount} vence em ${diff === 0 ? 'hoje' : `${diff} dia(s)`}.`);
      }
    });

    // Budget thresholds (80% / 100%)
    state.budgets.forEach(b => {
      const spent = state.transactions
        .filter(t => !t.deleted_at && t.type === 'expense' && t.date.startsWith(currentMonth) && t.category === b.categoryId)
        .reduce((s, t) => s + t.amount, 0);
      if (b.limit > 0) {
        const pct = (spent / b.limit) * 100;
        if (pct >= 100) {
          push('budget', 'Orçamento estourado', `Categoria ${b.categoryId} excedeu o limite mensal (${pct.toFixed(0)}%).`);
        } else if (pct >= 80) {
          push('budget', 'Orçamento quase no limite', `Categoria ${b.categoryId} já consumiu ${pct.toFixed(0)}% do orçamento.`);
        }
      }
    });

    // Goals reached
    state.goals.forEach(g => {
      if (g.currentAmount >= g.targetAmount) {
        push('goal', 'Meta atingida! 🎉', `Parabéns! A meta "${g.name}" foi atingida.`);
      } else if (g.currentAmount > 0 && g.deadline) {
        const daysLeft = Math.ceil((new Date(g.deadline + 'T00:00:00').getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 0 && daysLeft <= 7) {
          push('goal', 'Meta próxima do prazo', `A meta "${g.name}" vence em ${daysLeft} dia(s) (${((g.currentAmount / g.targetAmount) * 100).toFixed(0)}% concluída).`);
        }
      }
    });

    // Average spend comparison (expense > 15% above average of previous 3 months)
    const prevMonths = [1, 2, 3].map(m => {
      const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const prevAvg = prevMonths.reduce((acc, m) => {
      const total = state.transactions
        .filter(t => !t.deleted_at && t.type === 'expense' && t.date.startsWith(m))
        .reduce((s, t) => s + t.amount, 0);
      return acc + total / 3;
    }, 0);
    if (prevAvg > 0 && monthExpenses > prevAvg * 1.15) {
      push('average', 'Gastos acima da média', `Seus gastos deste mês estão ${((monthExpenses / prevAvg - 1) * 100).toFixed(0)}% acima da média dos últimos 3 meses.`);
    }
  };

  // ==========================================
  // BACKUP & RESTORE UTILITIES
  // ==========================================
  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FamilyFinance-Backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        
        // Basic schema validations
        if (
          importedData.transactions && 
          importedData.categories && 
          importedData.accounts && 
          importedData.budgets && 
          importedData.goals && 
          importedData.familyMembers
        ) {
          setState(importedData);
          alert('Backup financeiro restaurado com sucesso! Suas telas foram atualizadas.');
        } else {
          alert('Formato de arquivo inválido. O arquivo de backup deve conter todos os campos do sistema.');
        }
      } catch (err) {
        alert('Erro ao ler arquivo de backup. Certifique-se de que é um arquivo JSON de backup válido.');
      }
    };
    reader.readAsText(file);
  };

  // Show a loading screen while the auth session is being checked
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold">
          <Loader2 size={18} className="animate-spin" /> Verificando sessão...
        </div>
      </div>
    );
  }

  // Password recovery flow (user clicked the link from the reset e-mail)
  if (isPasswordRecovery) {
    return (
      <PasswordResetScreen
        onComplete={() => {
          setIsPasswordRecovery(false);
        }}
        onBackToLogin={() => {
          const client = getSupabaseClient();
          if (client) client.auth.signOut();
          setCurrentSession(null);
          setCurrentUser(null);
          setIsPasswordRecovery(false);
        }}
      />
    );
  }

  // Do NOT render the app in local mode: block everything behind the login screen
  if (requireLogin) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
        <AuthModal
          isOpen
          onClose={() => {}}
          currentUser={currentUser}
          onSessionChange={(session) => {
            setCurrentSession(session);
            setCurrentUser(session?.user ?? null);
            if (session) {
              handleFetchFromSupabase();
            }
          }}
          onOpenSettings={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex max-w-full overflow-x-hidden" id="app-root-layout">
      
      {/* Sidebar Navigation */}
      <Sidebar 
        activeView={activeView}
        setActiveView={setActiveView}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        totalBalance={totalBalance}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
        isPrivateMode={isPrivateMode}
        onTogglePrivateMode={() => setIsPrivateMode(!isPrivateMode)}
      />

      {/* Main Content Area */}
      <main className={`flex-1 transition-all duration-300 min-h-screen pb-12 w-full max-w-full overflow-x-hidden ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        
        {/* Top bar with quick settings & backup */}
        <header className="h-16 border-b border-slate-200/60 bg-white flex items-center justify-between px-3 sm:px-6 md:px-8 shadow-xs sticky top-0 z-30">
          <div className="flex items-center gap-2 pl-10 md:pl-0">
            {/* Mobile / Tablet Branding */}
            <span className="font-display font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
              Family<span className="text-indigo-600">Finance</span>
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider font-sans">
              Sistema de Organização Familiar Integrado
            </span>
          </div>

          {/* Header Actions & User Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Notifications Center */}
            <NotificationsCenter 
              notifications={state.notifications || []}
              unreadCount={unreadNotifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onClear={handleClearNotifications}
              onCheckAlerts={handleCheckAlerts}
              onGenerateRecurring={() => handleGenerateRecurring()}
            />

            {/* Sync button */}
            <button
              type="button"
              onClick={handleFetchFromSupabase}
              className="p-2 sm:px-2.5 sm:py-1.5 bg-slate-50 border border-slate-200/80 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 text-slate-600 rounded-xl transition-colors cursor-pointer"
              title="Sincronizar dados agora"
              id="header-sync-now-btn"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin text-indigo-600' : ''} />
            </button>

            {/* Comprehensive User Menu Dropdown */}
            <UserMenu 
              currentUser={currentUser}
              supabaseConnected={supabaseConnected}
              isSyncing={isSyncing}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onOpenSecuritySettings={() => setActiveView('settings-premium')}
              onSignOut={handleSignOut}
              onFetchFromSupabase={handleFetchFromSupabase}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
            />
          </div>
        </header>

        {/* View Canvas Wrapper */}
        <div className="p-3 sm:p-5 md:p-8 max-w-7xl mx-auto overflow-x-hidden">
          {activeView === 'dashboard' && (
            <Dashboard 
              transactions={state.transactions}
              accounts={state.accounts}
              budgets={state.budgets}
              goals={state.goals}
              categories={state.categories}
              subscriptions={state.subscriptions || []}
              debts={state.debts || []}
              familyMembers={state.familyMembers}
              creditCards={state.creditCards || []}
              invoices={state.invoices || []}
              isPrivateMode={isPrivateMode}
              setActiveView={setActiveView}
            />
          )}

          {activeView === 'transactions' && (
            <TransactionsManager 
              transactions={state.transactions}
              categories={state.categories}
              accounts={state.accounts}
              familyMembers={state.familyMembers}
              allTags={state.tags || []}
              isPrivateMode={isPrivateMode}
              onAddTag={handleAddTag}
              onAddTransaction={handleAddTransaction}
              onEditTransaction={handleEditTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              creditCards={state.creditCards || []}
              invoices={state.invoices || []}
            />
          )}

          {activeView === 'staging-inbox' && (
            <StagingInbox 
              transactions={state.transactions}
              categories={state.categories}
              creditCards={state.creditCards || []}
              invoices={state.invoices || []}
              familyMembers={state.familyMembers}
              isPrivateMode={isPrivateMode}
              onAddTransaction={handleAddTransaction}
              onEditTransaction={handleEditTransaction}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {activeView === 'accounts-cards' && (
            <AccountsAndCardsManager 
              accounts={state.accounts}
              transactions={state.transactions}
              creditCards={state.creditCards || []}
              invoices={state.invoices || []}
              isPrivateMode={isPrivateMode}
              onAddAccount={handleAddAccount}
              onEditAccount={handleEditAccount}
              onDeleteAccount={handleDeleteAccount}
              onAddCreditCard={handleAddCreditCard}
              onEditCreditCard={handleEditCreditCard}
              onDeleteCreditCard={handleDeleteCreditCard}
              onPayInvoice={handlePayInvoice}
            />
          )}

          {activeView === 'categories-tags' && (
            <CategoryManager 
              categories={state.categories}
              subcategories={state.subcategories || []}
              tags={state.tags || []}
              transactions={state.transactions}
              budgets={state.budgets}
              onAddCategory={handleAddCategory}
              onEditCategory={handleEditCategory}
              onDeleteCategory={handleDeleteCategory}
              onAddSubcategory={handleAddSubcategory}
              onEditSubcategory={handleEditSubcategory}
              onDeleteSubcategory={handleDeleteSubcategory}
              onAddTag={handleAddTag}
              onEditTag={handleEditTag}
              onDeleteTag={handleDeleteTag}
            />
          )}

          {activeView === 'bank-integration' && (
            <BankIntegration 
              key="bank-integration"
              categories={state.categories}
              subcategories={state.subcategories}
              tags={state.tags || []}
              accounts={state.accounts}
              transactions={state.transactions}
              automationRules={state.automationRules || []}
              onImportTransactions={handleImportTransactions}
              onImportInvestments={handleImportInvestments}
              onEditTransaction={(tx) => handleEditTransaction(tx.id, {
                isReconciled: tx.isReconciled,
                pluggyTransactionId: tx.pluggyTransactionId,
                paymentMethod: tx.paymentMethod,
              }, 'only_this')}
              userId={currentUser?.id}
            />
          )}

          {activeView === 'subscriptions' && (
            <SubscriptionsManager 
              subscriptions={state.subscriptions || []}
              automationRules={state.automationRules || []}
              categories={state.categories}
              familyMembers={state.familyMembers}
              transactions={state.transactions}
              accounts={state.accounts}
              isPrivateMode={isPrivateMode}
              onAddSubscription={handleAddSubscription}
              onEditSubscription={handleEditSubscription}
              onEditSubscriptionWithScope={handleEditSubscriptionWithScope}
              onDeleteSubscription={handleDeleteSubscription}
              onAddRule={handleAddRule}
              onEditRule={handleEditRule}
              onDeleteRule={handleDeleteRule}
            />
          )}

          {activeView === 'investments-debts' && (
            <InvestmentsManager 
              investments={state.investments || []}
              debts={state.debts || []}
              categories={state.categories}
              accounts={state.accounts}
              isPrivateMode={isPrivateMode}
              onAddInvestment={handleAddInvestment}
              onEditInvestment={handleEditInvestment}
              onDeleteInvestment={handleDeleteInvestment}
              onAddDebt={handleAddDebt}
              onEditDebt={handleEditDebt}
              onDeleteDebt={handleDeleteDebt}
            />
          )}

          {activeView === 'budgets' && (
            <FamilyBudgets 
              budgets={state.budgets}
              monthlyGoals={state.monthlyGoals || []}
              categories={state.categories}
              transactions={state.transactions}
              isPrivateMode={isPrivateMode}
              onAddBudget={handleAddBudget}
              onEditBudget={handleEditBudget}
              onDeleteBudget={handleDeleteBudget}
              onAddMonthlyGoal={handleAddMonthlyGoal}
              onEditMonthlyGoal={handleEditMonthlyGoal}
              onDeleteMonthlyGoal={handleDeleteMonthlyGoal}
            />
          )}

          {activeView === 'goals' && (
            <FamilyGoals 
              goals={state.goals}
              categories={state.categories}
              familyMembers={state.familyMembers}
              accounts={state.accounts}
              onAddGoal={handleAddGoal}
              onEditGoal={handleEditGoal}
              onDeleteGoal={handleDeleteGoal}
            />
          )}

          {activeView === 'family' && (
            <FamilyMembers 
              familyMembers={state.familyMembers}
              transactions={state.transactions}
              isPrivateMode={isPrivateMode}
              onAddMember={handleAddMember}
              onEditMember={handleEditMember}
              onDeleteMember={handleDeleteMember}
            />
          )}

          {activeView === 'reports' && (
            <Reports 
              transactions={state.transactions}
              categories={state.categories}
              subcategories={state.subcategories}
              accounts={state.accounts}
              familyMembers={state.familyMembers}
              subscriptions={state.subscriptions}
              debts={state.debts}
              creditCards={state.creditCards || []}
              invoices={state.invoices || []}
              isPrivateMode={isPrivateMode}
            />
          )}

          {activeView === 'premium-features' && (
            <PremiumFeatures 
              financialState={state}
            />
          )}

          {activeView === 'settings-premium' && (
            <SecurityAndSettings 
              financialState={state}
              isPrivateMode={isPrivateMode}
              setIsPrivateMode={setIsPrivateMode}
            />
          )}

          {activeView === 'ai-advisor' && (
            <AIAdvisor 
              financialState={state}
            />
          )}
        </div>
      </main>

      {/* Supabase Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onSessionChange={(session) => {
          setCurrentSession(session);
          setCurrentUser(session?.user ?? null);
          if (session) {
            handleFetchFromSupabase();
          }
        }}
        onOpenSettings={() => setActiveView('settings-premium')}
      />
    </div>
  );
}
