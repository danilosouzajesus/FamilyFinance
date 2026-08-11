import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FinancialState, Transaction, Budget, Goal, FamilyMember, Account, Subscription, Debt, Investment, AutomationRule, Category } from '../types';

// Helper to get connection options
export function getSupabaseCredentials() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('supabase_url') || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('supabase_anon_key') || '' : '';

  const url = (envUrl || localUrl).trim();
  const anonKey = (envKey || localKey).trim();

  return { url, anonKey };
}

let supabaseInstance: SupabaseClient | null = null;
let currentClientKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) {
    supabaseInstance = null;
    currentClientKey = '';
    return null;
  }
  
  const keyStr = `${url}___${anonKey}`;
  if (!supabaseInstance || currentClientKey !== keyStr) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      });
      currentClientKey = keyStr;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      supabaseInstance = null;
      currentClientKey = '';
      return null;
    }
  }
  return supabaseInstance;
}

// Check connection helper
export async function testSupabaseConnection(url: string, anonKey: string): Promise<boolean> {
  try {
    const tempClient = createClient(url, anonKey);
    // Simple query to verify
    const { error } = await tempClient.from('categories').select('id').limit(1);
    // If the table doesn't exist, that's fine (means we connected but tables aren't made yet)
    if (error && error.code !== 'PGRST116' && error.message.includes('apiKey')) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ==========================================
// SUPABASE SYNC AND OPERATIONS HELPERS
// ==========================================

export interface SupabaseDiagnosticInfo {
  isConnected: boolean;
  url: string;
  hasAnonKey: boolean;
  tableCounts: Record<string, number | null>;
  errors: Record<string, string>;
}

export async function runSupabaseDiagnostics(): Promise<SupabaseDiagnosticInfo> {
  const { url, anonKey } = getSupabaseCredentials();
  const info: SupabaseDiagnosticInfo = {
    isConnected: false,
    url: url ? url.substring(0, 25) + '...' : '',
    hasAnonKey: !!anonKey,
    tableCounts: {},
    errors: {}
  };

  const supabase = getSupabaseClient();
  if (!supabase) return info;

  info.isConnected = true;
  const tables = [
    'family_members',
    'categories',
    'accounts',
    'transactions',
    'budgets',
    'goals',
    'subscriptions',
    'debts',
    'investments',
    'automation_rules'
  ];

  await Promise.all(
    tables.map(async (table) => {
      try {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) {
          info.errors[table] = error.message || String(error);
          info.tableCounts[table] = null;
        } else {
          info.tableCounts[table] = count ?? 0;
        }
      } catch (err: any) {
        info.errors[table] = err.message || String(err);
        info.tableCounts[table] = null;
      }
    })
  );

  return info;
}

export async function fetchStateFromSupabase(): Promise<Partial<FinancialState> | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const safeFetch = async (fetchFn: () => any, tableName: string) => {
      try {
        const { data, error } = await fetchFn();
        if (error) {
          console.warn(`[Supabase Error] failed to load table ${tableName}:`, error.message || error);
          return null;
        }
        return data as any[];
      } catch (err) {
        console.warn(`[Supabase Exception] while loading table ${tableName}:`, err);
        return null;
      }
    };

    const [
      categoriesData,
      familyMembersData,
      accountsData,
      transactionsData,
      budgetsData,
      goalsData,
      subscriptionsData,
      debtsData,
      investmentsData,
      automationRulesData
    ] = await Promise.all([
      safeFetch(() => supabase.from('categories').select('*'), 'categories'),
      safeFetch(() => supabase.from('family_members').select('*'), 'family_members'),
      safeFetch(() => supabase.from('accounts').select('*'), 'accounts'),
      safeFetch(() => supabase.from('transactions').select('*').order('date', { ascending: false }), 'transactions'),
      safeFetch(() => supabase.from('budgets').select('*'), 'budgets'),
      safeFetch(() => supabase.from('goals').select('*'), 'goals'),
      safeFetch(() => supabase.from('subscriptions').select('*'), 'subscriptions'),
      safeFetch(() => supabase.from('debts').select('*'), 'debts'),
      safeFetch(() => supabase.from('investments').select('*'), 'investments'),
      safeFetch(() => supabase.from('automation_rules').select('*'), 'automation_rules'),
    ]);

    const result: Partial<FinancialState> = {};

    const categoryMap = new Map<string, string>();
    if (categoriesData !== null) {
      result.categories = categoriesData.map(c => {
        categoryMap.set(c.id, c.name);
        return {
          id: c.id,
          name: c.name,
          type: c.type,
          icon: c.icon || 'Folder',
          color: c.color || '#6366F1',
          subcategories: Array.isArray(c.subcategories) ? c.subcategories : [],
        };
      });
    }

    if (familyMembersData !== null) {
      result.familyMembers = familyMembersData.map(f => ({
        id: f.id,
        name: f.name,
        role: f.role,
        avatar: f.avatar,
      }));
    }

    if (accountsData !== null) {
      result.accounts = accountsData.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: Number(a.balance || 0),
        color: a.color || '#6366F1',
      }));
    }

    if (transactionsData !== null) {
      result.transactions = transactionsData.map(t => ({
        id: t.id,
        type: t.type,
        category: t.category_name || (t.category_id ? categoryMap.get(t.category_id) : '') || t.category || 'Geral',
        subcategory: t.subcategory || '',
        tags: Array.isArray(t.tags) ? t.tags : [],
        amount: Number(t.amount || 0),
        date: typeof t.date === 'string' ? t.date : (t.date ? new Date(t.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
        recurring: t.recurring || 'none',
        notes: t.notes || '',
        memberId: t.member_id || '',
        accountId: t.account_id || '',
        attachmentName: t.attachment_name,
        attachmentUrl: t.attachment_url,
      }));
    }

    if (budgetsData !== null) {
      result.budgets = budgetsData.map(b => ({
        id: b.id,
        categoryId: b.category_id,
        limit: Number(b.limit_amount || 0),
        month: b.month,
      }));
    }

    if (goalsData !== null) {
      result.goals = goalsData.map(g => ({
        id: g.id,
        name: g.name,
        targetAmount: Number(g.target_amount || 0),
        currentAmount: Number(g.current_amount || 0),
        deadline: g.deadline,
        color: g.color || '#10B981',
      }));
    }

    if (subscriptionsData !== null) {
      result.subscriptions = subscriptionsData.map(s => ({
        id: s.id,
        name: s.name,
        amount: Number(s.amount || 0),
        frequency: s.frequency,
        category: s.category,
        billingDate: s.billing_date,
        autoNotify: s.auto_notify ?? true,
        memberId: s.member_id || 'mem_geral',
      }));
    }

    if (debtsData !== null) {
      result.debts = debtsData.map(d => ({
        id: d.id,
        name: d.name,
        totalAmount: Number(d.total_amount || 0),
        installmentsCount: Number(d.installments_count || 1),
        installmentAmount: Number(d.installment_amount || 0),
        interestRate: Number(d.interest_rate || 0),
        nextDueDate: d.next_due_date,
        category: d.category,
        paidInstallments: Number(d.paid_installments || 0),
      }));
    }

    if (investmentsData !== null) {
      result.investments = investmentsData.map(i => ({
        id: i.id,
        type: i.type,
        name: i.name,
        initialAmount: Number(i.initial_amount || 0),
        currentAmount: Number(i.current_amount || 0),
        startDate: i.start_date,
        simpleYield: Number(i.simple_yield || 0),
        contributionsCount: Number(i.contributions_count || 1),
      }));
    }

    if (automationRulesData !== null) {
      result.automationRules = automationRulesData.map(r => ({
        id: r.id,
        conditionField: r.condition_field,
        conditionValue: r.condition_value,
        actionField: r.action_field,
        actionValue: r.action_value,
      }));
    }

    return result;
  } catch (error) {
    console.error('Error fetching data from Supabase:', error);
    return null;
  }
}

