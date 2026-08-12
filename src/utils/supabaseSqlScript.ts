export const SUPABASE_SETUP_SQL = `-- ================================================================
-- SCRIPT COMPLETO DE CRIAÇÃO E POVOAMENTO DO BANCO DE DADOS (SUPABASE)
-- Copie todo este conteúdo e execute no "SQL Editor" do Supabase.
-- ================================================================

-- 1. CRIAÇÃO DAS TABELAS COM TIPOS E CHAVES
CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT,
  color TEXT,
  subcategories JSONB DEFAULT '[]'::jsonb,
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

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id TEXT,
  category_name TEXT NOT NULL,
  subcategory TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recurring TEXT DEFAULT 'none',
  notes TEXT,
  member_id TEXT,
  account_id TEXT,
  attachment_name TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  limit_amount NUMERIC NOT NULL,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC NOT NULL DEFAULT 0,
  deadline DATE NOT NULL,
  color TEXT,
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  installments_count INT NOT NULL DEFAULT 1,
  installment_amount NUMERIC NOT NULL,
  interest_rate NUMERIC DEFAULT 0,
  next_due_date DATE,
  category TEXT,
  paid_installments INT DEFAULT 0,
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

-- 2. DESATIVAR ROW LEVEL SECURITY (RLS) PARA LEITURA/ESCRITA LIVRE PELO APP
ALTER TABLE family_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE debts DISABLE ROW LEVEL SECURITY;
ALTER TABLE investments DISABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules DISABLE ROW LEVEL SECURITY;

-- 3. LIMPEZA PREVENTIVA (OPCIONAL - DESCOMENTE SE QUISER REINICIALIZAR DADOS)
-- TRUNCATE family_members, categories, accounts, transactions, budgets, goals, subscriptions, debts, investments, automation_rules CASCADE;

-- 4. POVOAMENTO DE MEMBROS DA FAMÍLIA
INSERT INTO family_members (id, name, role, avatar) VALUES
  ('mem_1', 'Carlos Silva', 'Pai / Provedor', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'),
  ('mem_2', 'Mariana Silva', 'Mãe / Gestora', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=150'),
  ('mem_3', 'Lucas Silva', 'Filho Maior', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=150')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, avatar=EXCLUDED.avatar;

-- 5. POVOAMENTO DE CATEGORIAS
INSERT INTO categories (id, name, type, icon, color, subcategories) VALUES
  ('cat_1', 'Alimentação', 'expense', 'Utensils', '#EF4444', '["Supermercado", "Restaurantes", "Lanches & Feira"]'::jsonb),
  ('cat_2', 'Moradia', 'expense', 'Home', '#3B82F6', '["Aluguel/Condomínio", "Energia Elétrica", "Água & Gás", "Internet & TV"]'::jsonb),
  ('cat_3', 'Transporte', 'expense', 'Car', '#F59E0B', '["Combustível", "Manutenção", "Uber/Táxi", "Seguro Auto"]'::jsonb),
  ('cat_4', 'Lazer & Cultura', 'expense', 'Smile', '#8B5CF6', '["Viagens", "Cinema & Shows", "Restaurantes de Lazer"]'::jsonb),
  ('cat_5', 'Saúde & Bem-Estar', 'expense', 'Activity', '#10B981', '["Plano de Saúde", "Farmácia", "Consultas & Exames"]'::jsonb),
  ('cat_6', 'Salário & Proventos', 'income', 'DollarSign', '#10B981', '["Salário Fixo", "Bônus/PLR", "Décimo Terceiro"]'::jsonb),
  ('cat_7', 'Investimentos & Rendimentos', 'income', 'TrendingUp', '#6366F1', '["Dividendos", "Rendimento Cfr", "Venda de Ativos"]'::jsonb),
  ('cat_8', 'Freelance & Outros', 'income', 'Briefcase', '#EC4899', '["Projetos Extras", "Consultoria"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, type=EXCLUDED.type, icon=EXCLUDED.icon, color=EXCLUDED.color, subcategories=EXCLUDED.subcategories;

-- 6. POVOAMENTO DE CONTAS E CARTÕES
INSERT INTO accounts (id, name, type, balance, color) VALUES
  ('acc_1', 'Conta Corrente Itaú', 'checking', 8450.00, '#EC6608'),
  ('acc_2', 'Reserva Nubank (Rendimento)', 'savings', 18200.50, '#820AD1'),
  ('acc_3', 'XP Investimentos', 'investment', 42500.00, '#000000'),
  ('acc_4', 'Cartão Santander Unlimited', 'credit_card', -3200.00, '#CC0000')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, type=EXCLUDED.type, balance=EXCLUDED.balance, color=EXCLUDED.color;

-- 7. POVOAMENTO DE TRANSAÇÕES FINANCEIRAS
INSERT INTO transactions (id, type, category_id, category_name, subcategory, tags, amount, date, recurring, notes, member_id, account_id) VALUES
  ('tx_1', 'income', 'cat_6', 'Salário & Proventos', 'Salário Fixo', '["salario", "principal"]'::jsonb, 12500.00, CURRENT_DATE - INTERVAL '10 days', 'monthly', 'Salário Mensal Empresa X', 'mem_1', 'acc_1'),
  ('tx_2', 'income', 'cat_6', 'Salário & Proventos', 'Salário Fixo', '["salario", "mariana"]'::jsonb, 8200.00, CURRENT_DATE - INTERVAL '12 days', 'monthly', 'Salário Mariana', 'mem_2', 'acc_1'),
  ('tx_3', 'expense', 'cat_1', 'Alimentação', 'Supermercado', '["essencial", "semanal"]'::jsonb, 1240.50, CURRENT_DATE - INTERVAL '2 days', 'none', 'Compras da Semana - Pão de Açúcar', 'mem_2', 'acc_1'),
  ('tx_4', 'expense', 'cat_2', 'Moradia', 'Aluguel/Condomínio', '["fixo", "essencial"]'::jsonb, 3100.00, CURRENT_DATE - INTERVAL '5 days', 'monthly', 'Aluguel e Condomínio do Mês', 'mem_1', 'acc_1'),
  ('tx_5', 'expense', 'cat_3', 'Transporte', 'Combustível', '["carro"]'::jsonb, 280.00, CURRENT_DATE - INTERVAL '3 days', 'none', 'Abastecimento Shell V-Power', 'mem_1', 'acc_4'),
  ('tx_6', 'expense', 'cat_5', 'Saúde & Bem-Estar', 'Plano de Saúde', '["saude", "mensal"]'::jsonb, 1450.00, CURRENT_DATE - INTERVAL '8 days', 'monthly', 'Plano Família Amil', 'mem_1', 'acc_1'),
  ('tx_7', 'expense', 'cat_4', 'Lazer & Cultura', 'Restaurantes de Lazer', '["lazer", "fim-de-semana"]'::jsonb, 340.00, CURRENT_DATE - INTERVAL '1 day', 'none', 'Jantar em Família OutBack', 'mem_1', 'acc_4'),
  ('tx_8', 'income', 'cat_7', 'Investimentos & Rendimentos', 'Dividendos', '["dividendos", "xp"]'::jsonb, 680.40, CURRENT_DATE - INTERVAL '4 days', 'monthly', 'Proventos FIIs MXRF11 & HGLG11', 'mem_1', 'acc_3'),
  ('tx_9', 'expense', 'cat_1', 'Alimentação', 'Restaurantes', '["almoço"]'::jsonb, 85.00, CURRENT_DATE - INTERVAL '1 day', 'none', 'Almoço executivo de trabalho', 'mem_1', 'acc_4'),
  ('tx_10', 'income', 'cat_8', 'Freelance & Outros', 'Consultoria', '["freelance"]'::jsonb, 2500.00, CURRENT_DATE - INTERVAL '15 days', 'none', 'Consultoria de TI para Cliente Y', 'mem_1', 'acc_2')
ON CONFLICT (id) DO UPDATE SET type=EXCLUDED.type, category_id=EXCLUDED.category_id, category_name=EXCLUDED.category_name, amount=EXCLUDED.amount, date=EXCLUDED.date, notes=EXCLUDED.notes;

-- 8. POVOAMENTO DE ORÇAMENTOS MENSAIS
INSERT INTO budgets (id, category_id, limit_amount, month) VALUES
  ('bud_1', 'cat_1', 3000.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM')),
  ('bud_2', 'cat_2', 4500.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM')),
  ('bud_3', 'cat_3', 1200.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM')),
  ('bud_4', 'cat_4', 1500.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM')),
  ('bud_5', 'cat_5', 2000.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))
ON CONFLICT (id) DO UPDATE SET limit_amount=EXCLUDED.limit_amount, month=EXCLUDED.month;

-- 9. POVOAMENTO DE METAS FINANCEIRAS
INSERT INTO goals (id, name, target_amount, current_amount, deadline, color) VALUES
  ('goal_1', 'Reserva de Emergência 6 Meses', 60000.00, 38500.00, CURRENT_DATE + INTERVAL '12 months', '#10B981'),
  ('goal_2', 'Viagem de Férias para a Europa', 35000.00, 14200.00, CURRENT_DATE + INTERVAL '8 months', '#3B82F6'),
  ('goal_3', 'Troca do Carro Familiar', 80000.00, 22000.00, CURRENT_DATE + INTERVAL '18 months', '#8B5CF6')
ON CONFLICT (id) DO UPDATE SET target_amount=EXCLUDED.target_amount, current_amount=EXCLUDED.current_amount, deadline=EXCLUDED.deadline;

-- 10. POVOAMENTO DE ASSINATURAS E RECORRÊNCIAS
INSERT INTO subscriptions (id, name, amount, frequency, category, billing_date, auto_notify, member_id) VALUES
  ('sub_1', 'Netflix Premium 4K', 55.90, 'monthly', 'Lazer & Cultura', 15, true, 'mem_1'),
  ('sub_2', 'Spotify Família', 34.90, 'monthly', 'Lazer & Cultura', 10, true, 'mem_2'),
  ('sub_3', 'Academia SmartFit (Casal)', 239.80, 'monthly', 'Saúde & Bem-Estar', 5, true, 'mem_1'),
  ('sub_4', 'iCloud Storage 2TB', 34.90, 'monthly', 'Moradia', 20, false, 'mem_1'),
  ('sub_5', 'Amazon Prime', 19.90, 'monthly', 'Lazer & Cultura', 28, true, 'mem_2')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, amount=EXCLUDED.amount, frequency=EXCLUDED.frequency;

-- 11. POVOAMENTO DE DÍVIDAS E FINANCIAMENTOS
INSERT INTO debts (id, name, total_amount, installments_count, installment_amount, interest_rate, next_due_date, category, paid_installments) VALUES
  ('debt_1', 'Financiamento Imobiliário Caixa', 240000.00, 360, 1850.00, 8.5, CURRENT_DATE + INTERVAL '15 days', 'Moradia', 42),
  ('debt_2', 'Parcelamento Notebook Dell', 6000.00, 10, 600.00, 0.0, CURRENT_DATE + INTERVAL '10 days', 'Tecnologia', 6)
ON CONFLICT (id) DO UPDATE SET total_amount=EXCLUDED.total_amount, paid_installments=EXCLUDED.paid_installments;

-- 12. POVOAMENTO DE INVESTIMENTOS E CARTEIRA
INSERT INTO investments (id, type, name, initial_amount, current_amount, start_date, simple_yield, contributions_count) VALUES
  ('inv_1', 'CDB / Renda Fixa', 'CDB Banco Inter 102% CDI', 15000.00, 16840.50, CURRENT_DATE - INTERVAL '300 days', 12.27, 8),
  ('inv_2', 'Fundos Imobiliários (FIIs)', 'Carteira HGLG11 / KNCR11 / MXRF11', 20000.00, 22450.00, CURRENT_DATE - INTERVAL '180 days', 12.25, 12),
  ('inv_3', 'Ações Brasil (B3)', 'Ações ITUB4 / BBAS3 / WEGE3', 18000.00, 21300.00, CURRENT_DATE - INTERVAL '210 days', 18.33, 6),
  ('inv_4', 'Tesouro Direto', 'Tesouro IPCA+ 2035', 10000.00, 10850.00, CURRENT_DATE - INTERVAL '120 days', 8.50, 4)
ON CONFLICT (id) DO UPDATE SET initial_amount=EXCLUDED.initial_amount, current_amount=EXCLUDED.current_amount;

-- 13. POVOAMENTO DE REGRAS DE AUTOMAÇÃO
INSERT INTO automation_rules (id, condition_field, condition_value, action_field, action_value) VALUES
  ('rule_1', 'notes', 'Uber', 'category_name', 'Transporte'),
  ('rule_2', 'notes', 'iFood', 'category_name', 'Alimentação'),
  ('rule_3', 'notes', 'Posto', 'category_name', 'Transporte')
ON CONFLICT (id) DO UPDATE SET condition_value=EXCLUDED.condition_value, action_value=EXCLUDED.action_value;
`;
