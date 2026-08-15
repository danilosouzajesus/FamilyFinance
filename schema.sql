-- =============================================================================
-- SCRIPT DE CRIAÇÃO DAS TABELAS DO SISTEMA DE CONTROLE FINANCEIRO FAMILIAR
-- SGBD Recomendado: PostgreSQL (12 ou superior)
-- Data: 2026-08-11
-- =============================================================================

-- Habilita suporte a UUID caso prefira IDs gerados automaticamente pelo banco
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TIPOS ENUMERADOS (ENUMS)
-- ==========================================
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE recurrence_type AS ENUM ('none', 'daily', 'weekly', 'monthly', 'yearly', 'custom');
CREATE TYPE recurrence_end_type AS ENUM ('never', 'after_n', 'date_limit');
CREATE TYPE transaction_status AS ENUM ('PENDENTE', 'REALIZADO', 'EDITADO_MANUALMENTE');
CREATE TYPE account_type AS ENUM ('cash', 'bank', 'credit');
CREATE TYPE family_role AS ENUM ('father', 'mother', 'child', 'other');
CREATE TYPE subscription_frequency AS ENUM ('weekly', 'monthly', 'yearly');
CREATE TYPE condition_field_type AS ENUM ('text_contains', 'amount_greater', 'source_account');
CREATE TYPE action_field_type AS ENUM ('category', 'tag', 'recurrence');

-- ==========================================
-- 2. TABELAS DO SISTEMA
-- ==========================================