// ==========================================
// INDIVIDUAL CRUD SYNC OPERATIONS
// ==========================================

export async function syncTransaction(tx: Transaction, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('transactions').delete().eq('id', tx.id);
      return !error;
    } else {
      // Find category ID matching name
      const { data: catData } = await supabase.from('categories').select('id').eq('name', tx.category).single();
      const catId = catData?.id || null;

      const dbPayload = {
        id: tx.id,
        type: tx.type,
        category_id: catId,
        category_name: tx.category,
        subcategory: tx.subcategory || '',
        tags: tx.tags || [],
        amount: tx.amount,
        date: tx.date,
        recurring: tx.recurring || 'none',
        notes: tx.notes || '',
        member_id: tx.memberId || 'mem_geral',
        account_id: tx.accountId || 'acc_itau',
        attachment_name: tx.attachmentName || null,
        attachment_url: tx.attachmentUrl || null
      };
      const { error } = await supabase.from('transactions').upsert(dbPayload);
      if (error) console.error('Error syncing transaction:', error);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync transaction to Supabase:', err);
    return false;
  }
}

export async function syncCategory(cat: Category, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('categories').delete().eq('id', cat.id);
      return !error;
    } else {
      const dbPayload = {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        subcategories: cat.subcategories || [],
      };
      const { error } = await supabase.from('categories').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync category to Supabase:', err);
    return false;
  }
}

