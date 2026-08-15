import { describe, it, expect } from 'vitest';
import { applyRulesToTx, ruleLabel } from './ruleEngine';
import { AutomationRule, Category, Subcategory, Tag, Account } from '../types';

const categories: Category[] = [
  { id: 'cat_food', name: 'Mercado', type: 'expense', icon: 'ShoppingCart', color: 'emerald-500' },
  { id: 'cat_transport', name: 'Transporte', type: 'expense', icon: 'Car', color: 'blue-500' },
  { id: 'cat_alimentacao', name: 'Alimentação', type: 'expense', icon: 'Utensils', color: 'orange-500' },
];

const subcategories: Subcategory[] = [
  { id: 'sub_rest', name: 'Restaurante', categoryId: 'cat_alimentacao' },
];

const tags: Tag[] = [
  { id: 'tag_essencial', name: 'essencial', color: '#10B981' },
];

const accounts: Account[] = [
  { id: 'acc_nubank', name: 'Nubank', type: 'bank', balance: 1000, color: 'purple-500' },
  { id: 'acc_itau', name: 'Itaú', type: 'bank', balance: 2000, color: 'orange-500' },
];

const baseTx = { notes: '', category: '', amount: 100, accountId: 'acc_itau', status: 'REALIZADO' as const };

describe('applyRulesToTx', () => {
  it('retorna objeto vazio sem regras', () => {
    expect(applyRulesToTx(baseTx, [], { categories, tags, accounts })).toEqual({});
  });

  describe('condição text_contains', () => {
    const rule: AutomationRule = { id: 'r1', conditionField: 'text_contains', conditionValue: 'ifood', actionField: 'category', actionValue: 'Alimentação' };

    it('aplica categoria quando a nota contém o texto', () => {
      const changes = applyRulesToTx({ ...baseTx, notes: 'Compra no iFood' }, [rule], { categories, tags, accounts });
      expect(changes.category).toBe('Alimentação');
      expect(changes.categoryId).toBe('cat_alimentacao');
    });

    it('não aplica quando o texto não está presente', () => {
      const changes = applyRulesToTx({ ...baseTx, notes: 'Compra no mercado' }, [rule], { categories, tags, accounts });
      expect(changes).toEqual({});
    });

    it('faz match ignorando maiúsculas/minúsculas', () => {
      const changes = applyRulesToTx({ ...baseTx, notes: 'IFOOD delivery' }, [rule], { categories, tags, accounts });
      expect(changes.categoryId).toBe('cat_alimentacao');
    });
  });

  describe('condição amount_greater', () => {
    const rule: AutomationRule = { id: 'r2', conditionField: 'amount_greater', conditionValue: '500', actionField: 'category', actionValue: 'Transporte' };

    it('aplica quando amount > threshold', () => {
      const changes = applyRulesToTx({ ...baseTx, amount: 700 }, [rule], { categories, tags, accounts });
      expect(changes.categoryId).toBe('cat_transport');
    });

    it('não aplica quando amount <= threshold', () => {
      expect(applyRulesToTx({ ...baseTx, amount: 500 }, [rule], { categories, tags, accounts })).toEqual({});
      expect(applyRulesToTx({ ...baseTx, amount: 100 }, [rule], { categories, tags, accounts })).toEqual({});
    });
  });

  describe('condição source_account', () => {
    const rule: AutomationRule = { id: 'r3', conditionField: 'source_account', conditionValue: 'nubank', actionField: 'category', actionValue: 'Mercado' };

    it('aplica quando a conta de origem corresponde', () => {
      const changes = applyRulesToTx({ ...baseTx, accountId: 'acc_nubank' }, [rule], { categories, tags, accounts });
      expect(changes.categoryId).toBe('cat_food');
    });

    it('não aplica para outra conta', () => {
      expect(applyRulesToTx({ ...baseTx, accountId: 'acc_itau' }, [rule], { categories, tags, accounts })).toEqual({});
    });
  });

  describe('ação subcategory', () => {
    const rule: AutomationRule = { id: 'r4', conditionField: 'text_contains', conditionValue: 'pizza', actionField: 'subcategory', actionValue: 'Restaurante' };

    it('define subcategoria e categoria pai', () => {
      const changes = applyRulesToTx({ ...baseTx, notes: 'pizza' }, [rule], { categories, subcategories, tags, accounts });
      expect(changes.subcategoryId).toBe('sub_rest');
      expect(changes.categoryId).toBe('cat_alimentacao');
      expect(changes.category).toBe('Alimentação');
    });
  });

  describe('ação tag', () => {
    const rule: AutomationRule = { id: 'r5', conditionField: 'text_contains', conditionValue: 'essencial', actionField: 'tag', actionValue: 'essencial' };

    it('usa o id da tag existente', () => {
      const changes = applyRulesToTx({ ...baseTx, notes: 'essencial' }, [rule], { categories, tags, accounts });
      expect(changes.tagIds).toEqual(['tag_essencial']);
    });

    it('cria id provisório para tag inexistente', () => {
      const rule2: AutomationRule = { id: 'r5b', conditionField: 'text_contains', conditionValue: 'lazer', actionField: 'tag', actionValue: 'Lazer & Pets' };
      const changes = applyRulesToTx({ ...baseTx, notes: 'pedido lazer' }, [rule2], { categories, tags, accounts });
      expect(changes.tagIds).toEqual(['tag_new_lazer-&-pets']);
    });
  });

  describe('ação recurrence', () => {
    it('define recorrência mensal', () => {
      const rule: AutomationRule = { id: 'r6', conditionField: 'text_contains', conditionValue: 'mensal', actionField: 'recurrence', actionValue: 'monthly' };
      const changes = applyRulesToTx({ ...baseTx, notes: 'mensal' }, [rule], { categories, tags, accounts });
      expect(changes.recurring).toBe('monthly');
      expect(changes.recurrenceConfig).toEqual({ frequency: 'monthly', endCondition: 'never' });
    });

    it('ignora frequência inválida', () => {
      const rule: AutomationRule = { id: 'r7', conditionField: 'text_contains', conditionValue: 'x', actionField: 'recurrence', actionValue: 'semanal' };
      const changes = applyRulesToTx({ ...baseTx, notes: 'x' }, [rule], { categories, tags, accounts });
      expect(changes.recurring).toBeUndefined();
    });
  });

  describe('ação mark_paid', () => {
    it('marca como REALIZADO', () => {
      const rule: AutomationRule = { id: 'r8', conditionField: 'text_contains', conditionValue: 'pago', actionField: 'mark_paid', actionValue: 'REALIZADO' };
      const changes = applyRulesToTx({ ...baseTx, notes: 'pago' }, [rule], { categories, tags, accounts });
      expect(changes.status).toBe('REALIZADO');
    });
  });

  it('encadeia múltiplas regras aplicáveis', () => {
    const rules: AutomationRule[] = [
      { id: 'r9', conditionField: 'text_contains', conditionValue: 'iFood', actionField: 'category', actionValue: 'Alimentação' },
      { id: 'r10', conditionField: 'text_contains', conditionValue: 'iFood', actionField: 'recurrence', actionValue: 'monthly' },
    ];
    const changes = applyRulesToTx({ ...baseTx, notes: 'iFood' }, rules, { categories, tags, accounts });
    expect(changes.categoryId).toBe('cat_alimentacao');
    expect(changes.recurring).toBe('monthly');
  });
});

describe('ruleLabel', () => {
  it('gera rótulo legível', () => {
    const rule: AutomationRule = { id: 'r1', conditionField: 'text_contains', conditionValue: 'iFood', actionField: 'category', actionValue: 'Alimentação' };
    expect(ruleLabel(rule)).toBe('SE Contém "iFood" → Categoria = "Alimentação"');
  });
});