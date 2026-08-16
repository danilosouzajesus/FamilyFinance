import type { AutomationRule, Account } from '../domain/entities';
import type { Category, Subcategory, Tag } from '../domain/category';
import type { Transaction, RecurrenceType } from '../domain/transaction';

export interface RuleContext {
  categories: Category[];
  subcategories?: Subcategory[];
  tags: Tag[];
  accounts: Account[];
}

// 2.3 IFTTT-style engine: applied to imported/extrato transactions before display
export function applyRulesToTx(
  tx: Pick<Transaction, 'notes' | 'category' | 'amount' | 'accountId' | 'status'>,
  rules: AutomationRule[],
  ctx: RuleContext
): Partial<Transaction> {
  const changes: Partial<Transaction> = {};

  rules.forEach(rule => {
    if (!matchesRule(tx, rule, ctx.accounts)) return;

    switch (rule.actionField) {
      case 'category': {
        const cat = ctx.categories.find(c => c.name.toLowerCase() === rule.actionValue.trim().toLowerCase());
        changes.category = cat?.name || rule.actionValue;
        if (cat) changes.categoryId = cat.id;
        break;
      }
      case 'subcategory': {
        const sub = ctx.subcategories?.find(s => s.name.toLowerCase() === rule.actionValue.trim().toLowerCase());
        changes.subcategory = sub?.name || rule.actionValue;
        if (sub) {
          changes.subcategoryId = sub.id;
          const parent = ctx.categories.find(c => c.id === sub.categoryId);
          if (parent) {
            changes.categoryId = parent.id;
            changes.category = parent.name;
          }
        }
        break;
      }
      case 'tag': {
        const existing = ctx.tags.find(t => t.name.toLowerCase() === rule.actionValue.trim().toLowerCase());
        const tagId = existing?.id || `tag_new_${rule.actionValue.trim().toLowerCase().replace(/\s+/g, '-')}`;
        changes.tagIds = [...(changes.tagIds || []), tagId];
        break;
      }
      case 'recurrence': {
        const freq = rule.actionValue.trim().toLowerCase();
        if (freq === 'weekly' || freq === 'monthly' || freq === 'yearly') {
          changes.recurring = freq as RecurrenceType;
          changes.recurrenceConfig = { frequency: freq as RecurrenceType, endCondition: 'never' };
        }
        break;
      }
      case 'mark_paid': {
        if (rule.actionValue === 'REALIZADO' || rule.actionValue === 'PENDENTE') {
          changes.status = rule.actionValue;
        }
        break;
      }
    }
  });

  return changes;
}

function matchesRule(
  tx: Pick<Transaction, 'notes' | 'category' | 'amount' | 'accountId'>,
  rule: AutomationRule,
  accounts: Account[]
): boolean {
  const haystack = `${tx.notes || ''} ${tx.category || ''}`.toLowerCase();
  const needle = rule.conditionValue.trim().toLowerCase();

  switch (rule.conditionField) {
    case 'text_contains':
      return needle.length > 0 && haystack.includes(needle);
    case 'amount_greater': {
      const threshold = parseFloat(rule.conditionValue);
      return !isNaN(threshold) && tx.amount > threshold;
    }
    case 'source_account': {
      const account = accounts.find(a => a.id === tx.accountId);
      return needle.length > 0 && (account?.name || '').toLowerCase().includes(needle);
    }
    default:
      return false;
  }
}

export const ruleLabel = (rule: AutomationRule): string => {
  const condMap: Record<string, string> = {
    text_contains: 'Contém',
    amount_greater: 'Valor >',
    source_account: 'Conta',
  };
  const actMap: Record<string, string> = {
    category: 'Categoria',
    subcategory: 'Subcategoria',
    tag: 'Tag',
    recurrence: 'Recorrência',
    mark_paid: 'Marcar pago',
  };
  return `SE ${condMap[rule.conditionField] || rule.conditionField} "${rule.conditionValue}" → ${actMap[rule.actionField] || rule.actionField} = "${rule.actionValue}"`;
};