-- Tabela de Membros da Família
CREATE TABLE family_members (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role family_role NOT NULL DEFAULT 'other',
    avatar VARCHAR(100) NOT NULL,
    access_role VARCHAR(10) NOT NULL DEFAULT 'member',
    notify_channels TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Categorias
CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    type transaction_type NOT NULL,
    icon VARCHAR(100) NOT NULL DEFAULT 'Tag',
    color VARCHAR(50) NOT NULL DEFAULT 'gray-500',
    parent_id VARCHAR(50) DEFAULT NULL REFERENCES categories(id) ON DELETE SET NULL, -- NULL = categoria pai, preenchido = subcategoria
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Contas Bancárias / Carteiras
CREATE TABLE accounts (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type account_type NOT NULL DEFAULT 'bank',
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    color VARCHAR(50) NOT NULL DEFAULT 'blue-500',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Transações
CREATE TABLE transactions (
    id VARCHAR(50) PRIMARY KEY,
    type transaction_type NOT NULL,
    category_id VARCHAR(50) REFERENCES categories(id) ON DELETE SET NULL,
    category_name VARCHAR(100) NOT NULL,
    subcategory_id VARCHAR(50) DEFAULT NULL REFERENCES categories(id) ON DELETE SET NULL,
    subcategory VARCHAR(100) DEFAULT '',
    tag_ids TEXT[] DEFAULT '{}', -- Array de GUIDs das tags (referência a tags.id)
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    recurring recurrence_type NOT NULL DEFAULT 'none',
    recurrence_config JSONB DEFAULT NULL,
    recurrence_group_id VARCHAR(50) DEFAULT NULL,
    notes TEXT DEFAULT '',
    member_id VARCHAR(50) NOT NULL REFERENCES family_members(id) ON DELETE RESTRICT,
    account_id VARCHAR(50) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    attachment_urls TEXT[] DEFAULT '{}',
    attachment_names TEXT[] DEFAULT '{}',
    status transaction_status NOT NULL DEFAULT 'REALIZADO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Tabela de Planejamento de Orçamentos (Budgets)
CREATE TABLE budgets (
    id VARCHAR(50) PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    limit_amount NUMERIC(15, 2) NOT NULL CHECK (limit_amount >= 0),
    month VARCHAR(7) NOT NULL, -- Formato: 'YYYY-MM'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_category_month UNIQUE (category_id, month)
);

-- Tabela de Metas Financeiras (Goals)
CREATE TABLE goals (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL CHECK (target_amount >= 0),
    current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
    deadline DATE NOT NULL,
    color VARCHAR(50) NOT NULL DEFAULT 'emerald-500',
    category VARCHAR(100),
    account_id VARCHAR(50), -- conta onde o valor reservado fica (cash | bank | investment)
    monthly_contribution NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Assinaturas e Serviços Recorrentes
CREATE TABLE subscriptions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    frequency subscription_frequency NOT NULL DEFAULT 'monthly',
    category VARCHAR(100) NOT NULL, -- Pode se referenciar livremente ou estar associada à tabela
    billing_date VARCHAR(10) NOT NULL, -- Pode ser apenas o dia (ex: '22') ou data inteira
    auto_notify BOOLEAN NOT NULL DEFAULT TRUE,
    member_id VARCHAR(50) REFERENCES family_members(id) ON DELETE SET NULL,
    account_id VARCHAR(50), -- conta de débito das mensalidades (extrato geral)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Dívidas / Parcelamentos (Debts)
CREATE TABLE debts (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount >= 0),
    installments_count INT NOT NULL CHECK (installments_count > 0),
    installment_amount NUMERIC(15, 2) NOT NULL CHECK (installment_amount >= 0),
    interest_rate NUMERIC(5, 2) DEFAULT 0.00 CHECK (interest_rate >= 0), -- Taxa percentual, ex: 1.8%
    next_due_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    paid_installments INT NOT NULL DEFAULT 0 CHECK (paid_installments <= installments_count),
    account_id VARCHAR(50), -- conta de onde as parcelas são debitadas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Investimentos (Investments)
CREATE TABLE investments (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(100) NOT NULL, -- ex: 'Renda Fixa', 'Ações', 'Criptoativos'
    name VARCHAR(150) NOT NULL,
    initial_amount NUMERIC(15, 2) NOT NULL CHECK (initial_amount >= 0),
    current_amount NUMERIC(15, 2) NOT NULL CHECK (current_amount >= 0),
    start_date DATE NOT NULL,
    simple_yield NUMERIC(6, 2) NOT NULL DEFAULT 0.00, -- ex: 11.25%
    contributions_count INT NOT NULL DEFAULT 1 CHECK (contributions_count >= 0),
    withdrawals_count INT NOT NULL DEFAULT 0,
    account_id VARCHAR(50), -- vincula o ativo a uma conta de investimento
    origin VARCHAR(20), -- MANUAL | PLUGGY | OFX
    pluggy_investment_id VARCHAR(100),
    pluggy_item_id VARCHAR(100),
    is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Regras de Automação / Conciliação Bancária
CREATE TABLE automation_rules (
    id VARCHAR(50) PRIMARY KEY,
    condition_field condition_field_type NOT NULL,
    condition_value VARCHAR(255) NOT NULL,
    action_field action_field_type NOT NULL,
    action_value VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Configurações de Integração de Bancos (Pluggy / Outros)
CREATE TABLE bank_integration_configs (
    id SERIAL PRIMARY KEY,
    pluggy_connected BOOLEAN NOT NULL DEFAULT FALSE,
    last_sync_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    bank_name VARCHAR(100) DEFAULT NULL,
    pending_transactions_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Tags Personalizadas (N-para-N com transações via tabela de junção)
CREATE TABLE tags (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(50) NOT NULL DEFAULT '#6366F1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Junção Transação-Tag (Many-to-Many)
CREATE TABLE transaction_tags (
    transaction_id VARCHAR(50) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id VARCHAR(50) NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, tag_id)
);

-- Tabela de Log de Auditoria (para rastrear edições manuais de transações conciliadas)
CREATE TABLE audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    transaction_id VARCHAR(50) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    field_changed VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by VARCHAR(50) REFERENCES family_members(id) ON DELETE SET NULL,
    change_reason VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_transaction ON audit_logs (transaction_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_categories_parent ON categories (parent_id);
CREATE INDEX idx_transaction_tags_tag ON transaction_tags (tag_id);

-- ==========================================
-- 3. ÍNDICES DE DESEMPENHO (INDEXES)
-- ==========================================
CREATE INDEX idx_transactions_date ON transactions (date DESC);
CREATE INDEX idx_transactions_account ON transactions (account_id);
CREATE INDEX idx_transactions_member ON transactions (member_id);
CREATE INDEX idx_transactions_category ON transactions (category_id);
CREATE INDEX idx_transactions_recurrence_group ON transactions (recurrence_group_id);
CREATE INDEX idx_transactions_status ON transactions (status);
CREATE INDEX idx_transactions_deleted_at ON transactions (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_budgets_category_month ON budgets (category_id, month);
CREATE INDEX idx_subscriptions_member ON subscriptions (member_id);


-- ==========================================
-- 4. TRIGGER PARA ATUALIZAR O UPDATED_AT AUTOMATICAMENTE
-- ==========================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_family_members_timestamp BEFORE UPDATE ON family_members FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_categories_timestamp BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_accounts_timestamp BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_transactions_timestamp BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_budgets_timestamp BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_goals_timestamp BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_subscriptions_timestamp BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_debts_timestamp BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_investments_timestamp BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_automation_rules_timestamp BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION update_timestamp();