export async function syncAccount(acc: Account, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('accounts').delete().eq('id', acc.id);
      return !error;
    } else {
      const dbPayload = {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        balance: acc.balance,
        color: acc.color,
      };
      const { error } = await supabase.from('accounts').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync account to Supabase:', err);
    return false;
  }
}

export async function syncBudget(bud: Budget, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('budgets').delete().eq('id', bud.id);
      return !error;
    } else {
      // Find category object matching categoryId/name to insert properly
      const { data: catData } = await supabase.from('categories').select('id').eq('name', bud.categoryId).single();
      const categoryId = catData?.id || (bud.categoryId.startsWith('cat_') ? bud.categoryId : 'cat_moradia');

      const dbPayload = {
        id: bud.id,
        category_id: categoryId,
        limit_amount: bud.limit,
        month: bud.month,
      };
      const { error } = await supabase.from('budgets').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync budget to Supabase:', err);
    return false;
  }
}

export async function syncGoal(goal: Goal, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('goals').delete().eq('id', goal.id);
      return !error;
    } else {
      const dbPayload = {
        id: goal.id,
        name: goal.name,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount,
        deadline: goal.deadline,
        color: goal.color,
      };
      const { error } = await supabase.from('goals').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync goal to Supabase:', err);
    return false;
  }
}

export async function syncSubscription(sub: Subscription, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('subscriptions').delete().eq('id', sub.id);
      return !error;
    } else {
      const dbPayload = {
        id: sub.id,
        name: sub.name,
        amount: sub.amount,
        frequency: sub.frequency,
        category: sub.category,
        billing_date: sub.billingDate,
        auto_notify: sub.autoNotify,
        member_id: sub.memberId,
      };
      const { error } = await supabase.from('subscriptions').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync subscription to Supabase:', err);
    return false;
  }
}

export async function syncDebt(debt: Debt, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('debts').delete().eq('id', debt.id);
      return !error;
    } else {
      const dbPayload = {
        id: debt.id,
        name: debt.name,
        total_amount: debt.totalAmount,
        installments_count: debt.installmentsCount,
        installment_amount: debt.installmentAmount,
        interest_rate: debt.interestRate,
        next_due_date: debt.nextDueDate,
        category: debt.category,
        paid_installments: debt.paidInstallments,
      };
      const { error } = await supabase.from('debts').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync debt to Supabase:', err);
    return false;
  }
}

export async function syncInvestment(inv: Investment, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('investments').delete().eq('id', inv.id);
      return !error;
    } else {
      const dbPayload = {
        id: inv.id,
        type: inv.type,
        name: inv.name,
        initial_amount: inv.initialAmount,
        current_amount: inv.currentAmount,
        start_date: inv.startDate,
        simple_yield: inv.simpleYield,
        contributions_count: inv.contributionsCount,
      };
      const { error } = await supabase.from('investments').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync investment to Supabase:', err);
    return false;
  }
}

