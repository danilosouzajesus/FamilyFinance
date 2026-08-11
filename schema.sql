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
CREATE TYPE recurrence_type AS ENUM ('none', 'weekly', 'monthly', 'yearly');
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
    subcategories TEXT[] DEFAULT '{}', -- Array nativo do PostgreSQL para armazenar subcategorias
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
    category_name VARCHAR(100) NOT NULL, -- Mantém redundância controlada/compatibilidade
    subcategory VARCHAR(100) DEFAULT '',
    tags TEXT[] DEFAULT '{}', -- Tags em array nativo de texto
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    date DATE NOT NULL,
    recurring recurrence_type NOT NULL DEFAULT 'none',
    notes TEXT DEFAULT '',
    member_id VARCHAR(50) NOT NULL REFERENCES family_members(id) ON DELETE RESTRICT,
    account_id VARCHAR(50) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    attachment_name VARCHAR(255) DEFAULT NULL,
    attachment_url TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

-- ==========================================
-- 3. ÍNDICES DE DESEMPENHO (INDEXES)
-- ==========================================
CREATE INDEX idx_transactions_date ON transactions (date DESC);
CREATE INDEX idx_transactions_account ON transactions (account_id);
CREATE INDEX idx_transactions_member ON transactions (member_id);
CREATE INDEX idx_transactions_category ON transactions (category_id);
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


-- ==========================================
-- 5. SEEDS / DADOS INICIAIS EXTRAS PARA TESTES
-- ==========================================

-- Popula Membros da Família
INSERT INTO family_members (id, name, role, avatar) VALUES
('mem_geral', 'Familiar Geral', 'other', 'indigo-500'),
('mem_pai', 'Pai (Roberto)', 'father', 'blue-600'),
('mem_mae', 'Mãe (Cláudia)', 'mother', 'pink-500'),
('mem_filho', 'Filho (Léo)', 'child', 'amber-500');

-- Popula Categorias Base de Receita
INSERT INTO categories (id, name, type, icon, color, subcategories) VALUES
('cat_salario', 'Salário', 'income', 'Briefcase', 'emerald-500', ARRAY['Salário Principal', 'Bônus', 'Décimo Terceiro']),
('cat_investimentos', 'Rendimentos', 'income', 'TrendingUp', 'teal-500', ARRAY['Dividendos', 'Renda Fixa', 'FIIs']),
('cat_outras_rec', 'Outras Receitas', 'income', 'PlusCircle', 'cyan-500', ARRAY['Reembolsos', 'Vendas', 'Outros']);

-- Popula Categorias Base de Despesa
INSERT INTO categories (id, name, type, icon, color, subcategories) VALUES
('cat_moradia', 'Moradia', 'expense', 'Home', 'indigo-500', ARRAY['Aluguel', 'Condomínio', 'Energia', 'Água', 'Internet']),
('cat_alimentacao', 'Alimentação', 'expense', 'Utensils', 'orange-500', ARRAY['Supermercado', 'Restaurantes', 'Delivery']),
('cat_transporte', 'Transporte', 'expense', 'Car', 'blue-500', ARRAY['Combustível', 'Uber/99', 'Manutenção', 'Estacionamento']),
('cat_saude', 'Saúde', 'expense', 'HeartPulse', 'rose-500', ARRAY['Plano de Saúde', 'Farmácia', 'Consultas']),
('cat_educacao', 'Educação', 'expense', 'GraduationCap', 'violet-500', ARRAY['Escola/Faculdade', 'Cursos', 'Livros']),
('cat_lazer', 'Lazer & Viagem', 'expense', 'Palmtree', 'amber-500', ARRAY['Cinema/Shows', 'Viagens', 'Hospedagem', 'Streaming']);

-- Popula Contas Bancárias
INSERT INTO accounts (id, name, type, balance, color) VALUES
('acc_itau', 'Itaú Unibanco', 'bank', 3450.25, 'orange-500'),
('acc_nubank', 'Nubank Carteira', 'bank', 12500.00, 'purple-600'),
('acc_carteira', 'Dinheiro Físico', 'cash', 250.00, 'emerald-600'),
('acc_visa_credit', 'Cartão Visa Infinite', 'credit', -1840.50, 'indigo-600');

-- Popula Assinaturas
INSERT INTO subscriptions (id, name, amount, frequency, category, billing_date, auto_notify, member_id) VALUES
('sub_1', 'Netflix Premium', 55.90, 'monthly', 'Lazer & Viagem', '22', TRUE, 'mem_geral'),
('sub_2', 'Spotify Familiar', 34.90, 'monthly', 'Lazer & Viagem', '05', TRUE, 'mem_geral'),
('sub_3', 'Academia BlueFit', 129.90, 'monthly', 'Saúde', '10', FALSE, 'mem_pai');

-- Popula Dívidas
INSERT INTO debts (id, name, total_amount, installments_count, installment_amount, interest_rate, next_due_date, category, paid_installments) VALUES
('debt_1', 'Financiamento Automóvel', 48000.00, 48, 1250.00, 1.80, '2026-08-20', 'Transporte', 12),
('debt_2', 'Parcelamento Geladeira', 3200.00, 10, 320.00, 0.00, '2026-08-15', 'Moradia', 4);

-- Popula Investimentos
INSERT INTO investments (id, type, name, initial_amount, current_amount, start_date, simple_yield, contributions_count) VALUES
('inv_1', 'Renda Fixa', 'Tesouro Selic 2029', 10000.00, 11450.00, '2025-01-10', 11.25, 4),
('inv_2', 'Ações', 'Carteira de Dividendos (B3)', 15000.00, 16800.00, '2025-03-15', 12.00, 6),
('inv_3', 'Criptoativos', 'Bitcoin (BTC)', 2000.00, 3100.00, '2025-06-20', 55.00, 2);

-- Popula Regras de Automação
INSERT INTO automation_rules (id, condition_field, condition_value, action_field, action_value) VALUES
('rule_1', 'text_contains', 'Uber', 'category', 'Transporte'),
('rule_2', 'text_contains', 'Supermercado', 'category', 'Alimentação'),
('rule_3', 'amount_greater', '1000', 'tag', 'Investimento-Alto');
