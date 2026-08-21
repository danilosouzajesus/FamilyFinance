-- =============================================================================
-- SCRIPT DE INSERÇÃO DE CATEGORIAS E SUBCATEGORIAS PERSONALIZADAS
-- Compatível com Supabase / PostgreSQL
-- Executa upsert (ON CONFLICT) de forma idempotente e segura.
-- =============================================================================

-- 1. CATEGORIAS PRINCIPAIS (PAIS)
INSERT INTO categories (id, name, type, icon, color, parent_id, is_shared) VALUES
('cat_moradia',        'Moradia',                         'expense', 'Home',        '#6366F1', NULL, TRUE),
('cat_transporte',     'Transporte & Veículos',           'expense', 'Car',         '#3B82F6', NULL, TRUE),
('cat_alimentacao',    'Alimentação',                     'expense', 'Utensils',    '#F97316', NULL, TRUE),
('cat_saude',          'Saúde & Cuidados',                'expense', 'Heart',       '#F43F5E', NULL, TRUE),
('cat_seguros',        'Seguros & Proteção',              'expense', 'ShieldCheck', '#10B981', NULL, TRUE),
('cat_impostos_prof',   'Impostos & Exercício Profissional','expense', 'Receipt',    '#8B5CF6', NULL, TRUE),
('cat_educacao',       'Educação & Desenvolvimento',      'expense', 'GraduationCap','#A855F7', NULL, TRUE),
('cat_lazer',          'Lazer, Cultura & Viagens',        'expense', 'Plane',       '#F59E0B', NULL, TRUE),
('cat_sitio_resort',   'Imóveis de Lazer (Sítio/Resort)', 'expense', 'Trees',       '#84CC16', NULL, TRUE),
('cat_estilo_vida',    'Estilo de Vida & Tecnologia',     'expense', 'ShoppingBag', '#EC4899', NULL, TRUE),
('cat_outros',         'Outras Despesas',                 'expense', 'Tag',         '#64748B', NULL, TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color;

-- 2. SUBCATEGORIAS
INSERT INTO categories (id, name, type, icon, color, parent_id, is_shared) VALUES
-- --- MORADIA ---
('sub_condominio',        'Condomínio',                          'expense', 'Building2',    '#6366F1', 'cat_moradia', TRUE),
('sub_finan_imobi',       'Financiamento Imobiliário',           'expense', 'Home',         '#4F46E5', 'cat_moradia', TRUE),
('sub_agua',              'Conta de Água',                       'expense', 'Droplets',     '#0284C7', 'cat_moradia', TRUE),
('sub_luz',               'Conta de Luz',                        'expense', 'Zap',          '#EAB308', 'cat_moradia', TRUE),
('sub_gas',               'Conta de Gás',                        'expense', 'Flame',        '#F97316', 'cat_moradia', TRUE),
('sub_internet_tel',      'Internet e Telefonia',                'expense', 'Wifi',         '#06B6D4', 'cat_moradia', TRUE),
('sub_manut_casa',        'Manutenção da Casa',                  'expense', 'Wrench',       '#64748B', 'cat_moradia', TRUE),
('sub_cama_mesa_banho',   'Itens de Cama, Mesa e Banho',         'expense', 'Bed',          '#818CF8', 'cat_moradia', TRUE),
('sub_eletro_casa',       'Eletrônicos para Casa',               'expense', 'Tv',           '#6366F1', 'cat_moradia', TRUE),
('sub_arquiteto',         'Arquiteto & Projetos',                'expense', 'Compass',      '#4338CA', 'cat_moradia', TRUE),

-- --- TRANSPORTE & VEÍCULOS ---
('sub_gasolina',          'Gasolina e Combustível',              'expense', 'Fuel',         '#3B82F6', 'cat_transporte', TRUE),
('sub_manut_carro',       'Manutenção do Carro',                 'expense', 'Wrench',       '#2563EB', 'cat_transporte', TRUE),
('sub_finan_veicular',    'Financiamento Veicular',              'expense', 'Car',          '#1D4ED8', 'cat_transporte', TRUE),
('sub_ipva_licenc',       'IPVA e Licenciamento',                'expense', 'FileText',     '#1E40AF', 'cat_transporte', TRUE),
('sub_limpeza_carro',     'Limpeza e Lava-Rápido',               'expense', 'Sparkles',     '#60A5FA', 'cat_transporte', TRUE),

-- --- ALIMENTAÇÃO ---
('sub_supermercado',      'Supermercado',                        'expense', 'ShoppingCart', '#F97316', 'cat_alimentacao', TRUE),
('sub_padaria',           'Padaria',                             'expense', 'Croissant',    '#EA580C', 'cat_alimentacao', TRUE),
('sub_restaurantes',      'Restaurantes e Delivery',             'expense', 'UtensilsCrossed','#C2410C', 'cat_alimentacao', TRUE),

-- --- SAÚDE & CUIDADOS ---
('sub_remedios',          'Remédios e Farmácia',                 'expense', 'Pill',         '#F43F5E', 'cat_saude', TRUE),
('sub_consultas_medicas', 'Consultas Médicas',                   'expense', 'Stethoscope',  '#E11D48', 'cat_saude', TRUE),
('sub_exames_medicos',    'Exames Médicos',                      'expense', 'Activity',     '#BE123C', 'cat_saude', TRUE),
('sub_vacinas',           'Vacinas',                             'expense', 'Syringe',      '#FDA4AF', 'cat_saude', TRUE),
('sub_academia',          'Academia',                            'expense', 'Dumbbell',     '#FB7185', 'cat_saude', TRUE),
('sub_pilates',           'Pilates',                             'expense', 'HeartHandshake','#F43F5E', 'cat_saude', TRUE),
('sub_beach_tennis',      'Beach Tennis',                        'expense', 'Trophy',       '#E11D48', 'cat_saude', TRUE),
('sub_corridas',          'Corridas e Eventos Esportivos',       'expense', 'Footprints',   '#BE123C', 'cat_saude', TRUE),
('sub_psicologo',         'Psicólogo e Terapia',                 'expense', 'Brain',        '#E11D48', 'cat_saude', TRUE),
('sub_nutricionista',     'Nutricionista',                       'expense', 'Apple',        '#F43F5E', 'cat_saude', TRUE),
('sub_podologia',         'Podologia e Cuidados Pessoais',       'expense', 'Sparkles',     '#FB7185', 'cat_saude', TRUE),

-- --- SEGUROS & PROTEÇÃO ---
('sub_seguro_celular',    'Seguro de Celular',                   'expense', 'Smartphone',   '#10B981', 'cat_seguros', TRUE),
('sub_seguro_vida',       'Seguro de Vida',                      'expense', 'Shield',       '#059669', 'cat_seguros', TRUE),
('sub_seguro_carro',      'Seguro do Carro',                     'expense', 'Car',          '#047857', 'cat_seguros', TRUE),
('sub_seguro_casa',       'Seguro da Casa',                      'expense', 'Home',         '#065F46', 'cat_seguros', TRUE),
('sub_seguro_cartao',     'Seguro do Cartão de Crédito',         'expense', 'CreditCard',   '#34D399', 'cat_seguros', TRUE),

-- --- IMPOSTOS & EXERCÍCIO PROFISSIONAL ---
('sub_irpf',              'Imposto de Renda Pessoa Física (IRPF)','expense', 'FileSpreadsheet','#8B5CF6', 'cat_impostos_prof', TRUE),
('sub_irpj',              'Imposto de Renda Pessoa Jurídica (IRPJ)','expense','Building',     '#7C3AED', 'cat_impostos_prof', TRUE),
('sub_imposto_nfs',       'Imposto de Notas Fiscais',            'expense', 'Receipt',      '#6D28D9', 'cat_impostos_prof', TRUE),
('sub_contador',          'Pagamento de Contador',               'expense', 'Calculator',   '#5B21B6', 'cat_impostos_prof', TRUE),
('sub_cro',               'Pagamento de CRO (Anuidade)',         'expense', 'Award',        '#A78BFA', 'cat_impostos_prof', TRUE),
('sub_apcd',              'Pagamento de APCD (Associação)',      'expense', 'Users',        '#8B5CF6', 'cat_impostos_prof', TRUE),

-- --- EDUCAÇÃO & DESENVOLVIMENTO ---
('sub_faculdade',         'Faculdade',                           'expense', 'GraduationCap','#A855F7', 'cat_educacao', TRUE),
('sub_cursos',            'Cursos e Imersões',                   'expense', 'BookOpen',     '#9333EA', 'cat_educacao', TRUE),
('sub_estudos',           'Plataformas de Estudos',              'expense', 'Laptop',       '#7E22CE', 'cat_educacao', TRUE),
('sub_livros',            'Livros e Literatura',                 'expense', 'Book',         '#C084FC', 'cat_educacao', TRUE),

-- --- LAZER, CULTURA & VIAGENS ---
('sub_streaming',         'Streaming (HBO, Netflix, Disney+, etc.)','expense','Tv',          '#F59E0B', 'cat_lazer', TRUE),
('sub_cinema',            'Cinema',                              'expense', 'Film',         '#D97706', 'cat_lazer', TRUE),
('sub_teatro',            'Teatro e Espetáculos',                'expense', 'Ticket',       '#B45309', 'cat_lazer', TRUE),
('sub_viagens',           'Viagens, Passagens e Hospedagens',    'expense', 'Plane',        '#FBBF24', 'cat_lazer', TRUE),

-- --- IMÓVEIS DE LAZER (SÍTIO & RESORT) ---
('sub_sitio_manut',       'Manutenção e Reforma do Sítio',       'expense', 'Trees',        '#84CC16', 'cat_sitio_resort', TRUE),
('sub_resort_condo',      'Condomínio Resort de Férias',         'expense', 'Palmtree',     '#65A30D', 'cat_sitio_resort', TRUE),
('sub_resort_finan',      'Financiamento Resort de Férias',      'expense', 'Building2',    '#4D7C0F', 'cat_sitio_resort', TRUE),

-- --- ESTILO DE VIDA & TECNOLOGIA ---
('sub_eletronicos_pess',  'Eletrônicos Pessoais & Gadgets',      'expense', 'Laptop',       '#EC4899', 'cat_estilo_vida', TRUE),
('sub_vestuario',         'Vestuário e Calçados',                'expense', 'Shirt',        '#DB2777', 'cat_estilo_vida', TRUE),
('sub_acessorios',        'Acessórios e Joias',                  'expense', 'Gem',          '#BE185D', 'cat_estilo_vida', TRUE),
('sub_presentes',         'Presentes e Comemorações',            'expense', 'Gift',         '#F472B6', 'cat_estilo_vida', TRUE),
('sub_familia',           'Apoio Familiar e Outros',             'expense', 'Heart',        '#F472B6', 'cat_estilo_vida', TRUE)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  parent_id = EXCLUDED.parent_id;

-- 3. TAGS ÚTEIS PARA AGRUPAMENTO E FILTROS DE ASSINATURAS/RECORRÊNCIAS
INSERT INTO tags (id, name, color) VALUES
('tag_assinatura',  'Assinatura / Recorrência', '#8B5CF6'),
('tag_fixo',        'Gasto Fixo',               '#EF4444'),
('tag_pj',          'Pessoa Jurídica / CRO',     '#10B981')
ON CONFLICT (id) DO NOTHING;
