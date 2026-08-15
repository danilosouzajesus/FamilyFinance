export const SUPABASE_SETUP_SQL = `-- ================================================================
-- SCRIPT COMPLETO DE CRIAÇÃO DO BANCO DE DADOS (SUPABASE)
-- Copie todo este conteúdo e execute no "SQL Editor" do Supabase.
-- Os dados são criados pela própria aplicação e persistidos no banco.
-- ================================================================

-- 1. CRIAÇÃO DAS TABELAS COM TIPOS E CHAVES
CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar TEXT,
  access_role TEXT DEFAULT 'member',
  notify_channels TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT,
  color TEXT,
  parent_id TEXT DEFAULT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366F1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cartões de Crédito (modelo de faturas)
CREATE TABLE IF NOT EXISTS credit_cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  limit_amount NUMERIC NOT NULL DEFAULT 0,
  closing_day INT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  account_id TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faturas (invoices) geradas dinamicamente por ciclo de cartão
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  credit_card_id TEXT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  closing_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'PAID', 'OVERDUE')),
  paid_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (credit_card_id, month, year)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'invoice_payment')),
  category_id TEXT,
  category_name TEXT NOT NULL,
  subcategory_id TEXT DEFAULT NULL,
  subcategory TEXT DEFAULT '',
  tag_ids TEXT[] DEFAULT '{}',
  amount NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recurring TEXT DEFAULT 'none',
  recurrence_config JSONB DEFAULT NULL,
  recurrence_group_id TEXT DEFAULT NULL,
  notes TEXT,
  member_id TEXT,
  account_id TEXT,
  attachment_urls TEXT[] DEFAULT '{}',
  attachment_names TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'REALIZADO',
  origin TEXT DEFAULT 'MANUAL',
  pluggy_transaction_id TEXT DEFAULT NULL,
  pluggy_item_id TEXT DEFAULT NULL,
  payment_method TEXT DEFAULT NULL,
  is_reconciled BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  credit_card_id TEXT REFERENCES credit_cards(id),
  invoice_id TEXT REFERENCES invoices(id),
  installment_number INT DEFAULT 1,
  total_installments INT DEFAULT 1,
  include_in_balance_sum BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  limit_amount NUMERIC NOT NULL,
  month TEXT NOT NULL,
  notify_at_percent INT DEFAULT 80,
  rollover BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monthly_goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  month TEXT NOT NULL,
  limit_amount NUMERIC NOT NULL,
  category_ids TEXT[] DEFAULT '{}',
  notify_at_percent INT DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC NOT NULL DEFAULT 0,
  deadline DATE NOT NULL,
  color TEXT,
  category TEXT,
  account_id TEXT DEFAULT NULL,
  monthly_contribution NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extrato de aportes/resgates por meta (ledger por membro da família)
CREATE TABLE IF NOT EXISTS goal_contributions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  frequency TEXT NOT NULL,
  category TEXT NOT NULL,
  billing_date INT NOT NULL,
  auto_notify BOOLEAN DEFAULT TRUE,
  member_id TEXT DEFAULT 'mem_geral',
  payment_method TEXT DEFAULT 'credit_card',
  notify_channel TEXT DEFAULT 'push',
  notify_days INT DEFAULT 3,
  account_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  creditor TEXT,
  total_amount NUMERIC NOT NULL,
  installments_count INT NOT NULL DEFAULT 1,
  installment_amount NUMERIC NOT NULL,
  interest_rate NUMERIC DEFAULT 0,
  next_due_date DATE,
  category TEXT,
  paid_installments INT DEFAULT 0,
  account_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  initial_amount NUMERIC NOT NULL,
  current_amount NUMERIC NOT NULL,
  start_date DATE NOT NULL,
  simple_yield NUMERIC DEFAULT 0,
  contributions_count INT DEFAULT 1,
  withdrawals_count INT DEFAULT 0,
  account_id TEXT DEFAULT NULL,
  origin TEXT DEFAULT NULL,
  pluggy_investment_id TEXT DEFAULT NULL,
  pluggy_item_id TEXT DEFAULT NULL,
  is_reconciled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  condition_field TEXT NOT NULL,
  condition_value TEXT NOT NULL,
  action_field TEXT NOT NULL,
  action_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pluggy_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL UNIQUE,
  connector_name TEXT NOT NULL,
  connector_logo_url TEXT,
  status TEXT DEFAULT 'CONNECTED',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT DEFAULT NULL,
  raw_description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  payment_method TEXT DEFAULT NULL,
  pluggy_transaction_id TEXT NOT NULL UNIQUE,
  pluggy_item_id TEXT DEFAULT NULL,
  suggested_category_id TEXT DEFAULT NULL,
  suggested_category TEXT NOT NULL,
  suggested_subcategory_id TEXT DEFAULT NULL,
  suggested_subcategory TEXT DEFAULT '',
  suggested_tag_ids TEXT[] DEFAULT '{}',
  ai_confidence NUMERIC DEFAULT 0,
  suggested_reconcile_transaction_id TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'RECONCILED', 'IGNORED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mapeamento manual: conta/cartão da Pluggy → conta do app
CREATE TABLE IF NOT EXISTS pluggy_account_mappings (
  user_id TEXT NOT NULL,
  pluggy_account_id TEXT NOT NULL,
  app_account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, pluggy_account_id)
);

-- Preferências de visualização da família (ex: período padrão do Controle de Transações)
CREATE TABLE IF NOT EXISTS app_preferences (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DESATIVAR ROW LEVEL SECURITY (RLS) PARA LEITURA/ESCRITA LIVRE PELO APP
ALTER TABLE family_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE debts DISABLE ROW LEVEL SECURITY;
ALTER TABLE investments DISABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE pluggy_connections DISABLE ROW LEVEL SECURITY;
ALTER TABLE pending_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE pluggy_account_mappings DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
`;