export async function syncAutomationRule(rule: AutomationRule, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('automation_rules').delete().eq('id', rule.id);
      return !error;
    } else {
      const dbPayload = {
        id: rule.id,
        condition_field: rule.conditionField,
        condition_value: rule.conditionValue,
        action_field: rule.actionField,
        action_value: rule.actionValue,
      };
      const { error } = await supabase.from('automation_rules').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync automation rule to Supabase:', err);
    return false;
  }
}

export async function syncFamilyMember(mem: FamilyMember, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('family_members').delete().eq('id', mem.id);
      return !error;
    } else {
      const dbPayload = {
        id: mem.id,
        name: mem.name,
        role: mem.role,
        avatar: mem.avatar,
      };
      const { error } = await supabase.from('family_members').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync family member to Supabase:', err);
    return false;
  }
}

// Seeding standard data into empty tables
export async function seedSupabaseTables(
  defaultCategories: Category[],
  defaultFamilyMembers: FamilyMember[],
  defaultAccounts: Account[],
  defaultTransactions: Transaction[],
  defaultSubscriptions: Subscription[],
  defaultDebts: Debt[],
  defaultInvestments: Investment[],
  defaultAutomationRules: AutomationRule[]
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    // 1. Categories
    const categoriesToInsert = defaultCategories.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
      subcategories: c.subcategories
    }));
    await supabase.from('categories').upsert(categoriesToInsert);

    // 2. Family Members
    const familyMembersToInsert = defaultFamilyMembers.map(m => ({
      id: m.id,
      name: m.name,
      role: m.role,
      avatar: m.avatar
    }));
    await supabase.from('family_members').upsert(familyMembersToInsert);

    // 3. Accounts
    const accountsToInsert = defaultAccounts.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: a.balance,
      color: a.color
    }));
    await supabase.from('accounts').upsert(accountsToInsert);

    // 4. Subscriptions
    const subsToInsert = defaultSubscriptions.map(s => ({
      id: s.id,
      name: s.name,
      amount: s.amount,
      frequency: s.frequency,
      category: s.category,
      billing_date: s.billingDate,
      auto_notify: s.autoNotify,
      member_id: s.memberId
    }));
    await supabase.from('subscriptions').upsert(subsToInsert);

    // 5. Debts
    const debtsToInsert = defaultDebts.map(d => ({
      id: d.id,
      name: d.name,
      total_amount: d.totalAmount,
      installments_count: d.installmentsCount,
      installment_amount: d.installmentAmount,
      interest_rate: d.interestRate,
      next_due_date: d.nextDueDate,
      category: d.category,
      paid_installments: d.paidInstallments
    }));
    await supabase.from('debts').upsert(debtsToInsert);

    // 6. Investments
    const invsToInsert = defaultInvestments.map(i => ({
      id: i.id,
      type: i.type,
      name: i.name,
      initial_amount: i.initialAmount,
      current_amount: i.currentAmount,
      start_date: i.startDate,
      simple_yield: i.simpleYield,
      contributions_count: i.contributionsCount
    }));
    await supabase.from('investments').upsert(invsToInsert);

    // 7. Automation Rules
    const rulesToInsert = defaultAutomationRules.map(r => ({
      id: r.id,
      condition_field: r.conditionField,
      condition_value: r.conditionValue,
      action_field: r.actionField,
      action_value: r.actionValue
    }));
    await supabase.from('automation_rules').upsert(rulesToInsert);

    // 8. Transactions
    const txsToInsert = defaultTransactions.map(t => {
      const categoryObj = defaultCategories.find(c => c.name === t.category);
      return {
        id: t.id,
        type: t.type,
        category_id: categoryObj ? categoryObj.id : null,
        category_name: t.category,
        subcategory: t.subcategory || '',
        tags: t.tags || [],
        amount: t.amount,
        date: t.date,
        recurring: t.recurring,
        notes: t.notes || '',
        member_id: t.memberId,
        account_id: t.accountId,
        attachment_name: t.attachmentName || null,
        attachment_url: t.attachmentUrl || null
      };
    });
    await supabase.from('transactions').upsert(txsToInsert);

    return true;
  } catch (error) {
    console.error('Error seeding Supabase tables:', error);
    return false;
  }
}
