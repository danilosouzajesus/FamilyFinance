import type { Account, AutomationRule } from '../domain/entities';
import type { Category, Subcategory, Tag } from '../domain/category';
import type { Transaction, TransactionType } from '../domain/transaction';
import type { PluggyPendingTx } from '../integration/pluggy-types';
import { applyRulesToTx, RuleContext } from './ruleEngine';
import { RawPluggyTx, rawToPendingFields, findReconciliationMatch } from '../integration/pluggy';

export interface PluggyEngineContext {
  categories: Category[];
  subcategories?: Subcategory[];
  tags?: Tag[];
  accounts?: Account[];
  transactions?: Transaction[];
  automationRules?: AutomationRule[];
}

interface KeywordRule {
  keywords: string[];
  category: string;
  confidence: number;
}

// Mapa genérico de classificação (pt-BR). A IA real fica no backend; aqui uma heurística
// rápida que funciona offline e é aprimorada pelas regras de automação (IFTTT) do usuário.
const KEYWORD_RULES: KeywordRule[] = [
  { keywords: ['supermercado', 'mercado', 'padaria', 'acougue', 'açougue', 'hortifruti', 'carrefour', 'pao de acucar', 'assai', 'extra', 'pão de açúcar'], category: 'Mercado', confidence: 92 },
  { keywords: ['ifood', 'i food', 'uber eats', 'restaurante', 'lanchonete', 'mc donalds', 'habib', 'pizza', 'hamburgueria', 'sushi'], category: 'Restaurantes & Delivery', confidence: 90 },
  { keywords: ['uber', '99 taxi', '99pop', 'combust', 'posto', 'gasolina', 'etanol', 'pedagio', 'pedágio', 'estacionamento', 'app garage'], category: 'Transporte', confidence: 88 },
  { keywords: ['energisa', 'enel', 'cpfl', 'luz', 'agua', 'água', 'sabesp', 'comgas', 'gas', 'gás', 'internet', 'vivo', 'claro', 'tim', 'telefone', 'iptu', 'ipva', 'condominio', 'condomínio', 'aluguel'], category: 'Moradia & Contas', confidence: 90 },
  { keywords: ['drogasil', 'drogaria', 'farmacia', 'farmácia', 'consultorio', 'consultório', 'medico', 'médico', 'hospital', 'clinica', 'clínica', 'dentista', 'laboratorio', 'laboratório'], category: 'Saúde', confidence: 92 },
  { keywords: ['escola', 'faculdade', 'curso', 'udemy', 'cursinho', 'material escolar', 'creche'], category: 'Educação', confidence: 90 },
  { keywords: ['netflix', 'spotify', 'prime video', 'disney', 'hbo', 'youtube', 'steam', 'amazon', 'assinatura', 'mensalidade'], category: 'Assinaturas & Streamings', confidence: 90 },
  { keywords: ['cinema', 'show', 'teatro', 'game', 'jogos', 'parque', 'passeio', 'viagem', 'hotel', 'airbnb', 'cultura'], category: 'Lazer & Cultura', confidence: 85 },
  { keywords: ['roupa', 'calçado', 'calçados', 'sapato', 'loja', 'renner', 'c&a', 'cea', 'hering', 'zara', 'magazine', 'casas bahia', 'vestuario', 'vestuário'], category: 'Vestuário', confidence: 85 },
  { keywords: ['salario', 'salário', 'holerite', 'pagamento', 'remuneração', 'admissao', 'admissão', 'ferias', 'férias', 'decimo', 'décimo', 'bonus', 'bônus'], category: 'Salário & Benefícios', confidence: 92 },
  { keywords: ['transferencia', 'transferência', 'entre contas', 'transf entre contas', 'transf enviada', 'transf recebida', 'pix enviado', 'pix recebido', 'ted enviada', 'ted recebida'], category: 'Transferências', confidence: 88 },
  { keywords: ['reembolso', 'dividendo', 'juros', 'investimento', 'resgate'], category: 'Outras Receitas', confidence: 75 },
];

const FALLBACK_EXPENSE = 'Outras Despesas';
const FALLBACK_INCOME = 'Outras Receitas';

// Classificação heurística: descrição + tipo → categoria sugerida com confiança
export function categorizeTransaction(
  description: string,
  type: TransactionType,
  categories: Category[]
): { categoryId?: string; categoryName: string; confidence: number } {
  const d = (description || '').toLowerCase();
  let best: KeywordRule | null = null;

  for (const rule of KEYWORD_RULES) {
    const found = rule.keywords.some(k => d.includes(k.toLowerCase()));
    if (found && (!best || rule.confidence > best.confidence)) {
      best = rule;
    }
  }

  const fallbackName = type === 'income' ? FALLBACK_INCOME : FALLBACK_EXPENSE;
  const categoryName = best?.category || fallbackName;
  const confidence = best?.confidence ?? (type === 'income' ? 70 : 55);

  const cat = categories.find(
    c => c.name.toLowerCase() === categoryName.toLowerCase() && (!type || c.type === type || c.name === FALLBACK_EXPENSE || c.name === FALLBACK_INCOME)
  );

  return {
    categoryId: cat?.id,
    categoryName: cat?.name || categoryName,
    confidence,
  };
}

function firstSubcategoryFor(categoryId: string | undefined, subcategories: Subcategory[] | undefined): { subcategoryId?: string; subcategory: string } {
  if (!categoryId || !subcategories) return { subcategory: '' };
  const sub = subcategories.find(s => s.categoryId === categoryId);
  return sub ? { subcategoryId: sub.id, subcategory: sub.name } : { subcategory: '' };
}

