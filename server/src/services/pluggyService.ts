import { PluggyClient } from 'pluggy-sdk';
import {
  processIncomingPluggyTx,
} from '@ff/shared';
import {
  inferPaymentMethod,
  normalizePluggyDate,
  RawPluggyTx,
} from '@ff/shared';
import {
  upsertPending,
  upsertConnection,
} from '../repositories/pluggyStore';

// Único ponto que importa pluggy-sdk no projeto (servidor).
let pluggyClient: PluggyClient | null = null;

export function getPluggyClient(): PluggyClient | null {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (!pluggyClient) {
    pluggyClient = new PluggyClient({ clientId, clientSecret });
  }
  return pluggyClient;
}

// Busca a transação na Pluggy e a converte em pendência classificada.
export async function processWebhookEvent(itemId: string, transactionId: string) {
  const client = getPluggyClient();
  if (!client) {
    console.warn('[Pluggy] Webhook ignorado: chaves não configuradas.');
    return;
  }
  const tx = await client.fetchTransaction(transactionId);
  const item = await client.fetchItem(itemId);
  const userId = item.clientUserId || 'local';

  const raw: RawPluggyTx = {
    id: tx.id,
    accountId: tx.accountId,
    description: tx.description || tx.descriptionRaw || '',
    amount: tx.amount,
    date: normalizePluggyDate(tx.date),
    paymentMethod: tx.paymentData?.paymentMethod || inferPaymentMethod(tx.description || ''),
    pluggyType: tx.type,
  };

  const pending = processIncomingPluggyTx(raw, { categories: [] });
  await upsertPending({ ...pending, userId, pluggyItemId: item.id });

  if (item.connector) {
    await upsertConnection({
      id: `conn_${Date.now()}`,
      userId,
      itemId: item.id,
      connectorName: item.connector.name || 'Banco',
      connectorLogoUrl: item.connector.imageUrl,
      status: item.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}