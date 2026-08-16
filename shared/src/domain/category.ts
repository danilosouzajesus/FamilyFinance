export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'invoice_payment';
  icon: string;
  color: string;
  parentId?: string; // null = categoria pai, GUID = subcategoria
  subcategories?: string[]; // deprecated: kept for backward compat, use separate Subcategory entity
  isShared?: boolean; // categoria compartilhada entre os membros da família (consolida gastos)
}

export interface Subcategory {
  id: string;
  name: string;
  categoryId: string; // parent category GUID
  icon?: string;
  color?: string;
}

export interface Tag {
  id: string;
  name: string; // sanitizada, única por família
  color: string; // Hex
}