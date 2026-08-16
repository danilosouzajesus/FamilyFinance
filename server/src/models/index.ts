// Re-exports de tipos de @ff/shared para os controllers/rotas do servidor.
// Mantém um único ponto de entrada de tipos no backend.
export type {
  PluggyPendingTx,
  PluggyConnection,
  PluggyAccountMapping,
  PluggyAccountInfo,
  PluggyPendingStatus,
} from '@ff/shared';