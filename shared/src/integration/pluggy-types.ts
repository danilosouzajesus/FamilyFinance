import type { TransactionType } from '../domain/transaction';

export type PluggyPendingStatus = 'PENDING' | 'APPROVED' | 'RECONCILED' | 'IGNORED';

export interface PluggyPendingTx {
  id: string;
  userId: string;
  accountId?: string;
  rawDescription: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  paymentMethod: string; // PIX | CARTAO_CREDITO | DEBITO | TED_DOC | BOLETO
  pluggyTransactionId: string;
  pluggyItemId?: string;
  suggestedCategoryId?: string;
  suggestedCategory: string;
  suggestedSubcategoryId?: string;
  suggestedSubcategory: string;
  suggestedTagIds: string[];
  aiConfidence: number;
  suggestedReconcileTransactionId?: string | null;
  status: PluggyPendingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PluggyConnection {
  id: string;
  userId: string;
  itemId: string;
  connectorName: string;
  connectorLogoUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Mapeamento manual entre uma conta/cartão da Pluggy e uma conta do app
export interface PluggyAccountMapping {
  userId: string;
  pluggyAccountId: string;
  appAccountId: string;
  createdAt: string;
  updatedAt: string;
}

// Conta bancária/cartão detectado na Pluggy, com o mapeamento aplicado
export interface PluggyAccountInfo {
  pluggyAccountId: string;
  itemId?: string;
  name: string;
  subtype?: string;
  mappedAppAccountId?: string | null;
}