-- =============================================================================
-- SCRIPT DE SEED / DADOS FAKES DE TESTE
-- Popula todas as tabelas com um cenário financeiro familiar completo e realista.
-- Compatível com Supabase / PostgreSQL.
-- =============================================================================

-- 1. MEMBROS DA FAMÍLIA
INSERT INTO family_members (id, name, role, avatar, access_role, notify_channels) VALUES
('mem_danilo', 'Danilo Souza', 'father', '👨‍💼', 'admin', ARRAY['email', 'push']),
('mem_carol', 'Carolina Silva', 'mother', '👩‍💻', 'admin', ARRAY['email', 'whatsapp']),
('mem_lucas', 'Lucas Souza', 'child', '👦', 'member', ARRAY['push']),
('mem_sofia', 'Sofia Souza', 'child', '👧', 'member', ARRAY['push'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  avatar = EXCLUDED.avatar;

-- 2. CATEGORIAS E SUBCATEGORIAS
INSERT INTO categories (id, name, type, icon, color, parent_id, is_shared) VALUES
-- Receitas
('cat_salario', 'Salário e Renda', 'income', 'Briefcase', 'emerald-600', NULL, TRUE),
('cat_rendimentos', 'Rendimentos e Dividendos', 'income', 'TrendingUp', 'teal-600', NULL, TRUE),
('cat_extra', 'Renda Extra & Freelance', 'income', 'Zap', 'cyan-600', NULL, TRUE),
-- Despesas Principais
('cat_moradia', 'Moradia', 'expense', 'Home', 'indigo-600', NULL, TRUE),
('cat_alimentacao', 'Alimentação', 'expense', 'Utensils', 'orange-600', NULL, TRUE),
('cat_transporte', 'Transporte', 'expense', 'Car', 'blue-600', NULL, TRUE),
('cat_saude', 'Saúde & Cuidados', 'expense', 'Heart', 'rose-600', NULL, TRUE),
('cat_educacao', 'Educação', 'expense', 'BookOpen', 'purple-600', NULL, TRUE),
('cat_lazer', 'Lazer & Viagens', 'expense', 'Plane', 'amber-600', NULL, TRUE),
('cat_outros', 'Outras Despesas', 'expense', 'Tag', 'gray-600', NULL, TRUE),
-- Subcategorias
('sub_mercado', 'Supermercado', 'expense', 'ShoppingCart', 'orange-500', 'cat_alimentacao', TRUE),
('sub_restaurante', 'Restaurantes & Delivery', 'expense', 'Coffee', 'orange-400', 'cat_alimentacao', TRUE),
('sub_combustivel', 'Combustível', 'expense', 'Fuel', 'blue-500', 'cat_transporte', TRUE),
('sub_aluguel', 'Condomínio & Aluguel', 'expense', 'Key', 'indigo-500', 'cat_moradia', TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type;

-- 3. TAGS
INSERT INTO tags (id, name, color) VALUES
('tag_fixo', 'Gasto Fixo', '#EF4444'),
('tag_variavel', 'Gasto Variável', '#F59E0B'),
('tag_ferias', 'Férias 2026', '#10B981'),
('tag_essencial', 'Essencial', '#3B82F6'),
('tag_supérfluo', 'Estilo de Vida', '#8B5CF6')
ON CONFLICT (id) DO NOTHING;

-- 4. CONTAS BANCÁRIAS E CARTEIRAS
INSERT INTO accounts (id, name, type, balance, color) VALUES
('acc_itau', 'Itaú Conta Corrente', 'bank', 8450.30, 'orange-500'),
('acc_nubank', 'Nubank Reserva', 'bank', 15200.00, 'purple-600'),
('acc_xp', 'XP Investimentos', 'bank', 42800.75, 'yellow-500'),
('acc_carteira', 'Dinheiro em Espécie', 'cash', 450.00, 'emerald-500')
ON CONFLICT (id) DO UPDATE SET
  balance = EXCLUDED.balance;

-- 5. CARTÕES DE CRÉDITO
INSERT INTO credit_cards (id, name, limit_amount, closing_day, due_day, account_id, color) VALUES
('card_itau_black', 'Itaú Mastercard Black', 25000.00, 20, 28, 'acc_itau', 'orange-600'),
('card_nubank_ultra', 'Nubank Ultravioleta', 15000.00, 12, 20, 'acc_nubank', 'purple-700')
ON CONFLICT (id) DO UPDATE SET
  limit_amount = EXCLUDED.limit_amount;

-- 6. FATURAS DE CARTÃO
INSERT INTO invoices (id, credit_card_id, month, year, closing_date, due_date, total_amount, status) VALUES
('inv_itau_2026_08', 'card_itau_black', 8, 2026, '2026-08-20', '2026-08-28', 3480.90, 'OPEN'),
('inv_itau_2026_07', 'card_itau_black', 7, 2026, '2026-07-20', '2026-07-28', 4120.50, 'PAID'),
('inv_nu_2026_08', 'card_nubank_ultra', 8, 2026, '2026-08-12', '2026-08-20', 1250.00, 'CLOSED')
ON CONFLICT (credit_card_id, month, year) DO UPDATE SET
  total_amount = EXCLUDED.total_amount;

-- 7. TRANSAÇÕES
INSERT INTO transactions (
  id, type, category_id, category_name, subcategory_id, subcategory, tag_ids, amount, date,
  recurring, recurrence_config, recurrence_group_id, notes, member_id, account_id,
  attachment_urls, attachment_names, status, origin, is_reconciled, credit_card_id, invoice_id, installment_number, total_installments, include_in_balance_sum
) VALUES
-- Receitas
('tx_rec_01', 'income', 'cat_salario', 'Salário e Renda', NULL, '', ARRAY['tag_fixo', 'tag_essencial'], 12500.00, '2026-08-05', 'monthly', NULL, NULL, 'Salário Danilo Tech Corp', 'mem_danilo', 'acc_itau', '{}', '{}', 'REALIZADO', 'MANUAL', TRUE, NULL, NULL, 1, 1, TRUE),
('tx_rec_02', 'income', 'cat_salario', 'Salário e Renda', NULL, '', ARRAY['tag_fixo', 'tag_essencial'], 9800.00, '2026-08-05', 'monthly', NULL, NULL, 'Salário Carolina Design Studio', 'mem_carol', 'acc_nubank', '{}', '{}', 'REALIZADO', 'MANUAL', TRUE, NULL, NULL, 1, 1, TRUE),
('tx_rec_03', 'income', 'cat_rendimentos', 'Rendimentos e Dividendos', NULL, '', ARRAY['tag_variavel'], 640.85, '2026-08-10', 'none', NULL, NULL, 'Dividendos FIIs XP', 'mem_danilo', 'acc_xp', '{}', '{}', 'REALIZADO', 'PLUGGY', TRUE, NULL, NULL, 1, 1, TRUE),

-- Despesas em Conta Corrente
('tx_desp_01', 'expense', 'cat_moradia', 'Moradia', 'sub_aluguel', 'Condomínio & Aluguel', ARRAY['tag_fixo', 'tag_essencial'], 3200.00, '2026-08-10', 'monthly', NULL, NULL, 'Condomínio Edifício Jardins', 'mem_danilo', 'acc_itau', '{}', '{}', 'REALIZADO', 'MANUAL', TRUE, NULL, NULL, 1, 1, TRUE),
('tx_desp_02', 'expense', 'cat_educacao', 'Educação', NULL, '', ARRAY['tag_fixo', 'tag_essencial'], 1800.00, '2026-08-08', 'monthly', NULL, NULL, 'Mensalidade Colégio Lucas e Sofia', 'mem_carol', 'acc_itau', '{}', '{}', 'REALIZADO', 'MANUAL', TRUE, NULL, NULL, 1, 1, TRUE),
('tx_desp_03', 'expense', 'cat_alimentacao', 'Alimentação', 'sub_mercado', 'Supermercado', ARRAY['tag_variavel', 'tag_essencial'], 784.30, '2026-08-12', 'none', NULL, NULL, 'Compras Pão de Açúcar', 'mem_carol', 'acc_itau', '{}', '{}', 'REALIZADO', 'PLUGGY', TRUE, NULL, NULL, 1, 1, TRUE),
('tx_desp_04', 'expense', 'cat_transporte', 'Transporte', 'sub_combustivel', 'Combustível', ARRAY['tag_variavel'], 240.00, '2026-08-14', 'none', NULL, NULL, 'Posto Shell Ipiranga', 'mem_danilo', 'acc_itau', '{}', '{}', 'REALIZADO', 'PLUGGY', TRUE, NULL, NULL, 1, 1, TRUE),

-- Despesas no Cartão de Crédito (vinculadas a fatura)
('tx_card_01', 'expense', 'cat_alimentacao', 'Alimentação', 'sub_restaurante', 'Restaurantes & Delivery', ARRAY['tag_variavel'], 189.50, '2026-08-15', 'none', NULL, NULL, 'Jantar Outback', 'mem_danilo', 'acc_itau', '{}', '{}', 'REALIZADO', 'MANUAL', TRUE, 'card_itau_black', 'inv_itau_2026_08', 1, 1, FALSE),
('tx_card_02', 'expense', 'cat_lazer', 'Lazer & Viagens', NULL, '', ARRAY['tag_ferias'], 450.00, '2026-08-11', 'none', NULL, NULL, 'Passagens Aéreas Férias', 'mem_carol', 'acc_itau', '{}', '{}', 'REALIZADO', 'MANUAL', TRUE, 'card_itau_black', 'inv_itau_2026_08', 2, 6, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 8. ORÇAMENTOS MENSAIS (BUDGETS)
INSERT INTO budgets (id, category_id, limit_amount, month, notify_at_percent, rollover) VALUES
('bud_moradia_2026_08', 'cat_moradia', 4000.00, '2026-08', 80, FALSE),
('bud_alimentacao_2026_08', 'cat_alimentacao', 3000.00, '2026-08', 85, FALSE),
('bud_transporte_2026_08', 'cat_transporte', 1200.00, '2026-08', 80, FALSE),
('bud_lazer_2026_08', 'cat_lazer', 1500.00, '2026-08', 90, FALSE),
('bud_saude_2026_08', 'cat_saude', 1000.00, '2026-08', 80, FALSE)
ON CONFLICT (id) DO UPDATE SET
  limit_amount = EXCLUDED.limit_amount;

-- 9. METAS MENSAIS CONSOLIDADAS
INSERT INTO monthly_goals (id, name, month, limit_amount, category_ids, notify_at_percent) VALUES
('mg_essenciais_2026_08', 'Gastos Essenciais Família', '2026-08', 9000.00, ARRAY['cat_moradia', 'cat_alimentacao', 'cat_transporte', 'cat_saude', 'cat_educacao'], 85)
ON CONFLICT (id) DO NOTHING;

-- 10. METAS DE LONGO PRAZO (GOALS)
INSERT INTO goals (id, name, target_amount, current_amount, deadline, color, category, account_id, monthly_contribution) VALUES
('goal_emergencia', 'Reserva de Emergência (6 meses)', 60000.00, 38500.00, '2026-12-31', 'emerald-500', 'Segurança', 'acc_nubank', 2500.00),
('goal_viagem', 'Viagem em Família Europa', 30000.00, 18200.00, '2027-07-15', 'blue-500', 'Lazer', 'acc_xp', 1500.00),
('goal_carro', 'Troca de Carro Híbrido', 80000.00, 22000.00, '2028-06-30', 'purple-500', 'Bens', 'acc_xp', 2000.00)
ON CONFLICT (id) DO UPDATE SET
  current_amount = EXCLUDED.current_amount;

-- 11. CONTRIBUIÇÕES DE METAS (LEDGER)
INSERT INTO goal_contributions (id, goal_id, member_id, amount, date, type) VALUES
('gc_01', 'goal_emergencia', 'mem_danilo', 1500.00, '2026-08-05', 'deposit'),
('gc_02', 'goal_emergencia', 'mem_carol', 1000.00, '2026-08-05', 'deposit'),
('gc_03', 'goal_viagem', 'mem_danilo', 1500.00, '2026-08-06', 'deposit')
ON CONFLICT (id) DO NOTHING;

-- 12. ASSINATURAS RECORRENTES
INSERT INTO subscriptions (id, name, amount, frequency, category, billing_date, auto_notify, member_id, payment_method, notify_channel, notify_days, account_id) VALUES
('sub_netflix', 'Netflix Premium 4K', 59.90, 'monthly', 'Lazer & Viagens', 15, TRUE, 'mem_danilo', 'credit_card', 'push', 3, 'acc_itau'),
('sub_spotify', 'Spotify Plano Família', 34.90, 'monthly', 'Lazer & Viagens', 8, TRUE, 'mem_carol', 'credit_card', 'push', 2, 'acc_itau'),
('sub_academia', 'Academia SmartFit (Casal)', 239.80, 'monthly', 'Saúde & Cuidados', 10, TRUE, 'mem_danilo', 'bank_debit', 'whatsapp', 3, 'acc_itau'),
('sub_icloud', 'Apple iCloud 2TB', 49.90, 'monthly', 'Outras Despesas', 22, TRUE, 'mem_carol', 'credit_card', 'email', 2, 'acc_nubank')
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount;

-- 13. DÍVIDAS / PARCELAMENTOS
INSERT INTO debts (id, name, creditor, total_amount, installments_count, installment_amount, interest_rate, next_due_date, category, paid_installments, account_id) VALUES
('debt_imovel', 'Financiamento Apartamento', 'Caixa Econômica', 420000.00, 360, 3150.00, 0.75, '2026-09-10', 'Moradia', 48, 'acc_itau'),
('debt_solar', 'Painéis Solares Fotovoltaicos', 'Santander Financiamentos', 18000.00, 24, 750.00, 0.00, '2026-09-05', 'Moradia', 14, 'acc_itau')
ON CONFLICT (id) DO UPDATE SET
  paid_installments = EXCLUDED.paid_installments;

-- 14. INVESTIMENTOS
INSERT INTO investments (
  id, type, name, initial_amount, current_amount, start_date, simple_yield,
  contributions_count, withdrawals_count, account_id, origin, pluggy_investment_id, is_reconciled
) VALUES
('inv_tesouro_selic', 'Tesouro Direto', 'Tesouro Selic 2029', 20000.00, 22450.80, '2025-01-15', 10.75, 4, 0, 'acc_xp', 'MANUAL', NULL, TRUE),
('inv_cdb_xp', 'CDB', 'CDB XP Banco Master 120% CDI', 15000.00, 16820.40, '2025-06-20', 12.80, 1, 0, 'acc_xp', 'PLUGGY', 'plg_cdb_001', TRUE),
('inv_fii_hglg', 'Fundo Imobiliário', 'CSHG Logística (HGLG11)', 10000.00, 10840.00, '2025-03-10', 8.90, 6, 0, 'acc_xp', 'PLUGGY', 'plg_fii_002', TRUE),
('inv_acoes_vale', 'Ações', 'Vale S.A. (VALE3)', 8000.00, 7890.50, '2025-08-01', -1.37, 2, 0, 'acc_xp', 'MANUAL', NULL, TRUE)
ON CONFLICT (id) DO UPDATE SET
  current_amount = EXCLUDED.current_amount;

-- 15. REGRAS DE AUTOMAÇÃO E CONCILIAÇÃO
INSERT INTO automation_rules (id, condition_field, condition_value, action_field, action_value) VALUES
('rule_01', 'text_contains', 'IFOOD', 'category', 'Alimentação'),
('rule_02', 'text_contains', 'UBER', 'category', 'Transporte'),
('rule_03', 'text_contains', 'POSTO', 'category', 'Transporte'),
('rule_04', 'text_contains', 'NETFLIX', 'category', 'Lazer & Viagens')
ON CONFLICT (id) DO NOTHING;

-- Confirmação de execução
SELECT 'Seed de dados fakes inserido com sucesso!' AS status;
