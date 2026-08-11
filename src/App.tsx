import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TransactionsManager from './components/TransactionsManager';
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
import AccountsAndCardsManager from './components/AccountsAndCardsManager';
import { getInitialState, saveState } from './utils/initialData';
import { FinancialState, Transaction, Budget, Goal, FamilyMember, Account, Subscription, Debt, Investment, AutomationRule, Category } from './types';
import { Download, Upload, RefreshCw, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { 
  getSupabaseClient, 
  fetchStateFromSupabase, 
  runSupabaseDiagnostics,
  SupabaseDiagnosticInfo,
  seedSupabaseTables,
  syncTransaction, 
  syncCategory, 
  syncAccount, 
  syncBudget, 
  syncGoal, 
  syncSubscription, 
  syncDebt, 
  syncInvestment, 
  syncAutomationRule, 
  syncFamilyMember 
} from './lib/supabase';


export default function App() {
  // Load initial state (loads from localStorage or defaults)
  const [state, setState] = useState<FinancialState>(() => getInitialState());
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isPrivateMode, setIsPrivateMode] = useState<boolean>(false);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(() => !!getSupabaseClient());
  const [supabaseDiagnostic, setSupabaseDiagnostic] = useState<SupabaseDiagnosticInfo | null>(null);

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

  // Sync state to LocalStorage on changes

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Combined Total Balance calculation
  const totalBalance = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);

  // ==========================================
  // TRANSACTION CRUD HANDLERS
  // ==========================================
  const handleAddTransaction = async (newTxData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...newTxData,
      id: `tx_${Date.now()}`
    };

    let targetAccount: Account | null = null;
    setState(prev => {
      // Adjust Account Balance
      const updatedAccounts = prev.accounts.map(acc => {
        if (acc.id === newTx.accountId) {
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

      return {
        ...prev,
        transactions: [newTx, ...prev.transactions],
        accounts: updatedAccounts
      };
    });

    // Write to Supabase
    await syncTransaction(newTx);
    if (targetAccount) {
      await syncAccount(targetAccount);
    }
  };

  const handleEditTransaction = async (
    id: string, 
    updatedFields: Partial<Transaction>, 
    scope: 'only_this' | 'all'
  ) => {
    let affectedTxs: Transaction[] = [];
    let affectedAccounts: Account[] = [];

    setState(prev => {
      const originalTx = prev.transactions.find(t => t.id === id);
      if (!originalTx) return prev;

      // Identify transaction IDs to edit based on scope
      const targetIds = new Set<string>();
      targetIds.add(id);

      if (scope === 'all' && originalTx.recurring !== 'none') {
        // Find other transactions of same category, notes, and recurrence to simulate bulk edit
        prev.transactions.forEach(t => {
          if (t.category === originalTx.category && t.recurring === originalTx.recurring) {
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

          // Revert old transaction effect on account
          const accIdxOld = updatedAccounts.findIndex(a => a.id === t.accountId);
          if (accIdxOld !== -1) {
            const oldMultiplier = t.type === 'income' ? -1 : 1; // opposite
            updatedAccounts[accIdxOld] = {
              ...updatedAccounts[accIdxOld],
              balance: updatedAccounts[accIdxOld].balance + (t.amount * oldMultiplier)
            };
          }

          // Apply new transaction effect on account
          const accIdxNew = updatedAccounts.findIndex(a => a.id === finalTx.accountId);
          if (accIdxNew !== -1) {
            const newMultiplier = finalTx.type === 'income' ? 1 : -1;
            updatedAccounts[accIdxNew] = {
              ...updatedAccounts[accIdxNew],
              balance: updatedAccounts[accIdxNew].balance + (finalTx.amount * newMultiplier)
            };
          }

          return finalTx;
        }
        return t;
      });

      affectedAccounts = updatedAccounts;

      return {
        ...prev,
        transactions: newTransactions,
        accounts: updatedAccounts
      };
    });

    // Sync to Supabase
    for (const tx of affectedTxs) {
      await syncTransaction(tx);
    }
    for (const acc of affectedAccounts) {
      await syncAccount(acc);
    }
  };

  const handleDeleteTransaction = async (id: string, scope: 'only_this' | 'all') => {
    let deletedTxs: Transaction[] = [];
    let affectedAccounts: Account[] = [];

    setState(prev => {
      const originalTx = prev.transactions.find(t => t.id === id);
      if (!originalTx) return prev;

      // Identify transaction IDs to delete based on scope
      const targetIds = new Set<string>();
      targetIds.add(id);

      if (scope === 'all' && originalTx.recurring !== 'none') {
        // Find other transactions of same category, notes, and recurrence to simulate bulk delete
        prev.transactions.forEach(t => {
          if (t.category === originalTx.category && t.recurring === originalTx.recurring) {
            targetIds.add(t.id);
          }
        });
      }

      // Recalculate balances: Revert deleted tx values
      const updatedAccounts = [...prev.accounts];
      
      prev.transactions.forEach(t => {
        if (targetIds.has(t.id)) {
          deletedTxs.push(t);
          const accIdx = updatedAccounts.findIndex(a => a.id === t.accountId);
          if (accIdx !== -1) {
            const revertMultiplier = t.type === 'income' ? -1 : 1;
            updatedAccounts[accIdx] = {
              ...updatedAccounts[accIdx],
              balance: updatedAccounts[accIdx].balance + (t.amount * revertMultiplier)
            };
          }
        }
      });

      const newTransactions = prev.transactions.filter(t => !targetIds.has(t.id));
      affectedAccounts = updatedAccounts;

      return {
        ...prev,
        transactions: newTransactions,
        accounts: updatedAccounts
      };
    });

    // Sync to Supabase
    for (const tx of deletedTxs) {
      await syncTransaction(tx, true);
    }
    for (const acc of affectedAccounts) {
      await syncAccount(acc);
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
  // SAVINGS GOAL CRUD HANDLERS
  // ==========================================
  const handleAddGoal = async (newGoalData: Omit<Goal, 'id'>) => {
    const newGoal: Goal = {
      ...newGoalData,
      id: `goal_${Date.now()}`
    };
    setState(prev => ({
      ...prev,
      goals: [...prev.goals, newGoal]
    }));
    await syncGoal(newGoal);
  };

  const handleEditGoal = async (id: string, updatedFields: Partial<Goal>) => {
    let targetGoal: Goal | null = null;
    setState(prev => ({
      ...prev,
      goals: prev.goals.map(g => {
        if (g.id === id) {
          targetGoal = { ...g, ...updatedFields };
          return targetGoal;
        }
        return g;
      })
    }));
    if (targetGoal) {
      await syncGoal(targetGoal);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    setState(prev => ({
      ...prev,
      goals: prev.goals.filter(g => g.id !== id)
    }));
    await syncGoal({ id } as Goal, true);
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
    setState(prev => {
      const targetCat = prev.categories.find(c => c.id === id);
      const remapCat = prev.categories.find(c => c.id === remapCategoryId);
      let updatedTxs = prev.transactions;
      
      if (targetCat && remapCat) {
        updatedTxs = prev.transactions.map(t => {
          if (t.category === targetCat.name) {
            const updated = { ...t, category: remapCat.name };
            remappedTxs.push(updated);
            return updated;
          }
          return t;
        });
      }

      return {
        ...prev,
        categories: prev.categories.filter(c => c.id !== id),
        transactions: updatedTxs
      };
    });

    await syncCategory({ id } as Category, true);
    for (const tx of remappedTxs) {
      await syncTransaction(tx);
    }
  };

  // ==========================================
  // SUBSCRIPTION CRUD HANDLERS
  // ==========================================
  const handleAddSubscription = async (newSubData: Omit<Subscription, 'id'>) => {
    const newSub: Subscription = {
      ...newSubData,
      id: `sub_${Date.now()}`
    };
    setState(prev => ({
      ...prev,
      subscriptions: [...(prev.subscriptions || []), newSub]
    }));
    await syncSubscription(newSub);
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
    setState(prev => ({
      ...prev,
      debts: [...(prev.debts || []), newDebt]
    }));
    await syncDebt(newDebt);
  };

  const handleEditDebt = async (id: string, updatedFields: Partial<Debt>) => {
    let targetDebt: Debt | null = null;
    let extraTx: Transaction | null = null;
    let targetAccount: Account | null = null;

    setState(prev => {
      const currentDebt = (prev.debts || []).find(d => d.id === id);
      const isPaidUpdated = updatedFields.paidInstallments !== undefined && currentDebt && updatedFields.paidInstallments > currentDebt.paidInstallments;
      
      let extraTxList: Transaction[] = [];
      let updatedAccounts = prev.accounts;

      if (isPaidUpdated && currentDebt) {
        const newTx: Transaction = {
          id: `tx_debt_${Date.now()}`,
          type: 'expense',
          category: currentDebt.category,
          subcategory: 'Parcelas',
          tags: ['Dívida', currentDebt.name],
          amount: currentDebt.installmentAmount,
          date: new Date().toISOString().split('T')[0],
          recurring: 'none',
          notes: `Pago parcela ${updatedFields.paidInstallments} de ${currentDebt.name}`,
          memberId: 'mem_geral',
          accountId: prev.accounts[0]?.id || 'acc_itau'
        };
        extraTx = newTx;
        extraTxList = [newTx];

        updatedAccounts = prev.accounts.map(acc => {
          if (acc.id === newTx.accountId) {
            const updatedAcc = {
              ...acc,
              balance: acc.balance - newTx.amount
            };
            targetAccount = updatedAcc;
            return updatedAcc;
          }
          return acc;
        });
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
    if (extraTx) {
      await syncTransaction(extraTx);
    }
    if (targetAccount) {
      await syncAccount(targetAccount);
    }
  };

  const handleDeleteDebt = async (id: string) => {
    setState(prev => ({
      ...prev,
      debts: (prev.debts || []).filter(d => d.id !== id)
    }));
    await syncDebt({ id } as Debt, true);
  };

  // ==========================================
  // INVESTMENTS CRUD HANDLERS
  // ==========================================
  const handleAddInvestment = async (newInvData: Omit<Investment, 'id'>) => {
    const newInv: Investment = {
      ...newInvData,
      id: `inv_${Date.now()}`
    };
    setState(prev => ({
      ...prev,
      investments: [...(prev.investments || []), newInv]
    }));
    await syncInvestment(newInv);
  };

  const handleEditInvestment = async (id: string, updatedFields: Partial<Investment>) => {
    let targetInv: Investment | null = null;
    setState(prev => ({
      ...prev,
      investments: (prev.investments || []).map(i => {
        if (i.id === id) {
          targetInv = { ...i, ...updatedFields };
          return targetInv;
        }
        return i;
      })
    }));
    if (targetInv) {
      await syncInvestment(targetInv);
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    setState(prev => ({
      ...prev,
      investments: (prev.investments || []).filter(i => i.id !== id)
    }));
    await syncInvestment({ id } as Investment, true);
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
        const newId = `tx_imp_${Date.now()}_${index}`;
        const newTx: Transaction = {
          ...txData,
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

  const handleResetToDefault = () => {
    if (window.confirm('Atenção: Isso redefinirá todos os seus dados personalizados de volta aos dados de demonstração iniciais. Tem certeza de que quer continuar?')) {
      localStorage.removeItem('family_finance_state');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex" id="app-root-layout">
      
      {/* Sidebar Navigation */}
      <Sidebar 
        activeView={activeView}
        setActiveView={setActiveView}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        totalBalance={totalBalance}
      />

      {/* Main Content Area */}
      <main className={`flex-1 transition-all duration-300 min-h-screen pb-12 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        
        {/* Top bar with quick settings & backup */}
        <header className="h-16 border-b border-slate-200/60 bg-white flex items-center justify-between px-6 md:px-8 shadow-sm">
          <div className="flex items-center gap-1.5 md:hidden">
            {/* Mobile Branding Placeholder */}
            <span className="font-display font-extrabold text-slate-900 text-base">Family<span className="text-indigo-600">Finance</span></span>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider font-sans">Sistema de Organização Familiar Integrado</span>
          </div>

          {/* Supabase Status & Backup Actions bar */}
          <div className="flex items-center gap-2">
            {/* Supabase Status Indicator */}
            {supabaseConnected ? (
              <button
                onClick={() => setActiveView('security')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Supabase Conectado — Clique para ver detalhes de segurança"
                id="header-supabase-status-btn"
              >
                <Database size={14} className="text-emerald-600" />
                <span className="hidden sm:inline">Supabase Conectado</span>
                {isSyncing && <RefreshCw size={12} className="animate-spin text-emerald-600 ml-1" />}
              </button>
            ) : (
              <button
                onClick={() => setActiveView('security')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300/80 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-colors cursor-pointer animate-pulse"
                title="Supabase Desconectado — Clique para configurar URL e Anon Key"
                id="header-supabase-status-btn"
              >
                <AlertCircle size={14} className="text-amber-600" />
                <span>Supabase Desconectado</span>
              </button>
            )}

            <button
              onClick={handleFetchFromSupabase}
              className="inline-flex items-center p-1.5 bg-slate-50 border border-slate-200/65 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 text-slate-500 rounded-xl transition-colors cursor-pointer"
              title="Sincronizar/Buscar dados do Supabase agora"
              id="header-sync-now-btn"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin text-indigo-600' : ''} />
            </button>

            <button
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/65 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              title="Exportar Backup dos Dados"
              id="header-backup-btn"
            >
              <Download size={14} /> <span className="hidden sm:inline">Exportar</span>
            </button>
            <label
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/65 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              title="Importar Backup dos Dados"
              id="header-restore-label"
            >
              <Upload size={14} /> <span className="hidden sm:inline">Restaurar</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
        </header>

        {/* Supabase Disconnected Alert Banner */}
        {!supabaseConnected && (
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white px-6 py-2.5 flex items-center justify-between text-xs font-medium shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-100 shrink-0" />
              <span><strong>Atenção (Supabase Desconectado):</strong> O aplicativo não encontrou as credenciais do Supabase. Para visualizar e salvar os dados do seu banco de dados, insira a <strong>URL do Supabase</strong> e a <strong>Anon Key</strong> na aba de Configurações.</span>
            </div>
            <button
              onClick={() => setActiveView('security')}
              className="px-3.5 py-1.5 bg-white text-amber-900 hover:bg-amber-50 font-bold rounded-lg shrink-0 ml-4 transition-all shadow-xs cursor-pointer"
            >
              Conectar Agora
            </button>
          </div>
        )}

        {/* View Canvas Wrapper */}
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          {activeView === 'dashboard' && (
            <Dashboard 
              transactions={state.transactions}
              accounts={state.accounts}
              budgets={state.budgets}
              goals={state.goals}
              categories={state.categories}
              setActiveView={setActiveView}
            />
          )}

          {activeView === 'transactions' && (
            <TransactionsManager 
              transactions={state.transactions}
              categories={state.categories}
              accounts={state.accounts}
              familyMembers={state.familyMembers}
              onAddTransaction={handleAddTransaction}
              onEditTransaction={handleEditTransaction}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {activeView === 'accounts-cards' && (
            <AccountsAndCardsManager 
              accounts={state.accounts}
              transactions={state.transactions}
              onAddAccount={handleAddAccount}
              onEditAccount={handleEditAccount}
              onDeleteAccount={handleDeleteAccount}
            />
          )}

          {activeView === 'categories-tags' && (
            <CategoryManager 
              categories={state.categories}
              transactions={state.transactions}
              onAddCategory={handleAddCategory}
              onEditCategory={handleEditCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}

          {activeView === 'bank-integration' && (
            <BankIntegration 
              categories={state.categories}
              accounts={state.accounts}
              onImportTransactions={handleImportTransactions}
            />
          )}

          {activeView === 'subscriptions' && (
            <SubscriptionsManager 
              subscriptions={state.subscriptions || []}
              automationRules={state.automationRules || []}
              categories={state.categories}
              familyMembers={state.familyMembers}
              onAddSubscription={handleAddSubscription}
              onEditSubscription={handleEditSubscription}
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
              categories={state.categories}
              transactions={state.transactions}
              onAddBudget={handleAddBudget}
              onEditBudget={handleEditBudget}
              onDeleteBudget={handleDeleteBudget}
            />
          )}

          {activeView === 'goals' && (
            <FamilyGoals 
              goals={state.goals}
              onAddGoal={handleAddGoal}
              onEditGoal={handleEditGoal}
              onDeleteGoal={handleDeleteGoal}
            />
          )}

          {activeView === 'family' && (
            <FamilyMembers 
              familyMembers={state.familyMembers}
              transactions={state.transactions}
              onAddMember={handleAddMember}
              onEditMember={handleEditMember}
              onDeleteMember={handleDeleteMember}
            />
          )}

          {activeView === 'reports' && (
            <Reports 
              transactions={state.transactions}
              categories={state.categories}
              accounts={state.accounts}
              familyMembers={state.familyMembers}
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
    </div>
  );
}
