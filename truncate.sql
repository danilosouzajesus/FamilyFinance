-- =============================================================================
-- SCRIPT DE LIMPEZA GERAL (TRUNCATE) DE TODAS AS TABELAS
-- ATENÇÃO: Remove todos os registros preservando a estrutura das tabelas.
-- CASCADE garante a limpeza correta respeitando foreign keys.
-- =============================================================================

TRUNCATE TABLE 
    goal_contributions,
    goals,
    monthly_goals,
    budgets,
    transaction_tags,
    audit_logs,
    pending_transactions,
    pluggy_account_mappings,
    pluggy_connections,
    transactions,
    invoices,
    credit_cards,
    subscriptions,
    debts,
    investments,
    automation_rules,
    tags,
    categories,
    accounts,
    family_members,
    bank_integration_configs,
    app_preferences
CASCADE;

-- Confirmação de execução
SELECT 'Todas as tabelas foram truncadas com sucesso!' AS status;
