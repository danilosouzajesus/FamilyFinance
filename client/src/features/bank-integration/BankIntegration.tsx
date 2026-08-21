import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Building2, 
  Upload, 
  Sparkles, 
  Check, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  FileText, 
  CheckCircle2,
  Plug,
  X,
  Link2,
  RefreshCw,
  Search,
  FlaskConical,
  PenLine,
  TrendingUp,
  Plus,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';
import { Category, Account, Transaction, AutomationRule, Subcategory, Tag, PluggyPendingTx, PluggyConnection, PluggyPendingStatus, PluggyAccountInfo, Investment, CreditCard } from '@ff/shared';
import { applyRulesToTx, RuleContext } from '@ff/shared';
import { buildApprovedTransaction, applySuggestionLive } from '@ff/shared';
import { inferPaymentMethod, RawPluggyInvestment, rawInvestmentToInvestmentFields, ParsedBankStatementResult } from '@ff/shared';
import { parsePdfBankStatement } from '../../lib/parsers/pdfStatementExtractor';

interface BankIntegrationProps {
  categories: Category[];
  subcategories?: Subcategory[];
  tags?: Tag[];
  accounts: Account[];
  creditCards?: CreditCard[];
  transactions: Transaction[];
  automationRules?: AutomationRule[];
  investments?: Investment[];
  onImportTransactions: (importedTxs: Transaction[]) => void;
  onImportInvestments?: (investments: Omit<Investment, 'id'>[]) => Promise<{ success: boolean; error?: string } | boolean> | void;
  onAddAccount?: (account: Account) => Promise<void> | void;
  onEditTransaction?: (tx: Transaction) => void;
  userId?: string;
}

interface PendingFileTx {
  id: string;
  description: string;
  type: 'income' | 'expense';
  amount: number;
  suggestedCategory: string;
  suggestedSubcategory: string;
  paymentMethod: string; // PIX | CARTAO_CREDITO | DEBITO | TED_DOC | BOLETO
  date: string; // YYYY-MM-DD
  confidence: number;
  accepted?: boolean;
  matched?: boolean; // já existe transação com mesmo valor e data ±3 dias
}

// Linha unificada de conciliação (vinda da Pluggy ou de arquivo PDF/OFX/CSV)
interface ConciliationRow {
  id: string;
  source: 'PLUGGY' | 'OFX' | 'CSV' | 'PDF';
  description: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  paymentMethod: string;
  suggestedCategory: string;
  suggestedCategoryId?: string;
  suggestedSubcategory: string;
  suggestedSubcategoryId?: string;
  suggestedTagIds: string[];
  confidence: number;
  pluggyTransactionId?: string;
  pluggyPendingId?: string; // id da pendência no servidor
  accountId?: string; // id da conta/cartão de origem na Pluggy
  status?: PluggyPendingStatus;
  suggestedReconcileTransactionId?: string | null;
  matched?: boolean;
  accepted?: boolean;
}

// Ambiente Pluggy: em dev (npm run dev) o widget inclui o conector Sandbox (Pluggy Bank)
// para testes; no build de produção o sandbox fica desativado por padrão, a menos que
// VITE_PLUGGY_ENABLE_SANDBOX=true seja definido explicitamente.
export const PLUGGY_SANDBOX_ENABLED =
  import.meta.env.VITE_PLUGGY_ENABLE_SANDBOX === 'true' ||
  (import.meta.env.VITE_PLUGGY_ENABLE_SANDBOX === undefined && import.meta.env.DEV);

export const SANDBOX_HINT = 'Sandbox (dev): use usuário "user-ok", senha "password-ok" e MFA "123456".';

// ---- Helpers de API ----
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Confirme que o backend está rodando (npm run dev) e tente novamente.');
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = await res.json();
      msg = body.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

// Mensagem exibida quando a sincronização remove conexões cujo item não existe
// mais na Pluggy (itens de sandbox são apagados após 30 dias sem atualização).
function removedConnectionsNotice(removed?: string[]): string {
  if (!removed || removed.length === 0) return '';
  const names = removed.join('", "');
  const plural = removed.length > 1;
  return ` ${plural ? 'As conexões' : 'A conexão'} "${names}" ${plural ? 'foram' : 'foi'} removida${plural ? 's' : ''} porque o item expirou na Pluggy (itens de sandbox são apagados após 30 dias sem atualização). Reconecte o banco.`;
}

// 2.1 Identificação de tipo de transação a partir da descrição (via util compartilhado)
// 2.1 Parser de arquivo OFX
function parseOFX(text: string): PendingFileTx[] {
  const out: PendingFileTx[] = [];
  const blocks = text.split('<STMTTRN>');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('</STMTTRN>')[0];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<]*)`));
      return m ? m[1].trim() : '';
    };
    const trnType = get('TRNTYPE').toUpperCase();
    const amountStr = get('TRNAMT');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount === 0) continue;

    const memo = get('MEMO') || get('NAME') || get('PAYEE');
    const type: 'income' | 'expense' = amount >= 0 ? 'income' : 'expense';
    const dtPosted = get('DTPOSTED').slice(0, 8);
    const date = dtPosted.length === 8
      ? `${dtPosted.slice(0, 4)}-${dtPosted.slice(4, 6)}-${dtPosted.slice(6, 8)}`
      : new Date().toISOString().split('T')[0];

    out.push({
      id: `ofx_${Date.now()}_${i}`,
      description: memo || 'Transação OFX',
      type,
      amount: Math.abs(amount),
      suggestedCategory: type === 'income' ? 'Outras Receitas' : 'Outras Despesas',
      suggestedSubcategory: '',
      paymentMethod: inferPaymentMethod(memo, trnType),
      date,
      confidence: 90
    });
  }
  return out;
}

// 2.1 Parser de arquivo CSV (data;descricao;valor)
function parseCSV(text: string): PendingFileTx[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const out: PendingFileTx[] = [];
  let idx = 0;
  for (const line of lines) {
    idx++;
    const parts = line.split(/[;,]/).map(p => p.trim()).filter(p => p);
    if (parts.length < 2) continue;
    const amountMatch = parts.map(p => p.replace(/"/g, '')).map(p => parseFloat(p.replace('R$', '').replace('.', '').replace(',', '.'))).filter(n => !isNaN(n));
    const amount = amountMatch.length ? Math.max(...amountMatch.map(Math.abs)) : NaN;
    if (isNaN(amount) || amount === 0) continue;
    const description = parts.find(p => isNaN(parseFloat(p.replace(/"/g, '').replace('R$', '').replace('.', '').replace(',', '.')))) || `Linha ${idx}`;
    let date = new Date().toISOString().split('T')[0];
    const datePart = parts.find(p => /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(p) || /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(p));
    if (datePart) {
      const sep = datePart.includes('/') ? '/' : '-';
      const dParts = datePart.split(sep);
      if (dParts[0].length === 4) date = `${dParts[0]}-${dParts[1].padStart(2, '0')}-${dParts[2].padStart(2, '0')}`;
      else date = `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
    }
    out.push({
      id: `csv_${Date.now()}_${idx}`,
      description: description.replace(/^["']|["']$/g, ''),
      type: amount >= 0 ? 'income' : 'expense',
      amount: Math.abs(amount),
      suggestedCategory: 'Outras Despesas',
      suggestedSubcategory: '',
      paymentMethod: inferPaymentMethod(description),
      date,
      confidence: 70
    });
  }
  return out;
}

