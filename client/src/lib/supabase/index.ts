import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FinancialState, Transaction, Budget, MonthlyGoal, Goal, FamilyMember, Account, Subscription, Debt, Investment, AutomationRule, Category, Subcategory, Tag, CreditCard, Invoice, GoalContribution } from '@ff/shared';

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
          detectSessionInUrl: true,
          flowType: 'pkce',
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
    'tags',
    'accounts',
    'transactions',
    'budgets',
    'monthly_goals',
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
      tagsData,
      familyMembersData,
      accountsData,
      transactionsData,
      budgetsData,
      monthlyGoalsData,
      goalsData,
      subscriptionsData,
      debtsData,
      investmentsData,
      automationRulesData,
      creditCardsData,
      invoicesData,
      goalContributionsData
    ] = await Promise.all([
      safeFetch(() => supabase.from('categories').select('*'), 'categories'),
      safeFetch(() => supabase.from('tags').select('*'), 'tags'),
      safeFetch(() => supabase.from('family_members').select('*'), 'family_members'),
      safeFetch(() => supabase.from('accounts').select('*'), 'accounts'),
      safeFetch(() => supabase.from('transactions').select('*').order('date', { ascending: false }), 'transactions'),
      safeFetch(() => supabase.from('budgets').select('*'), 'budgets'),
      safeFetch(() => supabase.from('monthly_goals').select('*'), 'monthly_goals'),
      safeFetch(() => supabase.from('goals').select('*'), 'goals'),
      safeFetch(() => supabase.from('subscriptions').select('*'), 'subscriptions'),
      safeFetch(() => supabase.from('debts').select('*'), 'debts'),
      safeFetch(() => supabase.from('investments').select('*'), 'investments'),
      safeFetch(() => supabase.from('automation_rules').select('*'), 'automation_rules'),
      safeFetch(() => supabase.from('credit_cards').select('*'), 'credit_cards'),
      safeFetch(() => supabase.from('invoices').select('*'), 'invoices'),
      safeFetch(() => supabase.from('goal_contributions').select('*'), 'goal_contributions'),
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
          parentId: c.parent_id || undefined,
          isShared: c.is_shared ?? true,
        };
      });
      
      // Separate subcategories (those with parent_id)
      result.subcategories = categoriesData
        .filter(c => c.parent_id)
        .map(c => ({
          id: c.id,
          name: c.name,
          categoryId: c.parent_id,
          icon: c.icon,
          color: c.color,
        }));
    }

    if (tagsData !== null) {
      result.tags = tagsData.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color || '#6366F1',
      }));
    }

    if (familyMembersData !== null) {
      result.familyMembers = familyMembersData.map(f => ({
        id: f.id,
        name: f.name,
        role: f.role,
        avatar: f.avatar,
        accessRole: f.access_role || 'member',
        notifyChannels: Array.isArray(f.notify_channels) ? f.notify_channels : ['push'],
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
        categoryId: t.category_id || '',
        category: t.category_name || (t.category_id ? categoryMap.get(t.category_id) : '') || t.category || 'Geral',
        subcategoryId: t.subcategory_id || undefined,
        subcategory: t.subcategory || '',
        tagIds: Array.isArray(t.tag_ids) ? t.tag_ids : [],
        amount: Number(t.amount || 0),
        date: typeof t.date === 'string' ? t.date : (t.date ? new Date(t.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
        recurring: t.recurring || 'none',
        recurrenceConfig: t.recurrence_config || undefined,
        recurrenceGroupId: t.recurrence_group_id || undefined,
        notes: t.notes || '',
        memberId: t.member_id || '',
        accountId: t.account_id || '',
        attachmentUrls: Array.isArray(t.attachment_urls) ? t.attachment_urls : (t.attachment_url ? [t.attachment_url] : []),
        attachmentNames: Array.isArray(t.attachment_names) ? t.attachment_names : (t.attachment_name ? [t.attachment_name] : []),
        status: t.status || 'REALIZADO',
        deleted_at: t.deleted_at || undefined,
        creditCardId: t.credit_card_id || undefined,
        invoiceId: t.invoice_id || undefined,
        installmentNumber: t.installment_number != null ? Number(t.installment_number) : undefined,
        totalInstallments: t.total_installments != null ? Number(t.total_installments) : undefined,
        includeInBalanceSum: t.include_in_balance_sum ?? true,
      }));
    }

    if (budgetsData !== null) {
      result.budgets = budgetsData.map(b => ({
        id: b.id,
        categoryId: b.category_id,
        limit: Number(b.limit_amount || 0),
        month: b.month,
        notifyAtPercent: b.notify_at_percent ?? 80,
        rollover: b.rollover ?? false,
      }));
    }

    if (monthlyGoalsData !== null) {
      result.monthlyGoals = monthlyGoalsData.map(g => ({
        id: g.id,
        name: g.name,
        month: g.month,
        limit: Number(g.limit_amount || 0),
        categoryIds: Array.isArray(g.category_ids) ? g.category_ids : [],
        notifyAtPercent: g.notify_at_percent ?? 80,
      }));
    }

    if (goalsData !== null) {
      const contributionsByGoal = new Map<string, GoalContribution[]>();
      if (goalContributionsData !== null) {
        for (const c of goalContributionsData) {
          const entry: GoalContribution = {
            memberId: c.member_id,
            amount: Number(c.amount || 0),
            date: typeof c.date === 'string' ? c.date : new Date(c.date).toISOString().split('T')[0],
            type: c.type,
          };
          const list = contributionsByGoal.get(c.goal_id) || [];
          list.push(entry);
          contributionsByGoal.set(c.goal_id, list);
        }
      }
      result.goals = goalsData.map(g => ({
        id: g.id,
        name: g.name,
        targetAmount: Number(g.target_amount || 0),
        currentAmount: Number(g.current_amount || 0),
        deadline: g.deadline,
        color: g.color || '#10B981',
        categoryId: g.category || undefined,
        accountId: g.account_id || undefined,
        monthlyContribution: g.monthly_contribution != null ? Number(g.monthly_contribution) : undefined,
        contributions: contributionsByGoal.get(g.id),
      }));
    }

    if (subscriptionsData !== null) {
      result.subscriptions = subscriptionsData.map(s => ({
        id: s.id,
        name: s.name,
        amount: Number(s.amount || 0),
        frequency: s.frequency,
        category: s.category,
        billingDate: s.billing_date != null ? String(s.billing_date) : '1',
        autoNotify: s.auto_notify ?? true,
        memberId: s.member_id || '',
        paymentMethod: s.payment_method || 'credit_card',
        notifyChannel: s.notify_channel || 'push',
        notifyDays: s.notify_days != null ? Number(s.notify_days) : 3,
        accountId: s.account_id || undefined,
      }));
    }

    if (debtsData !== null) {
      result.debts = debtsData.map(d => ({
        id: d.id,
        name: d.name,
        creditor: d.creditor || '',
        totalAmount: Number(d.total_amount || 0),
        installmentsCount: Number(d.installments_count || 1),
        installmentAmount: Number(d.installment_amount || 0),
        interestRate: Number(d.interest_rate || 0),
        nextDueDate: d.next_due_date,
        category: d.category,
        paidInstallments: Number(d.paid_installments || 0),
        accountId: d.account_id || undefined,
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
        withdrawalsCount: Number(i.withdrawals_count || 0),
        accountId: i.account_id || undefined,
        origin: i.origin || undefined,
        pluggyInvestmentId: i.pluggy_investment_id || undefined,
        pluggyItemId: i.pluggy_item_id || undefined,
        isReconciled: !!i.is_reconciled,
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

    if (creditCardsData !== null) {
      result.creditCards = creditCardsData.map(c => ({
        id: c.id,
        name: c.name,
        limitAmount: Number(c.limit_amount || 0),
        closingDay: Number(c.closing_day || 1),
        dueDay: Number(c.due_day || 1),
        accountId: c.account_id || '',
        color: c.color || '#8B5CF6',
      }));
    }

    if (invoicesData !== null) {
      result.invoices = invoicesData.map(i => ({
        id: i.id,
        creditCardId: i.credit_card_id,
        month: Number(i.month),
        year: Number(i.year),
        closingDate: i.closing_date,
        dueDate: i.due_date,
        totalAmount: Number(i.total_amount || 0),
        status: i.status,
        paidAt: i.paid_at || undefined,
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

      // Find subcategory ID matching name
      const { data: subData } = tx.subcategoryId 
        ? await supabase.from('categories').select('id').eq('id', tx.subcategoryId).single()
        : { data: null };
      const subId = subData?.id || null;

      const dbPayload = {
        id: tx.id,
        type: tx.type,
        category_id: catId,
        category_name: tx.category,
        subcategory_id: subId,
        subcategory: tx.subcategory || '',
        tag_ids: tx.tagIds || [],
        amount: tx.amount,
        date: tx.date,
        recurring: tx.recurring || 'none',
        recurrence_config: tx.recurrenceConfig || null,
        recurrence_group_id: tx.recurrenceGroupId || null,
        notes: tx.notes || '',
        member_id: tx.memberId || null,
        account_id: tx.accountId || null,
        attachment_urls: tx.attachmentUrls || [],
        attachment_names: tx.attachmentNames || [],
        status: tx.status || 'REALIZADO',
        credit_card_id: tx.creditCardId || null,
        invoice_id: tx.invoiceId || null,
        installment_number: tx.installmentNumber ?? 1,
        total_installments: tx.totalInstallments ?? 1,
        include_in_balance_sum: tx.includeInBalanceSum ?? true,
      };
      const { error } = await supabase.from('transactions').upsert(dbPayload);
      if (error) console.error('Error syncing transaction:', error.message, JSON.stringify(dbPayload));
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync transaction to Supabase:', err);
    return false;
  }
}

export async function syncCategory(cat: Category | Subcategory, isDelete = false): Promise<boolean> {
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
        type: 'type' in cat ? cat.type : 'expense',
        icon: cat.icon || 'Folder',
        color: cat.color || '#6366F1',
        parent_id: 'parentId' in cat ? (cat.parentId || null) : ('categoryId' in cat ? cat.categoryId : null),
        is_shared: 'isShared' in cat ? (cat.isShared ?? true) : true,
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

export async function syncCreditCard(card: CreditCard, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('credit_cards').delete().eq('id', card.id);
      return !error;
    } else {
      const dbPayload = {
        id: card.id,
        name: card.name,
        limit_amount: card.limitAmount,
        closing_day: card.closingDay,
        due_day: card.dueDay,
        account_id: card.accountId,
        color: card.color || '#8B5CF6',
      };
      const { error } = await supabase.from('credit_cards').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync credit card to Supabase:', err);
    return false;
  }
}

export async function syncInvoice(inv: Invoice, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
      return !error;
    } else {
      const dbPayload = {
        id: inv.id,
        credit_card_id: inv.creditCardId,
        month: inv.month,
        year: inv.year,
        closing_date: inv.closingDate,
        due_date: inv.dueDate,
        total_amount: inv.totalAmount,
        status: inv.status,
        paid_at: inv.paidAt || null,
      };
      const { error } = await supabase.from('invoices').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync invoice to Supabase:', err);
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
      const categoryId = catData?.id || null;

      const dbPayload = {
        id: bud.id,
        category_id: categoryId,
        limit_amount: bud.limit,
        month: bud.month,
        notify_at_percent: bud.notifyAtPercent ?? 80,
        rollover: bud.rollover ?? false,
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
        category: goal.categoryId || null,
        account_id: goal.accountId || null,
        monthly_contribution: goal.monthlyContribution ?? null,
      };
      const { error } = await supabase.from('goals').upsert(dbPayload);
      if (error) return false;

      // Persistir ledger de aportes/resgates (delete + reinsert, pois o app envia a lista completa)
      const contributions = goal.contributions || [];
      const { error: delErr } = await supabase.from('goal_contributions').delete().eq('goal_id', goal.id);
      if (delErr) return false;
      if (contributions.length > 0) {
        const rows = contributions.map((c, i) => ({
          id: `${goal.id}_${i}`,
          goal_id: goal.id,
          member_id: c.memberId,
          amount: c.amount,
          date: c.date,
          type: c.type,
        }));
        const { error: insErr } = await supabase.from('goal_contributions').insert(rows);
        return !insErr;
      }
      return true;
    }
  } catch (err) {
    console.error('Failed to sync goal to Supabase:', err);
    return false;
  }
}

export async function syncMonthlyGoal(goal: MonthlyGoal, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('monthly_goals').delete().eq('id', goal.id);
      return !error;
    } else {
      const dbPayload = {
        id: goal.id,
        name: goal.name,
        month: goal.month,
        limit_amount: goal.limit,
        category_ids: goal.categoryIds || [],
        notify_at_percent: goal.notifyAtPercent ?? 80,
      };
      const { error } = await supabase.from('monthly_goals').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync monthly goal to Supabase:', err);
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
      const billingDay = sub.billingDate
        ? (sub.billingDate.length > 2 ? parseInt(sub.billingDate.split('-')[2]) : parseInt(sub.billingDate)) || 1
        : 1;
      const dbPayload = {
        id: sub.id,
        name: sub.name,
        amount: sub.amount,
        frequency: sub.frequency,
        category: sub.category,
        billing_date: billingDay,
        auto_notify: sub.autoNotify,
        member_id: sub.memberId,
        payment_method: sub.paymentMethod || 'credit_card',
        notify_channel: sub.notifyChannel || 'push',
        notify_days: sub.notifyDays ?? 3,
        account_id: sub.accountId || null,
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
        creditor: debt.creditor || null,
        total_amount: debt.totalAmount,
        installments_count: debt.installmentsCount,
        installment_amount: debt.installmentAmount,
        interest_rate: debt.interestRate,
        next_due_date: debt.nextDueDate,
        category: debt.category,
        paid_installments: debt.paidInstallments,
        account_id: debt.accountId || null,
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
        withdrawals_count: inv.withdrawalsCount || 0,
        account_id: inv.accountId || null,
        origin: inv.origin || null,
        pluggy_investment_id: inv.pluggyInvestmentId || null,
        pluggy_item_id: inv.pluggyItemId || null,
        is_reconciled: inv.isReconciled || false,
      };
      const { error } = await supabase.from('investments').upsert(dbPayload);
      if (error) {
        console.error('[Supabase Error] failed to upsert investment:', error.message || error);
        return false;
      }
      return true;
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
        access_role: mem.accessRole || 'member',
        notify_channels: mem.notifyChannels || ['push'],
      };
      const { error } = await supabase.from('family_members').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync family member to Supabase:', err);
    return false;
  }
}

export async function syncTag(tag: Tag, isDelete = false): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    if (isDelete) {
      const { error } = await supabase.from('tags').delete().eq('id', tag.id);
      return !error;
    } else {
      const dbPayload = {
        id: tag.id,
        name: tag.name,
        color: tag.color,
      };
      const { error } = await supabase.from('tags').upsert(dbPayload);
      return !error;
    }
  } catch (err) {
    console.error('Failed to sync tag to Supabase:', err);
    return false;
  }
}

// ==========================================
// APP PREFERENCES (chave-valor, ex: período padrão)
// ==========================================

export async function fetchAppPreference(key: string): Promise<any | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('app_preferences').select('value').eq('key', key).maybeSingle();
    if (error) {
      console.warn(`[Supabase Error] failed to load preference ${key}:`, error.message || error);
      return null;
    }
    return data?.value ?? null;
  } catch (err) {
    console.warn(`[Supabase Exception] while loading preference ${key}:`, err);
    return null;
  }
}

export async function saveAppPreference(key: string, value: any): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('app_preferences')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    return !error;
  } catch (err) {
    console.error(`Failed to save preference ${key} to Supabase:`, err);
    return false;
  }
}
