// Barrel público do pacote @ff/shared — tipos de domínio, integrações e engines.
// Tudo que é compartilhado entre client e server deve ser exportado daqui.

// Domínio
export * from './domain/transaction';
export * from './domain/invoice';
export * from './domain/category';
export * from './domain/entities';
export * from './domain/period';
export * from './domain/financial-state';

// Integrações
export * from './integration/pluggy-types';
export * from './integration/pluggy';

// Engines (regras de negócio puras)
export * from './engines/invoiceEngine';
export * from './engines/ruleEngine';
export * from './engines/pluggyEngine';

// Utilitários puros
export * from './utils/format';

// Fixtures de teste compartilhados
export * from './test/fixtures';