import * as supabaseStore from './pluggyStoreSupabase';

// O estado do Pluggy (pendências e conexões) é persistido exclusivamente
// no Supabase, nas tabelas pending_transactions e pluggy_connections.
// Para limpar os dados fake antes do deploy, rode o TRUNCATE em
// src/utils/supabaseSqlScript.ts.

export {
  isConfigured,
  upsertPending,
  listPendingByUser,
  getPending,
  updatePending,
  upsertConnection,
  listConnectionsByUser,
  deleteConnection,
  listAccountMappingsByUser,
  upsertAccountMapping,
} from './pluggyStoreSupabase';