export default function BankIntegration({
  categories,
  subcategories = [],
  tags = [],
  accounts,
  creditCards = [],
  transactions,
  automationRules = [],
  investments = [],
  onImportTransactions,
  onImportInvestments,
  onAddAccount,
  onEditTransaction,
  userId
}: BankIntegrationProps) {
  const [activeSubTab, setActiveSubTab] = useState<'pluggy' | 'conexoes' | 'ofx' | 'concil'>('pluggy');
  
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [pdfMeta, setPdfMeta] = useState<ParsedBankStatementResult | null>(null);

  const [pendingTxs, setPendingTxs] = useState<ConciliationRow[]>([]);
  const [reconciledCount, setReconciledCount] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pluggyNotice, setPluggyNotice] = useState<string | null>(null);

  const [targetAccountId, setTargetAccountId] = useState(accounts[0]?.id || '');

  // ---- Pluggy server state ----
  const [pluggyConfigured, setPluggyConfigured] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingAccount, setSyncingAccount] = useState<string | null>(null);
  const [syncFromDate, setSyncFromDate] = useState('');
  const [syncDatePromptOpen, setSyncDatePromptOpen] = useState(false);
  const [pendingSync, setPendingSync] = useState<{ mode: 'all' | 'account'; accountId?: string; accName?: string }>({ mode: 'all' });
  const [connections, setConnections] = useState<PluggyConnection[]>([]);
  const [archivedCount, setArchivedCount] = useState(0); // pendências já aprovadas/ignoradas nesta sessão

  const [reconcileTarget, setReconcileTarget] = useState<ConciliationRow | null>(null);
  const [reconcileSearch, setReconcileSearch] = useState('');

  // Mapeamento manual: conta/cartão da Pluggy → conta do app
  const [pluggyAccounts, setPluggyAccounts] = useState<PluggyAccountInfo[]>([]);
  const [accountMappings, setAccountMappings] = useState<Record<string, string>>({});
  const [mappingNotice, setMappingNotice] = useState<string | null>(null);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);

  // Investimentos detectados na Pluggy (carteira)
  const [pluggyInvestments, setPluggyInvestments] = useState<RawPluggyInvestment[]>([]);
  const [investmentsLoading, setInvestmentsLoading] = useState(false);
  const [invImportAccountId, setInvImportAccountId] = useState<Record<string, string>>({});
  const [importingInvestments, setImportingInvestments] = useState(false);
  const [selectedInvIds, setSelectedInvIds] = useState<string[]>([]);
  const [batchInvAccountId, setBatchInvAccountId] = useState('');
  const [hideImported, setHideImported] = useState(true);
  const [newAccModalOpen, setNewAccModalOpen] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccColor, setNewAccColor] = useState('#6366F1');
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Investimentos já importados para o app (identificados pelo pluggyInvestmentId),
  // derivados da lista real em vez de um estado local que se perde ao remontar.
  const importedInvestmentIds = useMemo(
    () => new Set(investments.filter(i => i.pluggyInvestmentId).map(i => i.pluggyInvestmentId as string)),
    [investments]
  );

  // Seleção em lote e edição lateral
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editRow, setEditRow] = useState<ConciliationRow | null>(null);
  const [editBatch, setEditBatch] = useState(false);

  useEffect(() => {
    if (accounts.length > 0 && !accounts.find(a => a.id === targetAccountId)) {
      setTargetAccountId(accounts[0].id);
    }
  }, [accounts, targetAccountId]);

  // 2.2 Matching: mesmo valor + data próxima (±3 dias)
  const findMatch = useCallback((tx: ConciliationRow | PendingFileTx): boolean => {
    return transactions.some(t => {
      if (t.deleted_at || t.type !== tx.type) return false;
      if (Math.abs(t.amount - tx.amount) > 0.01) return false;
      const d1 = new Date(t.date + 'T00:00:00').getTime();
      const d2 = new Date(tx.date + 'T00:00:00').getTime();
      return Math.abs(d1 - d2) <= 3 * 24 * 60 * 60 * 1000;
    });
  }, [transactions]);

  const seedPending = (rows: PendingFileTx[], source: 'OFX' | 'CSV' | 'PDF' = 'CSV') => {
    setPendingTxs(prev => [
      ...rows.map((tx, i) => {
        const cat = categories.find(c => c.name.toLowerCase() === tx.suggestedCategory.toLowerCase());
        const sub = subcategories.find(s => s.name.toLowerCase() === tx.suggestedSubcategory?.toLowerCase() && s.categoryId === cat?.id);
        return {
          ...tx,
          id: `pend_${Date.now()}_${i}`,
          source,
          suggestedCategoryId: cat?.id,
          suggestedSubcategoryId: sub?.id,
          suggestedTagIds: [],
          matched: tx.matched ?? findMatch(tx),
        } as ConciliationRow;
      }),
      ...prev,
    ]);
    setActiveSubTab('concil');
  };

  // Converte uma pendência da Pluggy em linha de conciliação, refinando a sugestão
  const pluggyToRow = useCallback((p: PluggyPendingTx): ConciliationRow => {
    const refined = applySuggestionLive(
      {
        rawDescription: p.rawDescription,
        type: p.type,
        amount: p.amount,
        date: p.date,
        suggestedCategory: p.suggestedCategory,
        suggestedTagIds: p.suggestedTagIds,
        aiConfidence: p.aiConfidence,
      },
      { categories, subcategories, tags, accounts, transactions, automationRules }
    );
    return {
      id: p.id,
      source: 'PLUGGY',
      description: p.rawDescription,
      type: (p.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
      amount: p.amount,
      date: p.date,
      paymentMethod: p.paymentMethod,
      suggestedCategory: refined.suggestedCategory,
      suggestedCategoryId: refined.suggestedCategoryId,
      suggestedSubcategory: refined.suggestedSubcategory,
      suggestedSubcategoryId: refined.suggestedSubcategoryId,
      suggestedTagIds: refined.suggestedTagIds,
      confidence: refined.aiConfidence,
      pluggyTransactionId: p.pluggyTransactionId,
      pluggyPendingId: p.id,
      accountId: p.accountId,
      status: p.status,
      suggestedReconcileTransactionId: refined.suggestedReconcileTransactionId,
      matched: !!refined.suggestedReconcileTransactionId,
    };
  }, [categories, subcategories, tags, accounts, transactions, automationRules]);

  const loadPluggyState = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      const config = await api<{ configured: boolean }>('/api/pluggy/config');
      setPluggyConfigured(config.configured);
      const uid = userId || 'local';
      const [pendList, connList, accountsInfo, invData] = await Promise.all([
        api<PluggyPendingTx[]>(`/api/pluggy/pending?userId=${encodeURIComponent(uid)}`),
        api<PluggyConnection[]>(`/api/pluggy/connections?userId=${encodeURIComponent(uid)}`),
        api<PluggyAccountInfo[]>(`/api/pluggy/accounts?userId=${encodeURIComponent(uid)}`),
        api<{ investments: RawPluggyInvestment[] }>(`/api/pluggy/investments?userId=${encodeURIComponent(uid)}`).catch(() => ({ investments: [] })),
      ]);
      setConnections(connList);
      setPluggyAccounts(accountsInfo);
      setPluggyInvestments(invData?.investments || []);
      setAccountMappings(
        accountsInfo.reduce<Record<string, string>>((acc, a) => {
          if (a.mappedAppAccountId) acc[a.pluggyAccountId] = a.mappedAppAccountId;
          return acc;
        }, {})
      );
      const active = pendList.filter(p => p.status === 'PENDING' && (!syncFromDate || (p.date || '') >= syncFromDate));
      const archived = pendList.length - pendList.filter(p => p.status === 'PENDING').length;
      setArchivedCount(archived);
      setPendingTxs(prev => {
        const nonPluggy = prev.filter(r => r.source !== 'PLUGGY');
        return [...active.map(pluggyToRow), ...nonPluggy];
      });
    } catch (e: any) {
      setPluggyAccounts([]);
      if (!opts?.silent) {
        setPluggyNotice(e.message || 'Não foi possível carregar a Caixa de Entrada da Pluggy. Confira se o backend está rodando (npm run dev).');
        console.warn('[Pluggy] Erro ao carregar estado:', e);
      }
    }
  }, [userId, pluggyToRow, syncFromDate]);

  useEffect(() => {
    loadPluggyState({ silent: true });
  }, [loadPluggyState]);

  // ---- Conexão via widget ----
  const handleConnectBank = async () => {
    setConnecting(true);
    setPluggyNotice(null);
    try {
      const uid = userId || 'local';
      const { accessToken } = await api<{ accessToken: string }>(
        `/api/pluggy/connect-token?userId=${encodeURIComponent(uid)}`
      );

      try {
        const mod = await import('pluggy-connect-sdk');
        const Widget = (mod as any).PluggyConnect || (mod as any).default;
        const widget = new Widget({
          connectToken: accessToken,
          includeSandbox: PLUGGY_SANDBOX_ENABLED,
          onSuccess: async ({ item }: any) => {
            try {
              if (item?.connector?.name) {
                await api('/api/pluggy/connections', {
                  method: 'POST',
                  body: JSON.stringify({
                    userId: uid,
                    itemId: item.id,
                    connectorName: item.connector.name,
                    connectorLogoUrl: item.connector.imageUrl,
                  }),
                });
              }
              setPluggyNotice(`Conexão realizada com sucesso (${item?.connector?.name || 'banco'}). Associe as contas do banco às contas do app para continuar.`);
              setConnecting(false);
              await loadPluggyState({ silent: true });
              setMappingModalOpen(true);
            } catch (err: any) {
              setPluggyNotice(err.message || 'Conexão realizada, mas houve um erro ao registrar/baixar as transações.');
              setConnecting(false);
            }
          },
          onError: ({ message }: any) => {
            setPluggyNotice(`Erro ao conectar: ${message || 'Falha na conexão.'}`);
            setConnecting(false);
          },
          onClose: () => setConnecting(false),
        });
        await widget.init();
      } catch (e) {
        // Fallback: abre o widget via URL externa caso o SDK falhe ao renderizar o modal
        if (accessToken) {
          window.open(`https://connect.pluggy.ai/?connectToken=${accessToken}`, '_blank', 'noopener');
          setPluggyNotice('Abrimos o widget de conexão da Pluggy em uma nova aba. Após conectar, volte aqui e clique em "Sincronizar" para baixar as transações.');
        } else {
          setPluggyNotice('Não foi possível obter o token de conexão da Pluggy. Verifique as credenciais no servidor.');
        }
        setConnecting(false);
      }
    } catch (e: any) {
      setPluggyNotice(e.message || 'Falha ao iniciar a conexão com a Pluggy.');
      setConnecting(false);
    }
  };

  // Sincronização manual com a Pluggy — busca transações das conexões e traz
  // para a Caixa de Entrada. Necessário no localhost (webhook exige HTTPS).
  const handleSyncPluggy = async (waitForItem = false) => {
    setSyncing(true);
    setPluggyNotice(null);
    try {
      const uid = userId || 'local';
      const params = new URLSearchParams({ userId: uid });
      if (waitForItem) params.set('wait', '1');
      if (syncFromDate) params.set('from', syncFromDate);
      const res = await api<{ synced: number; skipped: number; pending: PluggyPendingTx[]; removed?: string[] }>(
        `/api/pluggy/sync?${params.toString()}`,
        { method: 'POST' }
      );
      const msg = res.synced > 0
        ? `${res.synced} transações baixadas da Pluggy para a Caixa de Entrada.`
        : `Nenhuma transação nova. ${res.skipped > 0 ? `${res.skipped} já estavam na Caixa de Entrada.` : 'Conecte um banco e aguarde a sincronização.'}`;
      setPluggyNotice(msg + removedConnectionsNotice(res.removed));
      await loadPluggyState();
    } catch (e: any) {
      setPluggyNotice(e.message || 'Erro ao sincronizar com a Pluggy.');
    } finally {
      setSyncing(false);
    }
  };

  // Sincroniza apenas uma conta/cartão específico da Pluggy (tela Conexões)
  const handleSyncPluggyAccount = async (pluggyAccountId: string, accName: string) => {
    setSyncingAccount(pluggyAccountId);
    setPluggyNotice(null);
    try {
      const uid = userId || 'local';
      const params = new URLSearchParams({ userId: uid, accountId: pluggyAccountId });
      if (syncFromDate) params.set('from', syncFromDate);
      const res = await api<{ synced: number; skipped: number; pending: PluggyPendingTx[]; removed?: string[] }>(
        `/api/pluggy/sync?${params.toString()}`,
        { method: 'POST' }
      );
      setPluggyNotice(
        (res.synced > 0
          ? `${res.synced} transações de "${accName}" baixadas para o Painel de Conciliação.`
          : `Nenhuma transação nova em "${accName}".`)
        + removedConnectionsNotice(res.removed)
      );
      await loadPluggyState();
      setActiveSubTab('concil');
    } catch (e: any) {
      setPluggyNotice(e.message || 'Erro ao sincronizar a conta.');
    } finally {
      setSyncingAccount(null);
    }
  };

  // Abre o modal pedindo a data inicial antes de sincronizar
  const openSyncDatePrompt = (mode: 'all' | 'account', accountId?: string, accName?: string) => {
    setPendingSync({ mode, accountId, accName });
    setSyncDatePromptOpen(true);
  };

  // Cria uma nova conta de investimento de forma rápida diretamente pela tela
  const handleQuickCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim() || creatingAccount) return;
    setCreatingAccount(true);
    try {
      const newAcc: Account = {
        id: `acc_inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: newAccName.trim(),
        type: 'investment',
        balance: 0,
        color: newAccColor || '#6366F1'
      };
      if (onAddAccount) {
        await onAddAccount(newAcc);
      }
      setBatchInvAccountId(newAcc.id);
      setInvImportAccountId(prev => {
        const next = { ...prev };
        // Preenche para todos os selecionados ou sem conta definida
        selectedInvIds.forEach(id => { next[id] = newAcc.id; });
        return next;
      });
      setNewAccName('');
      setNewAccModalOpen(false);
      setPluggyNotice(`Conta de investimento "${newAcc.name}" criada com sucesso!`);
    } catch (err: any) {
      setPluggyNotice(`Erro ao criar conta: ${err.message || err}`);
    } finally {
      setCreatingAccount(false);
    }
  };

  // Importa um ativo detectado na Pluggy para o app (tela Investimentos & Dívidas),
  // vinculando-o à conta de investimento escolhida e marcando a origem como Pluggy.
  const handleImportInvestment = async (raw: RawPluggyInvestment) => {
    const targetId = invImportAccountId[raw.id] || '';
    if (!targetId || importedInvestmentIds.has(raw.id)) return;
    if (!onImportInvestments) return;

    setImportingInvestments(true);
    setPluggyNotice(null);
    try {
      const res = await onImportInvestments([
        {
          ...rawInvestmentToInvestmentFields(raw),
          accountId: targetId,
          origin: 'PLUGGY',
          pluggyInvestmentId: raw.id,
          pluggyItemId: raw.itemId,
          isReconciled: true,
          contributionsCount: 1,
        },
      ]);
      const isSuccess = typeof res === 'object' && res !== null ? res.success : res !== false;
      const errMsg = typeof res === 'object' && res !== null && res.error ? res.error : 'Falha de comunicação com o Supabase.';

      if (!isSuccess) {
        setPluggyNotice(`Falha ao salvar no banco de dados: ${errMsg}`);
      } else {
        setPluggyNotice(`Ativo "${raw.name}" importado e salvo com sucesso no banco de dados.`);
      }
    } catch (err: any) {
      setPluggyNotice(`Erro ao importar ativo no banco de dados: ${err.message || err}`);
    } finally {
      setImportingInvestments(false);
    }
  };

  // Importa vários ativos selecionados de uma vez para as contas de investimento associadas.
  const handleImportInvestmentsBatch = async () => {
    if (!onImportInvestments) return;
    const selected = pluggyInvestments.filter(
      inv => selectedInvIds.includes(inv.id) && !importedInvestmentIds.has(inv.id)
    );
    if (selected.length === 0) return;

    const withoutAccount = selected.filter(raw => !invImportAccountId[raw.id]);
    if (withoutAccount.length > 0) {
      setPluggyNotice(`Por favor, selecione uma conta de investimento para todos os ativos antes de importar (faltam ${withoutAccount.length}).`);
      return;
    }

    setImportingInvestments(true);
    setPluggyNotice(null);
    try {
      const res = await onImportInvestments(
        selected.map(raw => ({
          ...rawInvestmentToInvestmentFields(raw),
          accountId: invImportAccountId[raw.id] || '',
          origin: 'PLUGGY',
          pluggyInvestmentId: raw.id,
          pluggyItemId: raw.itemId,
          isReconciled: true,
          contributionsCount: 1,
        }))
      );
      const isSuccess = typeof res === 'object' && res !== null ? res.success : res !== false;
      const errMsg = typeof res === 'object' && res !== null && res.error ? res.error : 'Falha de comunicação com o Supabase.';

      if (!isSuccess) {
        setPluggyNotice(`Falha ao sincronizar com o banco: ${errMsg}`);
      } else {
        setPluggyNotice(`${selected.length} ativo(s) importado(s) e persistidos com sucesso no banco de dados!`);
        setSelectedInvIds([]);
        setBatchInvAccountId('');
      }
    } catch (err: any) {
      setPluggyNotice(`Erro na importação em lote: ${err.message || err}`);
    } finally {
      setImportingInvestments(false);
    }
  };

  // Aplica a conta de investimento escolhida a todos os ativos selecionados (operação em lote).
  const handleApplyBatchAccount = (accountId: string) => {
    setBatchInvAccountId(accountId);
    setInvImportAccountId(prev => {
      const next = { ...prev };
      selectedInvIds.forEach(id => { next[id] = accountId; });
      return next;
    });
  };

  const confirmSyncWithDate = async () => {
    setSyncDatePromptOpen(false);
    if (pendingSync.mode === 'account' && pendingSync.accountId && pendingSync.accName) {
      await handleSyncPluggyAccount(pendingSync.accountId, pendingSync.accName);
    } else {
      await handleSyncPluggy();
    }
  };

  const handleDemoGenerate = async () => {
    setSyncing(true);
    try {
      const uid = userId || 'local';
      const res = await api<{ generated: number; pending: PluggyPendingTx[] }>(
        `/api/pluggy/demo/generate?userId=${encodeURIComponent(uid)}`,
        { method: 'POST' }
      );
      setPluggyNotice(`${res.generated} transações de demonstração baixadas na Caixa de Entrada.`);
      await loadPluggyState();
      setActiveSubTab('concil');
    } catch (e: any) {
      setPluggyNotice(e.message || 'Erro ao gerar transações de demonstração.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async (itemId: string) => {
    try {
      await api(`/api/pluggy/connections/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
      setConnections(prev => prev.filter(c => c.itemId !== itemId));
    } catch (e: any) {
      setPluggyNotice(e.message || 'Erro ao desconectar.');
    }
  };

  // Resolve a conta/cartão do app para uma pendência: usa o mapeamento manual se existir,
  // senão a "Conta de Destino" escolhida no cabeçalho. Quando o alvo é um cartão de
  // crédito, retorna também o creditCardId para a transação ser registrada na fatura.
  const resolveAppTarget = useCallback((row: ConciliationRow): { accountId: string; creditCardId?: string; includeInBalanceSum?: boolean } => {
    const mappedId = (row.accountId && accountMappings[row.accountId]) || '';
    const targetId = mappedId || targetAccountId;
    const card = creditCards.find(c => c.id === targetId);
    if (card) {
      // Compras de cartão apontam para o cartão (fatura) e não debitam o saldo da conta.
      return { accountId: card.accountId || targetId, creditCardId: card.id, includeInBalanceSum: false };
    }
    return { accountId: targetId };
  }, [accountMappings, targetAccountId, creditCards]);

  // Salva o mapeamento de uma conta/cartão da Pluggy para uma conta do app
  const handleMapAccount = async (pluggyAccountId: string, appAccountId: string) => {
    const uid = userId || 'local';
    try {
      await api('/api/pluggy/accounts/map', {
        method: 'POST',
        body: JSON.stringify({ userId: uid, pluggyAccountId, appAccountId }),
      });
      setAccountMappings(prev => ({ ...prev, [pluggyAccountId]: appAccountId }));
      const targetName = accounts.find(a => a.id === appAccountId)?.name || creditCards.find(c => c.id === appAccountId)?.name || appAccountId;
      setMappingNotice(`Conta mapeada: ${pluggyAccounts.find(a => a.pluggyAccountId === pluggyAccountId)?.name || pluggyAccountId} → ${targetName}.`);
    } catch (e: any) {
      setMappingNotice(e.message || 'Erro ao salvar o mapeamento.');
    }
  };

  // Desfaz o mapeamento (passa a usar a Conta de Destino)
  const handleUnmapAccount = async (pluggyAccountId: string) => {
    const uid = userId || 'local';
    try {
      await api('/api/pluggy/accounts/map', {
        method: 'POST',
        body: JSON.stringify({ userId: uid, pluggyAccountId, appAccountId: '' }),
      });
      setAccountMappings(prev => {
        const next = { ...prev };
        delete next[pluggyAccountId];
        return next;
      });
      setMappingNotice('Mapeamento removido. A Conta de Destino será usada.');
    } catch (e: any) {
      setMappingNotice(e.message || 'Erro ao remover o mapeamento.');
    }
  };

  // Confirma o mapeamento no modal pós-conexão: apenas salva as associações.
  // A sincronização é feita manualmente, pelo botão de cada conta na aba Conexões.
  const handleConfirmMapping = async () => {
    const uid = userId || 'local';
    try {
      await Promise.all(
        pluggyAccounts.map(async acc => {
          const appId = accountMappings[acc.pluggyAccountId] || '';
          await api('/api/pluggy/accounts/map', {
            method: 'POST',
            body: JSON.stringify({ userId: uid, pluggyAccountId: acc.pluggyAccountId, appAccountId: appId }),
          });
        })
      );
      setMappingModalOpen(false);
      setMappingNotice('Contas associadas. Para baixar as transações, use o botão "Sincronizar" na aba Conexões.');
      await loadPluggyState({ silent: true });
    } catch (e: any) {
      setMappingNotice(e.message || 'Erro ao salvar o mapeamento.');
    }
  };

  // 2.1 Real file reading + parser (PDF, OFX, CSV)
  const processFile = async (file: File) => {
    setUploadedFileName(file.name);
    setParseError(null);
    const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

    if (isPDF) {
      try {
        const result = await parsePdfBankStatement(file);
        if (!result || result.transactions.length === 0) {
          setParseError('Nenhuma transação foi identificada no arquivo PDF. Verifique se é um extrato bancário suportado (ex: Banco BV, Itaú, Nubank, etc.).');
          return;
        }

        setPdfMeta(result);

        // Se for do Banco BV, tenta encontrar a conta correspondente
        if (result.bankCode === '413' || result.bankName?.toLowerCase().includes('bv')) {
          const matchedAcc = accounts.find(a => 
            a.name.toLowerCase().includes('bv') || 
            a.name.toLowerCase().includes('votorantim') ||
            (result.accountNumber && a.name.includes(result.accountNumber))
          );
          if (matchedAcc) {
            setTargetAccountId(matchedAcc.id);
          }
        }

        const rows: PendingFileTx[] = result.transactions.map(t => ({
          id: t.id,
          description: t.description,
          type: t.type,
          amount: t.amount,
          suggestedCategory: t.suggestedCategory,
          suggestedSubcategory: t.suggestedSubcategory || '',
          paymentMethod: t.paymentMethod,
          date: t.date,
          confidence: t.confidence,
        }));

        seedPending(rows, 'PDF');
      } catch (err: any) {
        setParseError(`Erro ao processar o PDF: ${err?.message || 'Arquivo corrompido ou formato ilegível'}`);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      let rows: PendingFileTx[] = [];
      const isOFX = file.name.toLowerCase().endsWith('.ofx') || text.includes('<OFX>');
      if (isOFX) {
        rows = parseOFX(text);
        if (rows.length === 0) {
          setParseError('Nenhuma transação válida encontrada no arquivo OFX.');
        } else {
          seedPending(rows, 'OFX');
        }
      } else {
        rows = parseCSV(text);
        if (rows.length === 0) {
          setParseError('Nenhuma transação válida encontrada no arquivo CSV.');
        } else {
          seedPending(rows, 'CSV');
        }
      }
    };
    reader.onerror = () => setParseError('Não foi possível ler o arquivo.');
    reader.readAsText(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // Build a well-formed transaction for import, applying automation rules (2.3)
  const buildSystemTx = (tx: ConciliationRow): Transaction => {
    const cat = categories.find(c => c.name === tx.suggestedCategory);
    const sub = subcategories.find(s => s.name === tx.suggestedSubcategory && s.categoryId === cat?.id);

    const base: any = {
      type: tx.type,
      categoryId: cat?.id || '',
      category: cat?.name || tx.suggestedCategory,
      subcategoryId: sub?.id || undefined,
      subcategory: sub?.name || tx.suggestedSubcategory || '',
      tagIds: [],
      amount: tx.amount,
      date: tx.date,
      recurring: 'none',
      notes: tx.description,
      memberId: 'mem_geral',
      accountId: targetAccountId,
      attachmentUrls: [],
      attachmentNames: [],
      status: 'REALIZADO'
    };

    const ruleChanges = applyRulesToTx(base, automationRules, {
      categories,
      subcategories,
      tags,
      accounts
    } as RuleContext);
    return { ...base, ...ruleChanges, tagIds: [...(base.tagIds || []), ...(ruleChanges.tagIds || [])] };
  };

  // Remove localmente e registra contador
  const removeRow = (rowId: string, countAsArchived = true) => {
    setPendingTxs(prev => prev.filter(t => t.id !== rowId));
    if (countAsArchived) setArchivedCount(prev => prev + 1);
  };

  // Aprova (fila de aprovação) — para linhas PLUGGY envia ao servidor antes
  const handleAcceptAI = async (rowId: string) => {
    const row = pendingTxs.find(t => t.id === rowId);
    if (!row) return;
    if (row.source === 'PLUGGY' && row.pluggyPendingId) {
      await handleFinalize(row);
      return;
    }
    setPendingTxs(prev => prev.map(t => t.id === rowId ? { ...t, accepted: true } : t));
  };

  const handleFinalize = async (row: ConciliationRow) => {
    try {
      if (row.source === 'PLUGGY' && row.pluggyPendingId) {
        await api(`/api/pluggy/pending/${encodeURIComponent(row.pluggyPendingId)}/approve`, {
          method: 'POST',
          body: JSON.stringify({
            overrides: {
              category: row.suggestedCategory,
              categoryId: row.suggestedCategoryId,
              subcategory: row.suggestedSubcategory,
              subcategoryId: row.suggestedSubcategoryId,
              tagIds: row.suggestedTagIds,
              amount: row.amount,
              date: row.date,
            },
          }),
        });
        const tx = buildApprovedTransaction(
          {
            rawDescription: row.description,
            amount: row.amount,
            date: row.date,
            type: row.type,
            suggestedCategoryId: row.suggestedCategoryId,
            suggestedCategory: row.suggestedCategory,
            suggestedSubcategoryId: row.suggestedSubcategoryId,
            suggestedSubcategory: row.suggestedSubcategory,
            suggestedTagIds: row.suggestedTagIds,
            aiConfidence: row.confidence,
            pluggyTransactionId: row.pluggyTransactionId,
            pluggyItemId: undefined,
            paymentMethod: row.paymentMethod,
          },
          { categories, subcategories, tags, accounts, automationRules },
          resolveAppTarget(row)
        );
        onImportTransactions([tx]);
      } else {
        onImportTransactions([buildSystemTx(row)]);
      }
      removeRow(row.id);
      setReconciledCount(prev => prev + 1);
      setActiveSubTab('concil');
    } catch (e: any) {
      setPluggyNotice(e.message || 'Erro ao aprovar a transação.');
    }
  };

  const handleEditCategoryChange = (rowId: string, newCatName: string) => {
    setPendingTxs(prev => prev.map(t => {
      if (t.id === rowId) {
        const cat = categories.find(c => c.name === newCatName);
        const firstSub = subcategories.find(s => s.categoryId === cat?.id);
        return { ...t, suggestedCategory: newCatName, suggestedCategoryId: cat?.id, suggestedSubcategory: firstSub?.name || '', suggestedSubcategoryId: firstSub?.id };
      }
      return t;
    }));
  };

  const handleEditAndApprove = (rowId: string) => {
    const row = pendingTxs.find(t => t.id === rowId);
    if (!row) return;
    handleFinalize(row);
  };

  // Concilia com uma transação manual existente (evita duplicata)
  const handleConciliate = async (row: ConciliationRow, targetTx: Transaction) => {
    try {
      if (row.source === 'PLUGGY' && row.pluggyPendingId) {
        await api(`/api/pluggy/pending/${encodeURIComponent(row.pluggyPendingId)}/reconcile`, {
          method: 'POST',
          body: JSON.stringify({ targetTransactionId: targetTx.id }),
        });
      }
      const stamped: Transaction = {
        ...targetTx,
        isReconciled: true,
        pluggyTransactionId: row.pluggyTransactionId || `manual_${row.id}`,
        paymentMethod: targetTx.paymentMethod || row.paymentMethod,
      };
      onEditTransaction?.(stamped);
      removeRow(row.id);
      setReconciledCount(prev => prev + 1);
      setReconcileTarget(null);
      setReconcileSearch('');
      setActiveSubTab('concil');
    } catch (e: any) {
      setPluggyNotice(e.message || 'Erro ao conciliar a transação.');
    }
  };

  const handleIgnore = async (rowId: string) => {
    const row = pendingTxs.find(t => t.id === rowId);
    if (!row) return;
    try {
      if (row.source === 'PLUGGY' && row.pluggyPendingId) {
        await api(`/api/pluggy/pending/${encodeURIComponent(row.pluggyPendingId)}/ignore`, { method: 'POST' });
      }
      removeRow(rowId);
      setActiveSubTab('concil');
    } catch (e: any) {
      setPluggyNotice(e.message || 'Erro ao ignorar a transação.');
    }
  };

  const handleConciliateAll = async () => {
    if (pendingTxs.length === 0) return;
    const rows = [...pendingTxs];
    const toImport: Transaction[] = [];
    for (const row of rows) {
      if (row.source === 'PLUGGY' && row.pluggyPendingId) {
        try {
          await api(`/api/pluggy/pending/${encodeURIComponent(row.pluggyPendingId)}/approve`, {
            method: 'POST',
            body: JSON.stringify({ overrides: { category: row.suggestedCategory, categoryId: row.suggestedCategoryId, date: row.date, amount: row.amount } }),
          });
          toImport.push(buildApprovedTransaction(
            {
              rawDescription: row.description,
              amount: row.amount,
              date: row.date,
              type: row.type,
              suggestedCategoryId: row.suggestedCategoryId,
              suggestedCategory: row.suggestedCategory,
              suggestedSubcategoryId: row.suggestedSubcategoryId,
              suggestedSubcategory: row.suggestedSubcategory,
              suggestedTagIds: row.suggestedTagIds,
              aiConfidence: row.confidence,
              pluggyTransactionId: row.pluggyTransactionId,
              pluggyItemId: undefined,
              paymentMethod: row.paymentMethod,
            },
            { categories, subcategories, tags, accounts, automationRules },
            resolveAppTarget(row)
          ));
        } catch (e: any) {
          setPluggyNotice(`Falha ao aprovar "${row.description}": ${e.message}`);
          return;
        }
      } else {
        toImport.push(buildSystemTx(row));
      }
    }
    try {
      onImportTransactions(toImport);
      setReconciledCount(prev => prev + rows.length);
      setArchivedCount(prev => prev + rows.length);
      setPendingTxs([]);
      setActiveSubTab('concil');
    } catch (e: any) {
      setPluggyNotice(e.message || 'Erro ao importar transações.');
    }
  };

  // Lista de candidatos à conciliação (mesmo tipo + valor próximo)
  const reconcileCandidates = reconcileTarget
    ? transactions.filter(t => {
        if (t.deleted_at || t.type !== reconcileTarget.type) return false;
        if (t.isReconciled || t.pluggyTransactionId) return false;
        if (Math.abs(t.amount - reconcileTarget.amount) > 0.01) return false;
        if (reconcileSearch) {
          const q = reconcileSearch.toLowerCase();
          const hay = `${t.notes} ${t.category} ${t.date}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  // ---- Seleção em lote ----
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const clearSelection = () => {
    setSelectedIds([]);
    setEditRow(null);
    setEditBatch(false);
  };

  const openEdit = (row: ConciliationRow, batch = false) => {
    setEditBatch(batch);
    setEditRow(row);
    setReconcileTarget(null);
  };

  // Aplica a edição salva no painel lateral (uma linha ou todas as selecionadas)
  const handleEditSave = (changes: Partial<ConciliationRow>) => {
    const ids = editBatch ? selectedIds : (editRow ? [editRow.id] : []);
    setPendingTxs(prev => prev.map(t => ids.includes(t.id) ? { ...t, ...changes } : t));
    setEditRow(null);
    setEditBatch(false);
    if (editBatch) clearSelection();
  };

  // Aprovar em lote: finaliza (servidor + importa) cada linha selecionada
  const handleBatchApprove = async () => {
    const ids = [...selectedIds];
    let ok = 0;
    for (const id of ids) {
      const row = pendingTxs.find(t => t.id === id);
      if (!row) continue;
      await handleFinalize(row);
      ok++;
    }
    setPluggyNotice(`${ok} transações aprovadas e importadas.`);
    clearSelection();
  };

  // Ignorar em lote
  const handleBatchIgnore = async () => {
    const ids = [...selectedIds];
    for (const id of ids) await handleIgnore(id);
    setPluggyNotice(`${ids.length} transações ignoradas.`);
    clearSelection();
  };

  // Conciliar em lote: vincula cada selecionada à melhor transação manual compatível
  const handleBatchReconcile = async () => {
    let reconciled = 0;
    let skipped = 0;
    for (const id of [...selectedIds]) {
      const row = pendingTxs.find(t => t.id === id);
      if (!row) continue;
      const candidates = transactions
        .filter(t => {
          if (t.deleted_at || t.type !== row.type) return false;
          if (t.isReconciled || t.pluggyTransactionId) return false;
          if (Math.abs(t.amount - row.amount) > 0.01) return false;
          const d1 = new Date(row.date + 'T00:00:00').getTime();
          const d2 = new Date(t.date + 'T00:00:00').getTime();
          return Math.abs(d1 - d2) <= 3 * 24 * 60 * 60 * 1000;
        })
        .sort((a, b) => b.date.localeCompare(a.date));
      if (candidates.length > 0) {
        await handleConciliate(row, candidates[0]);
        reconciled++;
      } else {
        skipped++;
      }
    }
    setPluggyNotice(`Conciliação em lote: ${reconciled} conciliadas${skipped ? `, ${skipped} sem transação compatível` : ''}.`);
    clearSelection();
  };

  // Ativos com saldo > 0 e ainda não importados (alvo da seleção em lote)
  const availableInvIds = pluggyInvestments
    .filter(inv => (inv.amount ?? 0) > 0 && !importedInvestmentIds.has(inv.id))
    .map(inv => inv.id);
  const availableInvCount = availableInvIds.length;

  return (
    <div className="space-y-6" id="bank-integration-container">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Banco & Conciliação Automática</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Sincronize extratos em tempo real via Pluggy ou importe arquivos OFX com sugestões de IA</p>
        </div>
        
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-400">Conta de Destino:</span>
          <select
            value={targetAccountId}
            onChange={(e) => setTargetAccountId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance.toFixed(0)})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Integration Options menu tabs */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('pluggy')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'pluggy' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100/50' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Plug size={14} /> Sincronizar Pluggy (API)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('conexoes')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'conexoes' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100/50' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Link2 size={14} /> Conexões
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('ofx')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'ofx' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100/50' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Upload size={14} /> Importar Extrato (PDF/OFX/CSV)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('concil')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all relative cursor-pointer ${
            activeSubTab === 'concil' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100/50' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles size={14} /> Painel de Conciliação
          {pendingTxs.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center animate-pulse">
              {pendingTxs.length}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'pluggy' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
              <Building2 size={16} className="text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conectar Conta Bancária via Pluggy API</h3>
              {PLUGGY_SANDBOX_ENABLED ? (
                <span className="ml-auto px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-[9px] font-extrabold text-sky-700 uppercase tracking-wider" title={SANDBOX_HINT}>
                  🧪 Sandbox (dev)
                </span>
              ) : (
                <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-extrabold text-emerald-700 uppercase tracking-wider">
                  🔒 Produção
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Pluggy é uma infraestrutura de Open Finance que permite a leitura segura e automatizada de extratos bancários e faturas de cartão. Conecte sua instituição para automatizar toda a sua conciliação financeira familiar.
            </p>

            {PLUGGY_SANDBOX_ENABLED && (
              <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl text-[11px] text-sky-800 font-semibold flex items-start gap-2">
                <FlaskConical size={14} className="shrink-0 mt-0.5" />
                <span>{SANDBOX_HINT}</span>
              </div>
            )}

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shrink-0">
                  🏦
                </span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Conectar instituição financeira</h4>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Selecione seu banco ou corretora dentro do widget da Pluggy
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConnectBank}
                disabled={connecting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center gap-1.5 disabled:opacity-60 shrink-0"
              >
                {connecting ? <RefreshCw size={13} className="animate-spin" /> : <Plug size={13} />}
                {connecting ? 'Conectando...' : 'Conectar banco'}
              </button>
            </div>

            {!pluggyConfigured && (
              <div className="p-4 bg-violet-50/80 border border-violet-200/80 rounded-2xl text-xs text-violet-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-violet-950">
                  <Sparkles size={16} className="text-violet-600 shrink-0" />
                  <span>Chaves de API da Pluggy não configuradas no servidor (Vercel)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-violet-800 font-medium">
                  Para conectar bancos e cartões em produção com Open Finance, adicione as variáveis <code className="bg-violet-100/80 px-1.5 py-0.5 rounded text-violet-950 font-mono font-semibold">PLUGGY_CLIENT_ID</code> e <code className="bg-violet-100/80 px-1.5 py-0.5 rounded text-violet-950 font-mono font-semibold">PLUGGY_CLIENT_SECRET</code> no painel da Vercel (<b>Project Settings &gt; Environment Variables</b>) e faça um novo deploy.
                </p>
                <p className="text-[11px] leading-relaxed text-violet-800 font-medium">
                  Você pode usar o <b>Modo Demonstração</b> abaixo para testar a conciliação automática com transações de exemplo agora mesmo.
                </p>
              </div>
            )}

            {pluggyNotice && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 font-semibold flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{pluggyNotice}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {!pluggyConfigured && (
                <button
                  type="button"
                  onClick={handleDemoGenerate}
                  disabled={syncing}
                  className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60 shadow-sm"
                >
                  {syncing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {syncing ? 'Gerando dados de teste...' : 'Gerar Transações no Modo Demonstração'}
                </button>
              )}

              {connections.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {connections.map(c => (
                    <span key={c.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700 rounded-xl">
                      <Link2 size={11} /> {c.connectorName}
                      <button
                        type="button"
                        onClick={() => handleDisconnect(c.itemId)}
                        title="Desconectar"
                        className="text-emerald-500 hover:text-rose-600 cursor-pointer"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">🔒 Protocolo de Segurança Criptografado (LGPD/Open Finance)</p>
              <p className="text-[11px] text-emerald-700/95 font-medium mt-0.5">
                Suas senhas nunca são armazenadas. A Pluggy realiza conexões em modo de leitura criptografada fim-a-fim de transações de conta corrente de forma segura e transparente.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'pluggy' && pluggyAccounts.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <Building2 size={16} className="text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mapeamento de contas (conta/cartão → conta do app)</h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Associe cada conta ou cartão detectado pela Pluggy à conta do app correspondente. As transações aprovadas desta conta/cartão passarão a apontar para a conta mapeada automaticamente (em vez da "Conta de Destino" do cabeçalho).
          </p>

          {mappingNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-800 font-semibold flex items-start gap-2">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span>{mappingNotice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pluggyAccounts.map(acc => {
              const mapped = accountMappings[acc.pluggyAccountId];
              return (
                <div key={acc.pluggyAccountId} className={`p-4 rounded-xl border transition-all ${mapped ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{acc.name}</p>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                        {acc.subtype?.replace('_', ' ') || 'Conta bancária'}
                      </p>
                    </div>
                    {mapped && (
                      <button
                        type="button"
                        onClick={() => handleUnmapAccount(acc.pluggyAccountId)}
                        title="Remover mapeamento"
                        className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0">Conta do app</span>
                    <select
                      value={mapped || ''}
                      onChange={(e) => handleMapAccount(acc.pluggyAccountId, e.target.value)}
                      className={`flex-1 px-2 py-1.5 bg-white border rounded-lg text-xs font-bold focus:outline-none ${mapped ? 'border-indigo-300' : 'border-slate-200'}`}
                    >
                      <option value="">Usar Conta de Destino</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                      {creditCards.length > 0 && (
                        <optgroup label="Cartões de crédito">
                          {creditCards.map(c => (
                            <option key={c.id} value={c.id}>{c.name} (cartão)</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => openSyncDatePrompt('account', acc.pluggyAccountId, acc.name)}
                    disabled={syncingAccount === acc.pluggyAccountId || syncing}
                    title={`Sincronizar as transações de "${acc.name}"`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 mt-3"
                  >
                    {syncingAccount === acc.pluggyAccountId ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {syncingAccount === acc.pluggyAccountId ? 'Sincronizando...' : 'Sincronizar'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSubTab === 'pluggy' && pluggyInvestments.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Carteira de Investimentos (Pluggy)</h3>
            <button
              type="button"
              onClick={() => loadPluggyState({ silent: true })}
              disabled={investmentsLoading}
              className="ml-auto px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500 hover:bg-slate-50 cursor-pointer disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw size={11} className={investmentsLoading ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Ativos detectados na corretora/banco conectado (apenas com saldo acima de zero). Associe cada ativo a uma <b>conta de investimento</b> do app (ou crie uma nova) e importe para a tela "Investimentos &amp; Dívidas". Os valores ficam marcados como vindos da Pluggy. Ativos já importados ficam marcados e não podem ser importados novamente.
          </p>

          <div className="flex items-center gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedInvIds(prev =>
                  prev.length === availableInvCount ? [] : availableInvIds
                )}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                {selectedInvIds.length === availableInvCount && availableInvCount > 0 ? 'Desmarcar todos' : `Selecionar todos (${availableInvCount})`}
              </button>
              <button
                type="button"
                disabled={selectedInvIds.filter(id => !importedInvestmentIds.has(id)).length === 0 || importingInvestments}
                onClick={handleImportInvestmentsBatch}
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {importingInvestments ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                Importar selecionados ({selectedInvIds.filter(id => !importedInvestmentIds.has(id)).length})
              </button>
              <select
                value={batchInvAccountId}
                onChange={(e) => handleApplyBatchAccount(e.target.value)}
                disabled={selectedInvIds.filter(id => !importedInvestmentIds.has(id)).length === 0}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Aplicar conta a todos os selecionados"
              >
                <option value="">Aplicar conta a todos os selecionados...</option>
                {accounts.filter(a => a.type === 'investment').map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              {onAddAccount && (
                <button
                  type="button"
                  onClick={() => setNewAccModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg border border-dashed border-indigo-300 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 text-[10px] font-bold cursor-pointer flex items-center gap-1"
                  title="Criar nova conta de investimento"
                >
                  <Plus size={11} />
                  Nova Conta
                </button>
              )}
            </div>

            {/* Filtro: Ocultar já importados */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer select-none hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={hideImported}
                  onChange={(e) => setHideImported(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <Filter size={12} className="text-slate-400" />
                <span>Ocultar já importados</span>
              </label>
            </div>
          </div>

          {/* Quick Create Investment Account Modal */}
          {newAccModalOpen && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
              <div className="bg-white rounded-2xl p-5 max-w-sm w-full border border-slate-200 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-indigo-600" />
                    <h4 className="text-xs font-bold text-slate-900">Nova Conta de Investimento</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewAccModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                <form onSubmit={handleQuickCreateAccount} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Nome da Conta / Corretora
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: XP Investimentos, NuInvest, BTG..."
                      value={newAccName}
                      onChange={(e) => setNewAccName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Cor da Conta
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newAccColor}
                        onChange={(e) => setNewAccColor(e.target.value)}
                        className="h-8 w-12 rounded border border-slate-200 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-600">{newAccColor}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setNewAccModalOpen(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={!newAccName.trim() || creatingAccount}
                      className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {creatingAccount ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                      Criar e Vincular
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pluggyInvestments
              .filter(inv => (inv.amount ?? 0) > 0)
              .filter(inv => !hideImported || !importedInvestmentIds.has(inv.id))
              .map(inv => {
              const already = importedInvestmentIds.has(inv.id);
              const targetId = invImportAccountId[inv.id] || '';
              const targetName = accounts.find(a => a.id === targetId)?.name || '';
              const checked = selectedInvIds.includes(inv.id);
              return (
                <div key={inv.id} className={`p-4 rounded-xl border transition-all ${already ? 'border-emerald-200 bg-emerald-50/40' : checked ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={already}
                        onChange={() => setSelectedInvIds(prev =>
                          prev.includes(inv.id) ? prev.filter(id => id !== inv.id) : [...prev, inv.id]
                        )}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{inv.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                          {(inv.subtype || inv.type)?.replace('_', ' ')}{inv.institution ? ` • ${inv.institution}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0 ${inv.amountProfit !== undefined && inv.amountProfit < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {inv.amountProfit !== undefined && inv.amountProfit < 0 ? '' : '+'}R$ {(inv.amountProfit ?? 0).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs mt-2.5">
                    <span className="text-slate-500 font-semibold">Saldo atual: <b className="text-slate-900">R$ {(inv.amount ?? 0).toLocaleString('pt-BR')}</b></span>
                    {inv.amountOriginal !== undefined && (
                      <span className="text-[10px] text-slate-400 font-semibold">Aplicado: R$ {inv.amountOriginal.toLocaleString('pt-BR')}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <select
                      value={targetId}
                      onChange={(e) => setInvImportAccountId(prev => ({ ...prev, [inv.id]: e.target.value }))}
                      className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
                    >
                      <option value="">Selecione a conta de investimento</option>
                      {accounts.filter(a => a.type === 'investment').map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!targetId || already || importingInvestments}
                      onClick={() => handleImportInvestment(inv)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 ${already ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                    >
                      {already ? <Check size={11} /> : <CheckCircle2 size={11} />}
                      {already ? 'Importado' : 'Importar para o app'}
                    </button>
                  </div>
                  {targetName && !already && (
                    <p className="text-[9px] text-slate-400 mt-1.5">Vincular à conta: <b className="text-slate-600">{targetName}</b></p>
                  )}
                </div>
              );
            })}
          </div>

          {hideImported && pluggyInvestments.filter(inv => (inv.amount ?? 0) > 0 && !importedInvestmentIds.has(inv.id)).length === 0 && pluggyInvestments.some(inv => importedInvestmentIds.has(inv.id)) && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
              <CheckCircle2 size={20} className="text-emerald-600 mx-auto mb-1" />
              <p className="text-xs font-bold text-emerald-800">Todos os ativos disponíveis já foram importados para o app!</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                Desmarque o filtro "Ocultar já importados" acima se desejar visualizar os ativos já importados.
              </p>
            </div>
          )}

          {accounts.filter(a => a.type === 'investment').length === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[11px] text-amber-800 font-semibold flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>Nenhuma conta de investimento cadastrada. Crie uma conta do tipo "Investimento" em Contas &amp; Cartões antes de importar os ativos.</span>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'conexoes' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
              <Link2 size={16} className="text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conexões sincronizadas</h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Cada card abaixo representa uma conta ou cartão detectado pela Pluggy. Sincronize individualmente para baixar apenas as transações daquele cartão/conta para o Painel de Conciliação.
            </p>

            {pluggyNotice && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 font-semibold flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{pluggyNotice}</span>
              </div>
            )}

            {pluggyAccounts.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <Link2 size={24} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">Nenhuma conta sincronizada ainda.</p>
                <p className="text-[11px] text-slate-400 mt-1">Conecte um banco na aba "Sincronizar Pluggy (API)" ou gere o modo demonstração para ver os cards aqui.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pluggyAccounts.map(acc => {
                  const mappedId = accountMappings[acc.pluggyAccountId] || acc.mappedAppAccountId || '';
                  const mappedName = accounts.find(a => a.id === mappedId)?.name || '';
                  return (
                    <div key={acc.pluggyAccountId} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{acc.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                            {acc.subtype?.replace('_', ' ') || 'Conta bancária'}
                          </p>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                          mappedName ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {mappedName ? 'Vinculada' : 'Não vinculada'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-400 font-semibold shrink-0">Vinculada a:</span>
                        <select
                          value={mappedId}
                          onChange={(e) => handleMapAccount(acc.pluggyAccountId, e.target.value)}
                          className={`flex-1 min-w-0 px-2 py-1.5 bg-white border rounded-lg text-xs font-bold focus:outline-none ${mappedId ? 'border-indigo-300' : 'border-slate-200'}`}
                        >
                          <option value="">Usar Conta de Destino</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                          {creditCards.length > 0 && (
                            <optgroup label="Cartões de crédito">
                              {creditCards.map(c => (
                                <option key={c.id} value={c.id}>{c.name} (cartão)</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => openSyncDatePrompt('account', acc.pluggyAccountId, acc.name)}
                        disabled={syncingAccount === acc.pluggyAccountId || syncing}
                        title={`Sincronizar as transações de "${acc.name}"`}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {syncingAccount === acc.pluggyAccountId ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        {syncingAccount === acc.pluggyAccountId ? 'Sincronizando...' : 'Sincronizar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'ofx' && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col items-center justify-center space-y-6">
          <div className="text-center space-y-2 max-w-lg">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto shadow-xs">
              <Building2 size={24} />
            </div>
            <h3 className="text-base font-display font-bold text-slate-900">Importação de Extratos Bancários (PDF / OFX / CSV)</h3>
            <p className="text-xs text-slate-500 font-medium">
              Arraste ou selecione o arquivo PDF do seu extrato bancário (com suporte nativo a <strong>Banco BV</strong>, Nubank, Itaú, Bradesco, Santander, Inter, etc.), arquivo OFX ou planilha CSV.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold">
                ✓ Banco BV (PDF Nativo)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold">
                Extratos PDF Gerais
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold">
                OFX 2.0
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold">
                CSV / Excel
              </span>
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center space-y-3 cursor-pointer transition-all ${
              isDragging 
                ? 'border-indigo-600 bg-indigo-50/20' 
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <Upload size={32} className="text-indigo-600" />
            
            <div className="text-xs font-semibold text-slate-600 text-center">
              {uploadedFileName ? (
                <span className="text-indigo-600 font-bold block flex items-center justify-center gap-1.5">
                  <FileText size={16} /> {uploadedFileName} (Carregando...)
                </span>
              ) : (
                <span>Arraste seu extrato <strong>PDF, OFX ou CSV</strong> aqui ou <label className="text-indigo-600 underline font-bold cursor-pointer">procure no computador<input type="file" accept=".pdf,.ofx,.csv,.txt" onChange={handleFileSelect} className="hidden" /></label></span>
              )}
            </div>
            
            <span className="text-[10px] text-slate-400">Identifica automaticamente transferências PIX, TED, Salário, Boletos e Cartão</span>
          </div>

          {parseError && (
            <div className="w-full max-w-lg p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" /> {parseError}
            </div>
          )}

          <div className="w-full max-w-lg space-y-2 text-[11px] text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
            <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Formatos e Bancos Suportados</p>
            <p>• <strong>Extrato PDF Banco BV</strong>: extrai datas, lançamentos de débito/crédito, transferências PIX (com código E2E), recebimento de salário, agência e conta corrente.</p>
            <p>• <strong>Extratos PDF outros bancos</strong>: leitura automática de transações, datas e valores.</p>
            <p>• <strong>OFX</strong>: arquivos padrão de internet banking com tags &lt;STMTTRN&gt;.</p>
            <p>• <strong>CSV</strong>: colunas de data, histórico e valor.</p>
          </div>
        </div>
      )}

      {activeSubTab === 'concil' && (
        <div className="space-y-4">
          {pdfMeta && (
            <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                  {pdfMeta.bankCode === '413' ? 'BV' : <Building2 size={20} />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {pdfMeta.bankName || 'Extrato Bancário'} {pdfMeta.bankCode ? `(${pdfMeta.bankCode})` : ''}
                    </span>
                    {pdfMeta.period && (
                      <span className="text-[10px] bg-blue-100/80 text-blue-700 px-2 py-0.5 rounded-md font-bold">
                        Período: {pdfMeta.period}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                    {pdfMeta.holderName && <>Titular: <strong className="text-slate-800">{pdfMeta.holderName}</strong> • </>}
                    {pdfMeta.agency && <>Agência: <strong className="text-slate-800">{pdfMeta.agency}</strong> • </>}
                    {pdfMeta.accountNumber && <>Conta: <strong className="text-slate-800">{pdfMeta.accountNumber}</strong></>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!accounts.some(a => a.name.toLowerCase().includes('bv') || (pdfMeta.accountNumber && a.name.includes(pdfMeta.accountNumber))) && onAddAccount && (
                  <button
                    type="button"
                    onClick={async () => {
                      const newAcc: Account = {
                        id: `acc_bv_${Date.now()}`,
                        name: `Banco BV ${pdfMeta.accountNumber ? `(${pdfMeta.accountNumber})` : ''}`.trim(),
                        type: 'bank',
                        balance: pdfMeta.availableBalance ?? 0,
                        color: 'blue-600',
                      };
                      await onAddAccount(newAcc);
                      setTargetAccountId(newAcc.id);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus size={14} /> Criar Conta Banco BV no App
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm text-xs">
            <div className="flex items-center gap-2">
              {pendingTxs.length > 0 && (
                <label className="flex items-center gap-1.5 mr-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === pendingTxs.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? pendingTxs.map(t => t.id) : [])}
                    className="accent-indigo-600 w-3.5 h-3.5 cursor-pointer"
                    title="Selecionar todas"
                  />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Todas</span>
                </label>
              )}
              <span className="font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                {pendingTxs.length} pendências
              </span>
              <span className="text-slate-400 font-semibold">| Conciliados nesta sessão: {reconciledCount}</span>
              {archivedCount > 0 && (
                <span className="text-slate-400 font-semibold">| Arquivados: {archivedCount}</span>
              )}
              {syncFromDate && (
                <span className="text-slate-500 font-semibold">| A partir de {syncFromDate}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {pendingTxs.length > 0 && (
                <button
                  type="button"
                  onClick={handleConciliateAll}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all cursor-pointer"
                >
                  Aprovar & Conciliar Todas ({pendingTxs.length})
                </button>
              )}
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-indigo-50/70 border border-indigo-100 p-3 rounded-xl text-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                {selectedIds.length} selecionadas
              </span>
              <button
                type="button"
                onClick={handleBatchApprove}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <Check size={12} /> Aprovar ({selectedIds.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  const first = pendingTxs.find(t => t.id === selectedIds[0]);
                  if (first) openEdit(first, true);
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <PenLine size={12} /> Editar ({selectedIds.length})
              </button>
              <button
                type="button"
                onClick={handleBatchIgnore}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-rose-600 border border-rose-200 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <X size={12} /> Ignorar ({selectedIds.length})
              </button>
              <button
                type="button"
                onClick={handleBatchReconcile}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <Link2 size={12} /> Conciliar ({selectedIds.length})
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="ml-auto px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Limpar seleção
              </button>
            </div>
          )}

          <div className="flex flex-col xl:flex-row gap-4">
            <div className="flex-1 min-w-0 space-y-3" id="conciliation-list">
              {pendingTxs.map((tx) => {
                const matched = tx.matched ?? findMatch(tx);
                const isSelected = selectedIds.includes(tx.id);
                return (
                  <div
                    key={tx.id}
                    className={`bg-white p-5 rounded-2xl border transition-all flex flex-col gap-4 ${
                      isSelected
                        ? 'border-indigo-300 ring-1 ring-indigo-100'
                        : tx.accepted ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(tx.id)}
                        className="mt-1 accent-indigo-600 w-4 h-4 cursor-pointer shrink-0"
                        title="Selecionar para ação em lote"
                      />
                      <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            {tx.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openEdit(tx)}
                              title="Clique para editar esta transação"
                              className="text-left text-xs font-bold text-slate-900 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                            >
                              <span className="truncate">{tx.description}</span>
                              <PenLine size={11} className="text-indigo-400 shrink-0" />
                            </button>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {tx.source === 'PLUGGY' && (
                            <span className="px-1.5 py-0.5 rounded bg-violet-50 border border-violet-100 text-[9px] font-bold text-violet-600 uppercase flex items-center gap-1">
                              <Plug size={8} /> Pluggy
                            </span>
                          )}
                          {tx.source === 'PDF' && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[9px] font-bold text-blue-700 uppercase flex items-center gap-1">
                              <FileText size={8} /> PDF {pdfMeta?.bankName ? `• ${pdfMeta.bankName}` : ''}
                            </span>
                          )}
                          {tx.source === 'OFX' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-700 uppercase">
                              OFX
                            </span>
                          )}
                          {tx.source === 'CSV' && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-700 uppercase">
                              CSV
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200/60 text-[9px] font-bold text-slate-500 uppercase">
                            {tx.paymentMethod.replace('_', ' ')}
                          </span>
                          {tx.source === 'PLUGGY' && tx.accountId && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[9px] font-bold text-indigo-600 flex items-center gap-1">
                              <Building2 size={8} />
                              {accounts.find(a => a.id === resolveAppTarget(tx).accountId)?.name || creditCards.find(c => c.id === resolveAppTarget(tx).creditCardId)?.name || (accountMappings[tx.accountId] ? 'Conta mapeada' : 'Conta de Destino')}
                            </span>
                          )}
                          <span className="text-slate-400 text-[10px] font-semibold">{new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                          <span className="text-slate-400 text-[10px] font-semibold">Valor:</span>
                          <span className={`text-xs font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {tx.type === 'income' ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {matched && (
                          <span className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[9px] font-bold">
                            <Link2 size={9} /> Possível duplicata: mesmo valor + data (±3 dias)
                          </span>
                        )}
                        {tx.status === 'RECONCILED' && (
                          <span className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[9px] font-bold">
                            <Check size={9} /> Conciliada
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100 max-w-md w-full justify-between">
                      <div className="space-y-1.5">
                        <span className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={10} /> IA Sugere Categoria
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <select
                            value={tx.suggestedCategory}
                            onChange={(e) => handleEditCategoryChange(tx.id, e.target.value)}
                            className="px-2 py-1 bg-white border border-slate-200 text-xs font-bold rounded-lg focus:outline-none"
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                          <span className="text-[10px] text-emerald-600 font-bold">{tx.confidence}% conf.</span>
                        </div>

                        {tx.source === 'PLUGGY' && tx.accountId && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-wider flex items-center gap-1">
                              <Building2 size={10} /> Conta do app
                            </span>
                            <select
                              value={accountMappings[tx.accountId] || ''}
                              onChange={(e) => handleMapAccount(tx.accountId, e.target.value)}
                              title="Associe a conta/cartão da Pluggy a uma conta cadastrada no sistema"
                              className="px-2 py-1 bg-white border border-slate-200 text-xs font-bold rounded-lg focus:outline-none"
                            >
                              <option value="">Usar Conta de Destino</option>
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                              {creditCards.length > 0 && (
                                <optgroup label="Cartões de crédito">
                                  {creditCards.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} (cartão)</option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                        {!tx.accepted ? (
                          <button
                            type="button"
                            onClick={() => handleAcceptAI(tx.id)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Check size={11} /> Aprovar
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                            <Check size={14} /> Aprovado
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleEditAndApprove(tx.id)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                          title="Aplica a categoria editada e concilia de uma vez"
                        >
                          <Check size={11} /> Editar & Aprovar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleIgnore(tx.id)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                          title="Ignorar esta transação"
                        >
                          <X size={11} /> Ignorar
                        </button>

                        <button
                          type="button"
                          onClick={() => { setReconcileTarget(tx); setReconcileSearch(''); }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                          title="Vincular a uma transação manual existente (evita duplicata)"
                        >
                          <Link2 size={11} /> Conciliar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}

            {pendingTxs.length === 0 && (
              <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200/60 flex flex-col items-center justify-center space-y-2">
                <CheckCircle2 size={36} className="text-emerald-500" />
                <p className="text-xs font-semibold text-slate-500">Tudo limpo! Sua conciliação está 100% em dia.</p>
                <p className="text-[11px] text-slate-400">Importe arquivos OFX ou acesse a aba Pluggy para baixar novas transações bancárias pendentes de aprovação.</p>
              </div>
            )}
          </div>

          {editRow && (
            <div className="w-full xl:w-[380px] shrink-0">
              <RowEditPanel
                row={editRow}
                batch={editBatch}
                batchCount={selectedIds.length}
                categories={categories}
                subcategories={subcategories}
                tags={tags}
                onSave={handleEditSave}
                onCancel={() => { setEditRow(null); setEditBatch(false); }}
              />
            </div>
          )}
        </div>
        </div>
      )}

      {/* Modal de Conciliação com transação manual */}
      {reconcileTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setReconcileTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900">Conciliar transação</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {reconcileTarget.description} — {reconcileTarget.type === 'income' ? '+' : '-'} R$ {reconcileTarget.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em {new Date(reconcileTarget.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button type="button" onClick={() => setReconcileTarget(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={reconcileSearch}
                onChange={(e) => setReconcileSearch(e.target.value)}
                placeholder="Buscar por descrição, categoria ou data..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2" id="reconcile-candidates">
              {reconcileCandidates.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">
                  Nenhuma transação manual compatível encontrada (mesmo valor). Use "Aprovar & Lançar" para criar uma nova.
                </div>
              )}
              {reconcileCandidates.map(t => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => handleConciliate(reconcileTarget, t)}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{t.notes || 'Sem descrição'}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{t.category} • {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de mapeamento de contas (passo pós-conexão) */}
      {mappingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMappingModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
                  <Building2 size={16} className="text-indigo-600" /> Associar contas do banco
                </h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Associe cada conta/cartão que veio da Pluggy à conta correspondente já cadastrada no app. Depois as transações já serão baixadas com a conta certa.
                </p>
              </div>
              <button type="button" onClick={() => setMappingModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {pluggyAccounts.length === 0 && (
              <p className="text-xs text-slate-400 font-medium p-4 bg-slate-50 rounded-xl">
                Nenhuma conta detectada ainda. Clique em "Sincronizar" na aba Pluggy para baixar as transações e depois associe as contas.
              </p>
            )}

            <div className="space-y-3">
              {pluggyAccounts.map(acc => {
                const mapped = accountMappings[acc.pluggyAccountId];
                return (
                  <div key={acc.pluggyAccountId} className={`p-4 rounded-xl border transition-all ${mapped ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{acc.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                          {acc.subtype?.replace('_', ' ') || 'Conta bancária'} (Pluggy)
                        </p>
                      </div>
                      {mapped && (
                        <button
                          type="button"
                          onClick={() => handleUnmapAccount(acc.pluggyAccountId)}
                          title="Remover mapeamento"
                          className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0">Conta no app</span>
                      <select
                        value={mapped || ''}
                        onChange={(e) => handleMapAccount(acc.pluggyAccountId, e.target.value)}
                        className={`flex-1 px-2 py-1.5 bg-white border rounded-lg text-xs font-bold focus:outline-none ${mapped ? 'border-indigo-300' : 'border-slate-200'}`}
                      >
                        <option value="">Usar Conta de Destino</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                        {creditCards.length > 0 && (
                          <optgroup label="Cartões de crédito">
                            {creditCards.map(c => (
                              <option key={c.id} value={c.id}>{c.name} (cartão)</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {pluggyAccounts.length > 0 && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmMapping}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check size={13} /> Salvar associações
                </button>
                <button
                  type="button"
                  onClick={() => setMappingModalOpen(false)}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Pular
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de data inicial para sincronização */}
      {syncDatePromptOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSyncDatePromptOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
                  <RefreshCw size={16} className="text-indigo-600" /> Sincronizar transações
                </h3>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {pendingSync.mode === 'account'
                    ? `Baixar as transações de "${pendingSync.accName}".`
                    : 'Baixar as transações de todas as contas conectadas.'}
                  {' '}Informe a data inicial para limitar o período baixado.
                </p>
              </div>
              <button type="button" onClick={() => setSyncDatePromptOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400" htmlFor="sync-from-date">
                Sincronizar a partir de
              </label>
              <input
                id="sync-from-date"
                type="date"
                value={syncFromDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSyncFromDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <p className="text-[10px] text-slate-400 font-medium">
                Vazio = baixar todo o histórico disponível.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={confirmSyncWithDate}
                disabled={syncing || syncingAccount !== null}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Check size={13} /> Sincronizar
              </button>
              <button
                type="button"
                onClick={() => setSyncDatePromptOpen(false)}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Painel lateral de edição (uma transação ou em lote para as selecionadas)
interface RowEditPanelProps {
  row: ConciliationRow;
  batch: boolean;
  batchCount: number;
  categories: Category[];
  subcategories: Subcategory[];
  tags: Tag[];
  onSave: (changes: Partial<ConciliationRow>) => void;
  onCancel: () => void;
}

const PAYMENT_METHODS = ['PIX', 'CARTAO_CREDITO', 'DEBITO', 'TED_DOC', 'BOLETO', ''];

function RowEditPanel({ row, batch, batchCount, categories, subcategories, tags, onSave, onCancel }: RowEditPanelProps) {
  const [category, setCategory] = useState(row.suggestedCategory);
  const [subcategory, setSubcategory] = useState(row.suggestedSubcategory);
  const [tagIds, setTagIds] = useState<string[]>(row.suggestedTagIds || []);
  const [amount, setAmount] = useState(row.amount);
  const [date, setDate] = useState(row.date);
  const [paymentMethod, setPaymentMethod] = useState(row.paymentMethod);

  const cat = categories.find(c => c.name === category);
  const subs = subcategories.filter(s => s.categoryId === cat?.id);

  const toggleTag = (id: string) => {
    setTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleCategoryChange = (name: string) => {
    setCategory(name);
    const c = categories.find(x => x.name === name);
    setSubcategory(subcategories.find(s => s.categoryId === c?.id)?.name || '');
  };

  const save = () => {
    const c = categories.find(x => x.name === category);
    onSave({
      suggestedCategory: category,
      suggestedCategoryId: c?.id,
      suggestedSubcategory: subcategory,
      suggestedSubcategoryId: subcategory
        ? subcategories.find(s => s.name === subcategory && s.categoryId === c?.id)?.id
        : undefined,
      suggestedTagIds: tagIds,
      ...(batch ? {} : { amount, date, paymentMethod }),
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-4 xl:sticky xl:top-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <PenLine size={13} className="text-indigo-600" />
            {batch ? `Editar ${batchCount} transações` : 'Editar transação'}
          </h3>
          {!batch && (
            <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate" title={row.description}>{row.description}</p>
          )}
          {batch && (
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Aplica categoria, subcategoria e tags a todas as selecionadas.</p>
          )}
        </div>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Categoria</label>
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 text-xs font-bold rounded-lg focus:outline-none"
          >
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Subcategoria</label>
          <select
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 text-xs font-bold rounded-lg focus:outline-none"
          >
            <option value="">Sem subcategoria</option>
            {subs.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>

        {!batch && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 text-xs font-bold rounded-lg focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 text-xs font-bold rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Método de pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 text-xs font-bold rounded-lg focus:outline-none"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m || '—'}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Tags</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {tags.length === 0 && (
              <span className="text-[10px] text-slate-400 font-semibold">Nenhuma tag cadastrada.</span>
            )}
            {tags.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  tagIds.includes(t.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'
                }`}
              >
                #{t.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer"
        >
          <Check size={13} /> {batch ? 'Aplicar a todas' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}