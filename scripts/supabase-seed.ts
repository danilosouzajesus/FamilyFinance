export const SUPABASE_SEED_SQL = `-- ================================================================
-- SCRIPT DE DADOS FAKE PARA TESTES (FAMILYFINANCE)
-- Execute DEPOIS do TRUNCATE em todas as tabelas.
-- Dados de exemplo: família de 4 membros, 2 cartões, faturas em
-- todos os status (OPEN/CLOSED/OVERDUE/PAID), parcelamento 3x,
-- lançamentos PENDENTE (Caixa de Entrada) e receitas/despesas de agosto/2026.
-- ================================================================

-- 0. RESET TOTAL (opcional) — DROP de todas as tabelas para recriar do zero
-- Rodar DEPOIS do TRUNCATE se o schema estiver desatualizado. Após rodar:
--   1) Execute o SCRIPT DE SETUP (supabaseSqlScript.ts) para recriar as tabelas
--   2) Execute o restante deste script (SEED) para inserir os dados fake
-- DROP TABLE IF EXISTS app_preferences CASCADE;
-- DROP TABLE IF EXISTS pluggy_account_mappings CASCADE;
-- DROP TABLE IF EXISTS pending_transactions CASCADE;
-- DROP TABLE IF EXISTS pluggy_connections CASCADE;
-- DROP TABLE IF EXISTS automation_rules CASCADE;
-- DROP TABLE IF EXISTS investments CASCADE;
-- DROP TABLE IF EXISTS debts CASCADE;
-- DROP TABLE IF EXISTS subscriptions CASCADE;
-- DROP TABLE IF EXISTS goals CASCADE;
-- DROP TABLE IF EXISTS monthly_goals CASCADE;
-- DROP TABLE IF EXISTS budgets CASCADE;
-- DROP TABLE IF EXISTS invoices CASCADE;
-- DROP TABLE IF EXISTS credit_cards CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS accounts CASCADE;
-- DROP TABLE IF EXISTS tags CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS family_members CASCADE;

-- 0b. MIGRAÇÕES IDEMPOTENTES — garante colunas novas em tabelas de versões antigas
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS access_role TEXT DEFAULT 'member';
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS notify_channels TEXT[] DEFAULT '{}';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id TEXT DEFAULT NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS monthly_contribution NUMERIC;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'credit_card';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS notify_channel TEXT DEFAULT 'push';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS notify_days INT DEFAULT 3;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS creditor TEXT;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS interest_rate NUMERIC DEFAULT 0;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS next_due_date DATE;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS paid_installments INT DEFAULT 0;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS simple_yield NUMERIC DEFAULT 0;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS contributions_count INT DEFAULT 1;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS withdrawals_count INT DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS notify_at_percent INT DEFAULT 80;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS rollover BOOLEAN DEFAULT FALSE;
ALTER TABLE monthly_goals ADD COLUMN IF NOT EXISTS category_ids TEXT[] DEFAULT '{}';
ALTER TABLE monthly_goals ADD COLUMN IF NOT EXISTS notify_at_percent INT DEFAULT 80;

-- 1. MEMBROS DA FAMÍLIA
INSERT INTO family_members (id, name, role, avatar, access_role) VALUES
  ('mem_geral', 'Geral', 'guardian', 'bg-slate-500 text-white', 'admin'),
  ('mem_pai', 'Danil Pai', 'father', 'bg-indigo-500 text-white', 'admin'),
  ('mem_mae', 'Mariana Silva', 'mother', 'bg-pink-500 text-white', 'admin'),
  ('mem_filho', 'Lucas Silva', 'child', 'bg-cyan-500 text-white', 'member');

-- 2. CATEGORIAS (pai + subcategorias na mesma tabela via parent_id; is_shared TRUE = compartilhada)
INSERT INTO categories (id, name, type, icon, color, parent_id, is_shared) VALUES
  ('cat_moradia', 'Moradia', 'expense', 'Home', '#F59E0B', NULL, TRUE),
  ('cat_ali', 'Alimentação', 'expense', 'ShoppingCart', '#10B981', NULL, TRUE),
  ('cat_trans', 'Transporte', 'expense', 'Car', '#3B82F6', NULL, TRUE),
  ('cat_saude', 'Saúde', 'expense', 'HeartPulse', '#EF4444', NULL, TRUE),
  ('cat_educ', 'Educação', 'expense', 'BookOpen', '#8B5CF6', NULL, TRUE),
  ('cat_lazer', 'Lazer', 'expense', 'Palmtree', '#EC4899', NULL, FALSE),
  ('cat_roupa', 'Roupas', 'expense', 'Shirt', '#14B8A6', NULL, FALSE),
  ('cat_tech', 'Tecnologia', 'expense', 'Smartphone', '#6366F1', NULL, FALSE),
  ('cat_outros', 'Outros', 'expense', 'MoreHorizontal', '#64748B', NULL, TRUE),
  ('cat_salario', 'Salário', 'income', 'Banknote', '#059669', NULL, TRUE),
  ('cat_freela', 'Freelance', 'income', 'Briefcase', '#0EA5E9', NULL, TRUE),
  ('cat_inv', 'Investimentos', 'income', 'TrendingUp', '#16A34A', NULL, TRUE);

INSERT INTO categories (id, name, type, icon, color, parent_id, is_shared) VALUES
  ('cat_sub_aluguel', 'Aluguel', 'expense', 'Key', '#F59E0B', 'cat_moradia', TRUE),
  ('cat_sub_condominio', 'Condomínio', 'expense', 'Building2', '#F59E0B', 'cat_moradia', TRUE),
  ('cat_sub_contas', 'Contas (Luz/Água)', 'expense', 'Zap', '#F59E0B', 'cat_moradia', TRUE),
  ('cat_sub_mercado', 'Supermercado', 'expense', 'ShoppingCart', '#10B981', 'cat_ali', TRUE),
  ('cat_sub_rest', 'Restaurantes', 'expense', 'Utensils', '#10B981', 'cat_ali', TRUE),
  ('cat_sub_deliv', 'Delivery', 'expense', 'Bike', '#10B981', 'cat_ali', TRUE),
  ('cat_sub_comb', 'Combustível', 'expense', 'Fuel', '#3B82F6', 'cat_trans', TRUE),
  ('cat_sub_app', 'Aplicativos', 'expense', 'Navigation', '#3B82F6', 'cat_trans', TRUE),
  ('cat_sub_mant', 'Manutenção', 'expense', 'Wrench', '#3B82F6', 'cat_trans', TRUE),
  ('cat_sub_plano', 'Plano de Saúde', 'expense', 'Stethoscope', '#EF4444', 'cat_saude', TRUE),
  ('cat_sub_farma', 'Farmácia', 'expense', 'Pill', '#EF4444', 'cat_saude', TRUE),
  ('cat_sub_consulta', 'Consultas', 'expense', 'ClipboardPlus', '#EF4444', 'cat_saude', TRUE),
  ('cat_sub_escola', 'Escola', 'expense', 'GraduationCap', '#8B5CF6', 'cat_educ', TRUE),
  ('cat_sub_curso', 'Cursos', 'expense', 'BookOpen', '#8B5CF6', 'cat_educ', TRUE),
  ('cat_sub_cinema', 'Cinema', 'expense', 'Clapperboard', '#EC4899', 'cat_lazer', FALSE),
  ('cat_sub_viagem', 'Viagens', 'expense', 'Plane', '#EC4899', 'cat_lazer', FALSE),
  ('cat_sub_ass', 'Assinaturas', 'expense', 'PlayCircle', '#EC4899', 'cat_lazer', FALSE),
  ('cat_sub_eletr', 'Eletrônicos', 'expense', 'Monitor', '#6366F1', 'cat_tech', FALSE),
  ('cat_sub_salfixo', 'Salário Fixo', 'income', 'Banknote', '#059669', 'cat_salario', TRUE);

-- 3. TAGS
INSERT INTO tags (id, name, color) VALUES
  ('tag_essencial', 'essencial', '#10B981'),
  ('tag_lazer', 'lazer', '#EC4899'),
  ('tag_trabalho', 'trabalho', '#3B82F6'),
  ('tag_viagem', 'viagem', '#F59E0B');

-- 4. CONTAS
INSERT INTO accounts (id, name, type, balance, color) VALUES
  ('acc_corrente', 'Banco Itaú', 'bank', 15200, 'indigo-500'),
  ('acc_poupanca', 'Poupança', 'bank', 23000, 'emerald-500'),
  ('acc_carteira', 'Carteira', 'cash', 850, 'amber-500'),
  ('acc_nubank', 'Conta Nubank', 'bank', 4200, 'purple-500'),
  ('acc_xp', 'XP Investimentos', 'investment', 12500, 'indigo-500');

-- 5. CARTÕES DE CRÉDITO
INSERT INTO credit_cards (id, name, limit_amount, closing_day, due_day, account_id, color) VALUES
  ('card_nubank', 'Nubank Final', 5000, 10, 27, 'acc_nubank', '#8B5CF6'),
  ('card_itau', 'Itaú Visa', 10000, 20, 5, 'acc_corrente', '#C026D3');

-- 6. FATURAS (id = {cartão}_{ano}-{mês})
INSERT INTO invoices (id, credit_card_id, month, year, closing_date, due_date, total_amount, status, paid_at) VALUES
  ('card_nubank_2026-07', 'card_nubank', 7, 2026, '2026-07-10', '2026-07-27', 2100, 'PAID', '2026-07-25T12:00:00Z'),
  ('card_nubank_2026-08', 'card_nubank', 8, 2026, '2026-08-10', '2026-08-27', 1185.40, 'OPEN', NULL),
  ('card_nubank_2026-09', 'card_nubank', 9, 2026, '2026-09-10', '2026-09-27', 400, 'OPEN', NULL),
  ('card_nubank_2026-10', 'card_nubank', 10, 2026, '2026-10-10', '2026-10-27', 400, 'OPEN', NULL),
  ('card_itau_2026-07', 'card_itau', 7, 2026, '2026-07-20', '2026-08-05', 3200, 'OVERDUE', NULL),
  ('card_itau_2026-08', 'card_itau', 8, 2026, '2026-08-20', '2026-09-05', 600, 'OPEN', NULL);

-- 7. TRANSAÇÕES
-- 7.1 Receitas / despesas normais (conta bancária) — agosto/2026
INSERT INTO transactions (id, type, category_id, category_name, subcategory_id, subcategory, tag_ids, amount, date, recurring, notes, member_id, account_id, status, origin, include_in_balance_sum) VALUES
  ('tx_inc_salario', 'income', 'cat_salario', 'Salário', 'cat_sub_salfixo', 'Salário Fixo', '{tag_trabalho}', 8000, '2026-08-05', 'monthly', 'Salário Danil', 'mem_pai', 'acc_corrente', 'REALIZADO', 'MANUAL', TRUE),
  ('tx_inc_freela', 'income', 'cat_freela', 'Freelance', NULL, '', '{}', 1200, '2026-08-10', 'none', 'Projeto freelance', 'mem_pai', 'acc_corrente', 'REALIZADO', 'MANUAL', TRUE),
  ('tx_alu', 'expense', 'cat_moradia', 'Moradia', 'cat_sub_aluguel', 'Aluguel', '{tag_essencial}', 2500, '2026-08-05', 'monthly', 'Aluguel casa', 'mem_pai', 'acc_corrente', 'REALIZADO', 'MANUAL', TRUE),
  ('tx_luz', 'expense', 'cat_moradia', 'Moradia', 'cat_sub_contas', 'Contas (Luz/Água)', '{tag_essencial}', 180, '2026-08-12', 'none', 'Conta de luz', 'mem_pai', 'acc_corrente', 'REALIZADO', 'MANUAL', TRUE),
  ('tx_internet', 'expense', 'cat_moradia', 'Moradia', 'cat_sub_contas', 'Contas (Luz/Água)', '{tag_essencial}', 120, '2026-08-03', 'monthly', 'Internet fibra', 'mem_mae', 'acc_corrente', 'REALIZADO', 'MANUAL', TRUE),
  ('tx_super_deb', 'expense', 'cat_ali', 'Alimentação', 'cat_sub_mercado', 'Supermercado', '{tag_essencial}', 600, '2026-08-11', 'none', 'Compras do mês', 'mem_mae', 'acc_corrente', 'REALIZADO', 'MANUAL', TRUE),
  ('tx_escola', 'expense', 'cat_educ', 'Educação', 'cat_sub_escola', 'Escola', '{tag_essencial}', 700, '2026-08-06', 'monthly', 'Mensalidade escola', 'mem_pai', 'acc_corrente', 'REALIZADO', 'MANUAL', TRUE);

-- 7.2 Compras no cartão Nubank — fatura Ago/2026 (total 1.185,40) inclui parcelamento 3x e 2 pendentes
INSERT INTO transactions (id, type, category_id, category_name, subcategory_id, subcategory, tag_ids, amount, date, notes, member_id, account_id, status, origin, credit_card_id, invoice_id, installment_number, total_installments, include_in_balance_sum) VALUES
  ('tx_cel1', 'expense', 'cat_tech', 'Tecnologia', 'cat_sub_eletr', 'Eletrônicos', '{tag_trabalho}', 400, '2026-08-10', 'iPhone 15 (parcela 1/3)', 'mem_pai', 'acc_nubank', 'REALIZADO', 'MANUAL', 'card_nubank', 'card_nubank_2026-08', 1, 3, FALSE),
  ('tx_cel2', 'expense', 'cat_tech', 'Tecnologia', 'cat_sub_eletr', 'Eletrônicos', '{tag_trabalho}', 400, '2026-09-10', 'iPhone 15 (parcela 2/3)', 'mem_pai', 'acc_nubank', 'REALIZADO', 'MANUAL', 'card_nubank', 'card_nubank_2026-09', 2, 3, FALSE),
  ('tx_cel3', 'expense', 'cat_tech', 'Tecnologia', 'cat_sub_eletr', 'Eletrônicos', '{tag_trabalho}', 400, '2026-10-10', 'iPhone 15 (parcela 3/3)', 'mem_pai', 'acc_nubank', 'REALIZADO', 'MANUAL', 'card_nubank', 'card_nubank_2026-10', 3, 3, FALSE),
  ('tx_merc_cc', 'expense', 'cat_ali', 'Alimentação', 'cat_sub_mercado', 'Supermercado', '{tag_essencial}', 250, '2026-08-07', 'Supermercado', 'mem_mae', 'acc_nubank', 'REALIZADO', 'MANUAL', 'card_nubank', 'card_nubank_2026-08', 1, 1, FALSE),
  ('tx_rest_cc', 'expense', 'cat_ali', 'Alimentação', 'cat_sub_rest', 'Restaurantes', '{tag_lazer}', 150, '2026-08-08', 'Jantar família', 'mem_pai', 'acc_nubank', 'REALIZADO', 'MANUAL', 'card_nubank', 'card_nubank_2026-08', 1, 1, FALSE),
  ('tx_deliv_cc', 'expense', 'cat_ali', 'Alimentação', 'cat_sub_deliv', 'Delivery', '{tag_lazer}', 100, '2026-08-09', 'iFood', 'mem_filho', 'acc_nubank', 'REALIZADO', 'MANUAL', 'card_nubank', 'card_nubank_2026-08', 1, 1, FALSE),
  ('tx_farma_cc', 'expense', 'cat_saude', 'Saúde', 'cat_sub_farma', 'Farmácia', '{tag_essencial}', 100, '2026-08-11', 'Farmácia', 'mem_mae', 'acc_nubank', 'REALIZADO', 'MANUAL', 'card_nubank', 'card_nubank_2026-08', 1, 1, FALSE),
  ('tx_comb_cc', 'expense', 'cat_trans', 'Transporte', 'cat_sub_comb', 'Combustível', '{tag_essencial}', 50, '2026-08-12', 'Gasolina', 'mem_pai', 'acc_nubank', 'REALIZADO', 'MANUAL', 'card_nubank', 'card_nubank_2026-08', 1, 1, FALSE),
  ('tx_ifood_pend', 'expense', 'cat_ali', 'Alimentação', 'cat_sub_deliv', 'Delivery', '{tag_lazer}', 89.90, '2026-08-13', 'iFood - teste Caixa de Entrada', 'mem_filho', 'acc_nubank', 'PENDENTE', 'MANUAL', 'card_nubank', 'card_nubank_2026-08', 1, 1, FALSE),
  ('tx_uber_pend', 'expense', 'cat_trans', 'Transporte', 'cat_sub_app', 'Aplicativos', '{tag_lazer}', 45.50, '2026-08-14', 'Uber - teste Caixa de Entrada', 'mem_mae', 'acc_nubank', 'PENDENTE', 'MANUAL', 'card_nubank', 'card_nubank_2026-08', 1, 1, FALSE);

-- 7.3 Compras no cartão Nubank — fatura Jul/2026 (PAID, total 2.100)
INSERT INTO transactions (id, type, category_id, category_name, subcategory_id, subcategory, tag_ids, amount, date, notes, member_id, account_id, status, origin, credit_card_id, invoice_id, installment_number, total_installments, include_in_balance_sum) VALUES
  ('tx_super_jul', 'expense', 'cat_ali', 'Alimentação', 'cat_sub_mercado', 'Supermercado', '{tag_essencial}', 600, '2026-07-05', 'Supermercado julho', 'mem_mae', 'acc_nubank', 'REALIZADO', 'MANUAL', 'card_nubank', 'card_nubank_2026-07', 1, 1, FALSE),
  ('tx_viagem_jul', 'expense', 'cat_lazer', 'Lazer', 'cat_sub_viagem', 'Viagens', '{tag_viagem}', 900, '2026-07-12', 'Passagens', 'mem_pai', 'acc_nubank', 'REALIZADO', 'MANUAL', 'card_nubank', 'card_nubank_2026-07', 1, 1, FALSE),
  ('tx_roupa_jul', 'expense', 'cat_roupa', 'Roupas', NULL, '', '{tag_lazer}', 400, '2026-07-15', 'Roupas', 'mem_mae', 'acc_nubank', 'REALIZADO', 'MANUAL', 'card_nubank', 'card_nubank_2026-07', 1, 1, FALSE),
  ('tx_rest_jul', 'expense', 'cat_ali', 'Alimentação', 'cat_sub_rest', 'Restaurantes', '{tag_lazer}', 200, '2026-07-18', 'Restaurante', 'mem_pai', 'acc_nubank', 'REALIZADO', 'MANUAL', 'card_nubank', 'card_nubank_2026-07', 1, 1, FALSE);

-- 7.4 Compras no cartão Itaú — fatura Jul/2026 (OVERDUE, total 3.200)
INSERT INTO transactions (id, type, category_id, category_name, subcategory_id, subcategory, tag_ids, amount, date, notes, member_id, account_id, status, origin, credit_card_id, invoice_id, installment_number, total_installments, include_in_balance_sum) VALUES
  ('tx_viagem_itau', 'expense', 'cat_lazer', 'Lazer', 'cat_sub_viagem', 'Viagens', '{tag_viagem}', 2000, '2026-07-22', 'Pacote viagem', 'mem_pai', 'acc_corrente', 'REALIZADO', 'MANUAL', 'card_itau', 'card_itau_2026-07', 1, 1, FALSE),
  ('tx_curso_itau', 'expense', 'cat_educ', 'Educação', 'cat_sub_curso', 'Cursos', '{tag_trabalho}', 1200, '2026-07-25', 'Curso inglês', 'mem_pai', 'acc_corrente', 'REALIZADO', 'MANUAL', 'card_itau', 'card_itau_2026-07', 1, 1, FALSE);

-- 7.5 Compras no cartão Itaú — fatura Ago/2026 (OPEN, total 600)
INSERT INTO transactions (id, type, category_id, category_name, subcategory_id, subcategory, tag_ids, amount, date, notes, member_id, account_id, status, origin, credit_card_id, invoice_id, installment_number, total_installments, include_in_balance_sum) VALUES
  ('tx_farma_itau', 'expense', 'cat_saude', 'Saúde', 'cat_sub_farma', 'Farmácia', '{tag_essencial}', 250, '2026-08-13', 'Farmácia Itaú', 'mem_mae', 'acc_corrente', 'REALIZADO', 'MANUAL', 'card_itau', 'card_itau_2026-08', 1, 1, FALSE),
  ('tx_deliv_itau', 'expense', 'cat_ali', 'Alimentação', 'cat_sub_deliv', 'Delivery', '{tag_lazer}', 150, '2026-08-14', 'iFood Itaú', 'mem_filho', 'acc_corrente', 'REALIZADO', 'MANUAL', 'card_itau', 'card_itau_2026-08', 1, 1, FALSE),
  ('tx_rest_itau', 'expense', 'cat_ali', 'Alimentação', 'cat_sub_rest', 'Restaurantes', '{tag_lazer}', 200, '2026-08-15', 'Restaurante Itaú', 'mem_pai', 'acc_corrente', 'REALIZADO', 'MANUAL', 'card_itau', 'card_itau_2026-08', 1, 1, FALSE);

-- 8. ORÇAMENTOS E METAS
INSERT INTO budgets (id, category_id, limit_amount, month, notify_at_percent, rollover) VALUES
  ('bud_ali', 'cat_ali', 1800, '2026-08', 80, FALSE),
  ('bud_lazer', 'cat_lazer', 600, '2026-08', 75, FALSE);

INSERT INTO monthly_goals (id, name, month, limit_amount, category_ids, notify_at_percent) VALUES
  ('mg_agosto', 'Meta família agosto', '2026-08', 8000, '{cat_ali,cat_lazer,cat_trans}', 85);

INSERT INTO goals (id, name, target_amount, current_amount, deadline, color, category, account_id, monthly_contribution) VALUES
  ('goal_viagem', 'Viagem para a Europa', 15000, 5800, '2026-12-15', 'emerald-500', 'cat_lazer', 'acc_poupanca', 800),
  ('goal_reserva', 'Reserva de emergência', 30000, 12000, '2027-06-30', 'indigo-500', 'cat_outros', 'acc_xp', 1000);

-- Extrato de aportes/resgates por meta (goal_contributions)
INSERT INTO goal_contributions (id, goal_id, member_id, amount, date, type) VALUES
  ('gc_viagem_1', 'goal_viagem', 'mem_pai', 1000, '2026-06-05', 'deposit'),
  ('gc_viagem_2', 'goal_viagem', 'mem_mae', 500, '2026-06-20', 'deposit'),
  ('gc_viagem_3', 'goal_viagem', 'mem_pai', 800, '2026-07-05', 'deposit'),
  ('gc_viagem_4', 'goal_viagem', 'mem_filho', 200, '2026-07-25', 'deposit'),
  ('gc_viagem_5', 'goal_viagem', 'mem_pai', 800, '2026-08-05', 'deposit'),
  ('gc_viagem_6', 'goal_viagem', 'mem_mae', 500, '2026-08-10', 'deposit'),
  ('gc_viagem_7', 'goal_viagem', 'mem_pai', 2000, '2026-07-15', 'withdraw'),
  ('gc_reserva_1', 'goal_reserva', 'mem_pai', 3000, '2026-05-01', 'deposit'),
  ('gc_reserva_2', 'goal_reserva', 'mem_pai', 3000, '2026-06-01', 'deposit'),
  ('gc_reserva_3', 'goal_reserva', 'mem_mae', 2000, '2026-07-01', 'deposit'),
  ('gc_reserva_4', 'goal_reserva', 'mem_pai', 4000, '2026-08-01', 'deposit');

-- 9. ASSINATURAS
INSERT INTO subscriptions (id, name, amount, frequency, category, billing_date, auto_notify, member_id, payment_method, notify_channel, notify_days, account_id) VALUES
  ('sub_netflix', 'Netflix', 45.90, 'monthly', 'Assinaturas', 15, TRUE, 'mem_pai', 'credit_card', 'push', 3, 'acc_corrente'),
  ('sub_spotify', 'Spotify', 21.90, 'monthly', 'Assinaturas', 10, TRUE, 'mem_filho', 'credit_card', 'push', 2, 'acc_corrente'),
  ('sub_academia', 'Academia', 89.90, 'monthly', 'Saúde', 5, TRUE, 'mem_pai', 'bank_transfer', 'push', 5, 'acc_corrente'),
  ('sub_cloud', 'iCloud+', 10.90, 'monthly', 'Tecnologia', 20, FALSE, 'mem_pai', 'credit_card', 'push', 3, 'acc_corrente');

-- 10. DÍVIDAS
INSERT INTO debts (id, name, creditor, total_amount, installments_count, installment_amount, interest_rate, next_due_date, category, paid_installments, account_id) VALUES
  ('debt_carro', 'Financiamento do carro', 'Banco Itaú', 60000, 60, 1000, 1.5, '2026-09-01', 'Transporte', 12, 'acc_corrente'),
  ('debt_curso', 'Curso de idiomas', 'Escola de idiomas', 3600, 12, 300, 0, '2026-08-25', 'Educação', 8, 'acc_corrente');

-- 11. INVESTIMENTOS
INSERT INTO investments (id, type, name, initial_amount, current_amount, start_date, simple_yield, contributions_count, withdrawals_count, account_id) VALUES
  ('inv_cdb', 'CDB', 'CDB 110% CDI', 10000, 11500, '2025-01-10', 10, 12, 0, 'acc_xp'),
  ('inv_tesouro', 'Tesouro', 'Tesouro Selic 2028', 5000, 5120, '2025-06-15', 3, 6, 0, 'acc_xp'),
  ('inv_fii', 'FII', 'Fundo Imobiliário HGLG', 3000, 3250, '2026-01-20', 8, 2, 0, 'acc_xp');

-- 12. REGRAS DE AUTOMAÇÃO
INSERT INTO automation_rules (id, condition_field, condition_value, action_field, action_value) VALUES
  ('rule_ifood', 'text_contains', 'iFood', 'category', 'Alimentação'),
  ('rule_uber', 'text_contains', 'Uber', 'category', 'Transporte'),
  ('rule_farmacia', 'text_contains', 'Farmácia', 'category', 'Saúde');

-- 13. CONEXÃO PLUGGY (opcional — descomente se quiser simular banco conectado)
-- INSERT INTO pluggy_connections (id, user_id, item_id, connector_name, status) VALUES
--   ('conn_nubank', 'auth-user-demo', 'item_nubank', 'Nubank', 'CONNECTED');

-- 14. TRANSAÇÕES PENDENTES DA PLUGGY (Caixa de Entrada do Banco & Conciliação)
-- INSERT INTO pending_transactions (id, user_id, account_id, raw_description, amount, date, type, payment_method, pluggy_transaction_id, suggested_category, suggested_category_id, ai_confidence, status) VALUES
--   ('pt_1', 'auth-user-demo', 'acc_corrente', 'PAGAMENTO MERCADO PAO', 78.50, '2026-08-13', 'expense', 'pix', 'pluggy_tx_1', 'Alimentação', 'cat_ali', 0.92, 'PENDING'),
--   ('pt_2', 'auth-user-demo', 'acc_corrente', 'Uber *BR', 32.00, '2026-08-12', 'expense', 'credit', 'pluggy_tx_2', 'Transporte', 'cat_trans', 0.88, 'PENDING');
`;