// Pipeline de ingestão: a partir de uma transação bruta da Pluggy, gera a pendência classificada
export function processIncomingPluggyTx(
  raw: RawPluggyTx,
  ctx: PluggyEngineContext
): Omit<PluggyPendingTx, 'userId'> {
  const fields = rawToPendingFields(raw);
  const { categoryId, categoryName, confidence } = categorizeTransaction(fields.rawDescription, fields.type, ctx.categories);
  const { subcategoryId, subcategory } = firstSubcategoryFor(categoryId, ctx.subcategories);

  const now = new Date().toISOString();
  const suggestedReconcileTransactionId = findReconciliationMatch(ctx.transactions || [], {
    amount: fields.amount,
    date: fields.date,
    type: fields.type,
  });

  return {
    ...fields,
    suggestedCategoryId: categoryId,
    suggestedCategory: categoryName,
    suggestedSubcategoryId: subcategoryId,
    suggestedSubcategory: subcategory,
    suggestedTagIds: [],
    aiConfidence: confidence,
    suggestedReconcileTransactionId,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };
}

// Refina a pendência usando o contexto atual do usuário (categorias + regras IFTTT + match)
export function applySuggestionLive(
  pending: Pick<PluggyPendingTx, 'rawDescription' | 'type' | 'amount' | 'date' | 'suggestedCategory' | 'suggestedTagIds' | 'aiConfidence'>,
  ctx: PluggyEngineContext
): Pick<PluggyPendingTx, 'suggestedCategoryId' | 'suggestedCategory' | 'suggestedSubcategoryId' | 'suggestedSubcategory' | 'suggestedTagIds' | 'aiConfidence' | 'suggestedReconcileTransactionId'> {
  const base = categorizeTransaction(pending.rawDescription, pending.type, ctx.categories);

  // Regras de automação (IFTTT) podem sobrescrever a heurística
  const ruleChanges = applyRulesToTx(
    { notes: pending.rawDescription, category: base.categoryName, amount: pending.amount, accountId: '', status: 'REALIZADO' },
    ctx.automationRules || [],
    { categories: ctx.categories, subcategories: ctx.subcategories, tags: ctx.tags || [], accounts: ctx.accounts || [] } as RuleContext
  );

  const finalCategoryName = ruleChanges.category || base.categoryName;
  const finalCat = ctx.categories.find(c => c.name.toLowerCase() === finalCategoryName.toLowerCase());
  const { subcategoryId, subcategory } = ruleChanges.subcategory
    ? { subcategoryId: ruleChanges.subcategoryId, subcategory: ruleChanges.subcategory }
    : firstSubcategoryFor(finalCat?.id, ctx.subcategories);

  const tagIds = [...new Set([...(pending.suggestedTagIds || []), ...(ruleChanges.tagIds || [])])];

  const suggestedReconcileTransactionId = findReconciliationMatch(ctx.transactions || [], {
    amount: pending.amount,
    date: pending.date,
    type: pending.type,
  });

  return {
    suggestedCategoryId: ruleChanges.categoryId || finalCat?.id || base.categoryId,
    suggestedCategory: finalCategoryName,
    suggestedSubcategoryId: subcategoryId,
    suggestedSubcategory: subcategory,
    suggestedTagIds: tagIds,
    aiConfidence: ruleChanges.category ? 96 : base.confidence,
    suggestedReconcileTransactionId,
  };
}

// Monta a transação final ao aprovar (usa as sugestões, podendo receber overrides do usuário)
export function buildApprovedTransaction(
  pending: Pick<PluggyPendingTx, 'rawDescription' | 'amount' | 'date' | 'type' | 'suggestedCategoryId' | 'suggestedCategory' | 'suggestedSubcategoryId' | 'suggestedSubcategory' | 'suggestedTagIds' | 'aiConfidence' | 'pluggyTransactionId' | 'pluggyItemId' | 'paymentMethod'>,
  ctx: PluggyEngineContext,
  overrides?: Partial<Pick<Transaction, 'categoryId' | 'category' | 'subcategoryId' | 'subcategory' | 'tagIds' | 'amount' | 'date' | 'notes' | 'accountId' | 'memberId' | 'creditCardId' | 'invoiceId' | 'includeInBalanceSum'>>
): Transaction {
  const categoryName = overrides?.category || pending.suggestedCategory;
  const cat = ctx.categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());

  return {
    id: `tx_pluggy_${Date.now()}`,
    type: pending.type,
    categoryId: overrides?.categoryId || cat?.id || pending.suggestedCategoryId || '',
    category: categoryName,
    subcategoryId: overrides?.subcategoryId || pending.suggestedSubcategoryId,
    subcategory: overrides?.subcategory || pending.suggestedSubcategory || '',
    tagIds: overrides?.tagIds || pending.suggestedTagIds || [],
    amount: overrides?.amount ?? pending.amount,
    date: overrides?.date || pending.date,
    recurring: 'none',
    notes: overrides?.notes || pending.rawDescription,
    memberId: overrides?.memberId || 'mem_geral',
    accountId: overrides?.accountId || ctx.accounts?.[0]?.id || 'acc_itau',
    creditCardId: overrides?.creditCardId,
    invoiceId: overrides?.invoiceId,
    includeInBalanceSum: overrides?.includeInBalanceSum,
    attachmentUrls: [],
    attachmentNames: [],
    status: 'REALIZADO',
    origin: 'PLUGGY',
    pluggyTransactionId: pending.pluggyTransactionId,
    isReconciled: true,
    paymentMethod: pending.paymentMethod as any,
  };
}