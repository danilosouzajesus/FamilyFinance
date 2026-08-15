import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PluggyPendingTx, PluggyConnection, PluggyAccountMapping } from '../types';

let client: SupabaseClient | null = null;
let clientKey = '';

function getClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    client = null;
    clientKey = '';
    return null;
  }
  const keyStr = `${url}___${key}`;
  if (!client || clientKey !== keyStr) {
    client = createClient(url, key, { auth: { persistSession: false } });
    clientKey = keyStr;
  }
  return client;
}

function rowToPending(row: any): PluggyPendingTx {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id || undefined,
    rawDescription: row.raw_description,
    amount: Number(row.amount),
    date: typeof row.date === 'string' ? row.date.slice(0, 10) : new Date(row.date).toISOString().split('T')[0],
    type: row.type,
    paymentMethod: row.payment_method || '',
    pluggyTransactionId: row.pluggy_transaction_id,
    pluggyItemId: row.pluggy_item_id || undefined,
    suggestedCategoryId: row.suggested_category_id || undefined,
    suggestedCategory: row.suggested_category,
    suggestedSubcategoryId: row.suggested_subcategory_id || undefined,
    suggestedSubcategory: row.suggested_subcategory || '',
    suggestedTagIds: Array.isArray(row.suggested_tag_ids) ? row.suggested_tag_ids : [],
    aiConfidence: Number(row.ai_confidence || 0),
    suggestedReconcileTransactionId: row.suggested_reconcile_transaction_id || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function pendingToRow(p: PluggyPendingTx): any {
  return {
    id: p.id,
    user_id: p.userId,
    account_id: p.accountId || null,
    raw_description: p.rawDescription,
    amount: p.amount,
    date: p.date,
    type: p.type,
    payment_method: p.paymentMethod || null,
    pluggy_transaction_id: p.pluggyTransactionId,
    pluggy_item_id: p.pluggyItemId || null,
    suggested_category_id: p.suggestedCategoryId || null,
    suggested_category: p.suggestedCategory,
    suggested_subcategory_id: p.suggestedSubcategoryId || null,
    suggested_subcategory: p.suggestedSubcategory || '',
    suggested_tag_ids: p.suggestedTagIds || [],
    ai_confidence: p.aiConfidence,
    suggested_reconcile_transaction_id: p.suggestedReconcileTransactionId || null,
    status: p.status,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function rowToConnection(row: any): PluggyConnection {
  return {
    id: row.id,
    userId: row.user_id,
    itemId: row.item_id,
    connectorName: row.connector_name,
    connectorLogoUrl: row.connector_logo_url || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function connectionToRow(c: PluggyConnection): any {
  return {
    id: c.id,
    user_id: c.userId,
    item_id: c.itemId,
    connector_name: c.connectorName,
    connector_logo_url: c.connectorLogoUrl || null,
    status: c.status,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function isConfigured(): boolean {
  return !!getClient();
}

export async function upsertPending(pending: PluggyPendingTx): Promise<PluggyPendingTx> {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase não configurado para o store do Pluggy.');
  const { data, error } = await supabase
    .from('pending_transactions')
    .upsert(pendingToRow(pending), { onConflict: 'pluggy_transaction_id' })
    .select()
    .single();
  if (error) throw error;
  return rowToPending(data);
}

export async function listPendingByUser(userId: string): Promise<PluggyPendingTx[]> {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase não configurado para o store do Pluggy.');
  const { data, error } = await supabase
    .from('pending_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToPending);
}

export async function getPending(id: string): Promise<PluggyPendingTx | undefined> {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase não configurado para o store do Pluggy.');
  const { data, error } = await supabase.from('pending_transactions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToPending(data) : undefined;
}

export async function updatePending(id: string, changes: Partial<PluggyPendingTx>): Promise<PluggyPendingTx | null> {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase não configurado para o store do Pluggy.');
  const map: Record<string, keyof PluggyPendingTx> = {
    user_id: 'userId',
    account_id: 'accountId',
    raw_description: 'rawDescription',
    amount: 'amount',
    date: 'date',
    type: 'type',
    payment_method: 'paymentMethod',
    pluggy_item_id: 'pluggyItemId',
    suggested_category_id: 'suggestedCategoryId',
    suggested_category: 'suggestedCategory',
    suggested_subcategory_id: 'suggestedSubcategoryId',
    suggested_subcategory: 'suggestedSubcategory',
    suggested_tag_ids: 'suggestedTagIds',
    ai_confidence: 'aiConfidence',
    suggested_reconcile_transaction_id: 'suggestedReconcileTransactionId',
    status: 'status',
  };
  const update: any = { updated_at: new Date().toISOString() };
  for (const [col, key] of Object.entries(map)) {
    if (changes[key] !== undefined) update[col] = changes[key] ?? null;
  }
  const { data, error } = await supabase
    .from('pending_transactions')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data ? rowToPending(data) : null;
}

export async function upsertConnection(conn: PluggyConnection): Promise<PluggyConnection> {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase não configurado para o store do Pluggy.');
  const { data, error } = await supabase
    .from('pluggy_connections')
    .upsert(connectionToRow(conn), { onConflict: 'item_id' })
    .select()
    .single();
  if (error) throw error;
  return rowToConnection(data);
}

export async function listConnectionsByUser(userId: string): Promise<PluggyConnection[]> {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase não configurado para o store do Pluggy.');
  const { data, error } = await supabase
    .from('pluggy_connections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToConnection);
}

export async function deleteConnection(itemId: string): Promise<boolean> {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase não configurado para o store do Pluggy.');
  const { error } = await supabase.from('pluggy_connections').delete().eq('item_id', itemId);
  if (error) throw error;
  return true;
}

function rowToMapping(row: any): PluggyAccountMapping {
  return {
    userId: row.user_id,
    pluggyAccountId: row.pluggy_account_id,
    appAccountId: row.app_account_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAccountMappingsByUser(userId: string): Promise<PluggyAccountMapping[]> {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase não configurado para o store do Pluggy.');
  const { data, error } = await supabase
    .from('pluggy_account_mappings')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(rowToMapping);
}

export async function upsertAccountMapping(mapping: PluggyAccountMapping): Promise<PluggyAccountMapping> {
  const supabase = getClient();
  if (!supabase) throw new Error('Supabase não configurado para o store do Pluggy.');
  const row = {
    user_id: mapping.userId,
    pluggy_account_id: mapping.pluggyAccountId,
    app_account_id: mapping.appAccountId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('pluggy_account_mappings')
    .upsert(row, { onConflict: 'user_id,pluggy_account_id' })
    .select()
    .single();
  if (error) throw error;
  return rowToMapping(data);
}

export { isConfigured };