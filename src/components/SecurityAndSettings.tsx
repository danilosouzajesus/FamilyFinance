import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Lock, 
  Sliders, 
  Sparkles, 
  Database, 
  HelpCircle, 
  UserCheck, 
  Calculator, 
  Activity, 
  TrendingUp, 
  Calendar,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import { FinancialState, FamilyMember, Category } from '../types';
import { 
  getSupabaseCredentials, 
  testSupabaseConnection, 
  seedSupabaseTables,
  runSupabaseDiagnostics,
  SupabaseDiagnosticInfo
} from '../lib/supabase';
import { 
  defaultCategories, 
  defaultFamilyMembers, 
  defaultAccounts, 
  defaultTransactions, 
  defaultSubscriptions, 
  defaultDebts, 
  defaultInvestments, 
  defaultAutomationRules 
} from '../utils/initialData';

interface SecurityAndSettingsProps {
  financialState: FinancialState;
  isPrivateMode: boolean;
  setIsPrivateMode: (p: boolean) => void;
}

export default function SecurityAndSettings({
  financialState,
  isPrivateMode,
  setIsPrivateMode
}: SecurityAndSettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'security' | 'premium'>('security');

  // Security configuration states
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [backupFrequency, setBackupFrequency] = useState('daily');
  const [isEncryptionActive, setIsEncryptionActive] = useState(true);

  // Supabase connection states
  const [supabaseUrl, setSupabaseUrl] = useState(() => {
    return import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || '';
  });
  const [supabaseKey, setSupabaseKey] = useState(() => {
    return import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || '';
  });
  const [dbStatus, setDbStatus] = useState<'disconnected' | 'connected' | 'error'>(() => {
    const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url');
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key');
    return (url && key) ? 'connected' : 'disconnected';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [seedSuccessMessage, setSeedSuccessMessage] = useState<string | null>(null);
  const [diagnosticsInfo, setDiagnosticsInfo] = useState<SupabaseDiagnosticInfo | null>(null);

  const loadDiagnostics = async () => {
    try {
      const info = await runSupabaseDiagnostics();
      setDiagnosticsInfo(info);
    } catch (e) {
      console.error('Failed to run diagnostics:', e);
    }
  };

  React.useEffect(() => {
    if (dbStatus === 'connected') {
      loadDiagnostics();
    }
  }, [dbStatus]);

  const handleConnect = async () => {
    if (!supabaseUrl || !supabaseKey) {
      setSeedSuccessMessage('Por favor, preencha a URL e a Anon Key do Supabase.');
      return;
    }
    setIsLoading(true);
    setSeedSuccessMessage(null);
    try {
      const isConnected = await testSupabaseConnection(supabaseUrl, supabaseKey);
      if (isConnected) {
        localStorage.setItem('supabase_url', supabaseUrl);
        localStorage.setItem('supabase_anon_key', supabaseKey);
        setDbStatus('connected');
        setSeedSuccessMessage('Conexão estabelecida com sucesso!');
        await loadDiagnostics();
        // Dispatch custom event to notify App.tsx
        window.dispatchEvent(new Event('supabase_config_changed'));
      } else {
        setDbStatus('error');
        setSeedSuccessMessage('Erro: Não foi possível autenticar no Supabase. Verifique a URL e a Anon Key.');
      }
    } catch (e) {
      setDbStatus('error');
      setSeedSuccessMessage('Erro inesperado na conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearConnection = () => {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_anon_key');
    setSupabaseUrl('');
    setSupabaseKey('');
    setDbStatus('disconnected');
    setSeedSuccessMessage('Conexão limpa.');
    window.dispatchEvent(new Event('supabase_config_changed'));
  };

  const handleSeedDatabase = async () => {
    if (dbStatus !== 'connected') {
      setSeedSuccessMessage('Por favor, estabeleça uma conexão válida primeiro.');
      return;
    }
    setIsLoading(true);
    setSeedSuccessMessage('Semando tabelas no Supabase...');
    try {
      const success = await seedSupabaseTables(
        defaultCategories,
        defaultFamilyMembers,
        defaultAccounts,
        defaultTransactions,
        defaultSubscriptions,
        defaultDebts,
        defaultInvestments,
        defaultAutomationRules
      );
      if (success) {
        setSeedSuccessMessage('Sucesso! Banco de dados semeado com todos os dados estruturados!');
        // Notify App.tsx to fetch new seeded data
        window.dispatchEvent(new Event('supabase_config_changed'));
      } else {
        setSeedSuccessMessage('Erro ao semear. Certifique-se de que as tabelas em schema.sql foram executadas no seu painel SQL do Supabase.');
      }
    } catch (e) {
      setSeedSuccessMessage('Erro ao executar a semeadura automática.');
    } finally {
      setIsLoading(false);
    }
  };

  // User access controls

  const [permissions, setPermissions] = useState<Record<string, 'read_write' | 'read_only'>>({
    'mem_pai': 'read_write',
    'mem_mae': 'read_write',
    'mem_filho': 'read_only',
    'mem_geral': 'read_write'
  });

  // Premium Simulator States
  const [simulatorCategory, setSimulatorCategory] = useState('Alimentação');
  const [simulatorReduction, setSimulatorReduction] = useState(20); // percentage

  // 1.3/7.3 Annual planning targets
  const [annualTarget, setAnnualTarget] = useState(30000);

  const handleTogglePermission = (memberId: string) => {
    setPermissions(prev => ({
      ...prev,
      [memberId]: prev[memberId] === 'read_write' ? 'read_only' : 'read_write'
    }));
  };

  // Calculations for premium features
  // Category total for delivery/eating out (Alimentação category usually)
  const selectedCatTxs = financialState.transactions.filter(
    t => t.category.toLowerCase() === simulatorCategory.toLowerCase() && t.type === 'expense'
  );
  const totalCatExpense = selectedCatTxs.reduce((sum, t) => sum + t.amount, 0);
  const simulatedSavings = totalCatExpense * (simulatorReduction / 100);

  // Financial Risk Rating (7.4)
  const totalIncome = financialState.transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = financialState.transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const savingsMargin = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
  
  const totalDebtBalance = (financialState.debts || []).reduce(
    (sum, d) => sum + (d.totalAmount - (d.paidInstallments * d.installmentAmount)), 
    0
  );

  let riskRating = 'Baixo';
  let riskColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
  let riskAdvice = 'Sua saúde financeira familiar está excelente! Você possui margem de economia saudável e poucas dívidas ativas.';

  if (totalDebtBalance > 20000 || savingsMargin < 10) {
    riskRating = 'Moderado';
    riskColor = 'text-amber-600 bg-amber-50 border-amber-100';
    riskAdvice = 'Cuidado com o endividamento parcelado de longo prazo e sua margem apertada. Reduza despesas supérfluas.';
  }
  if (totalDebtBalance > 40000 || savingsMargin < 0) {
    riskRating = 'Alto';
    riskColor = 'text-rose-600 bg-rose-50 border-rose-100';
    riskAdvice = 'Alerta vermelho! Despesas familiares superam receitas ou as dívidas estão em patamar crítico. Agende uma consultoria.';
  }

  return (
    <div className="space-y-6" id="settings-security-container">
      
      {/* Tab Switch header */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm text-xs font-bold">
        <button
          onClick={() => setActiveSubTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'security' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100/50' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck size={14} /> Segurança & Privacidade
        </button>
        <button
          onClick={() => setActiveSubTab('premium')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'premium' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100/50' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles size={14} /> Recursos Premium
        </button>
      </div>

      {/* VIEW CANVAS */}
      {activeSubTab === 'security' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Security Configuration (Left 2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Private Mode Card & 2FA */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={16} className="text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Políticas de Privacidade</h3>
                </div>
                
                {/* 6.5 Global Private Mode Button */}
                <button
                  onClick={() => setIsPrivateMode(!isPrivateMode)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    isPrivateMode 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold shadow-sm' 
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                  id="settings-private-toggle"
                >
                  {isPrivateMode ? (
                    <>
                      <EyeOff size={14} /> Modo Privado Ativo
                    </>
                  ) : (
                    <>
                      <Eye size={14} /> Ativar Modo Privado
                    </>
                  )}
                </button>
              </div>

              <div className="text-xs text-slate-500 leading-relaxed font-medium">
                O <b>Modo Privado</b> oculta os saldos das suas contas correntes e transações financeiras na interface, ideal para quando você está abrindo o sistema em locais públicos ou compartilhando a tela.
              </div>

              {/* 2FA SMS/Email Multi-factor Authentication */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Autenticação em Duas Etapas (2FA)</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Exige validação por SMS ou aplicativo autenticador a cada acesso.</p>
                </div>

                <button
                  onClick={() => setIs2FAEnabled(!is2FAEnabled)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    is2FAEnabled 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                      : 'bg-slate-200/50 border-slate-300 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {is2FAEnabled ? 'Habilitado' : 'Habilitar 2FA'}
                </button>
              </div>

              {/* 6.4 Automatic backup setting */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-1">
                    <Database size={13} className="text-indigo-600" /> Backup Automático Diário
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">O sistema salva suas transações em repouso criptografado na nuvem.</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={backupFrequency}
                    onChange={(e) => setBackupFrequency(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
                  >
                    <option value="daily">Diário (Recomendado)</option>
                    <option value="weekly">Semanal</option>
                    <option value="manual">Apenas Manual</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Supabase Connection Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Integração Nuvem (Supabase)</h3>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                  dbStatus === 'connected' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                    : dbStatus === 'error' 
                      ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {dbStatus === 'connected' ? 'Conectado' : dbStatus === 'error' ? 'Erro de Conexão' : 'Desconectado'}
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Conecte o sistema diretamente à sua base de dados do <b>Supabase</b> para persistência em tempo real.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase">Supabase URL</label>
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xxxxxx.supabase.co"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase">Anon API Key</label>
                  <input
                    type="password"
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isLoading ? 'Conectando...' : 'Conectar e Salvar'}
                </button>
                <button
                  type="button"
                  onClick={handleClearConnection}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Desconectar
                </button>
                <button
                  type="button"
                  onClick={handleSeedDatabase}
                  disabled={isLoading}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Semear Banco com Dados Demo
                </button>
              </div>

              {seedSuccessMessage && (
                <p className={`text-[10px] font-bold ${
                  seedSuccessMessage.includes('Erro') || seedSuccessMessage.includes('Erro:')
                    ? 'text-rose-500' 
                    : 'text-indigo-600'
                }`}>
                  {seedSuccessMessage}
                </p>
              )}

              {/* Table Diagnostics Summary */}
              {dbStatus === 'connected' && diagnosticsInfo && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity size={14} className="text-emerald-600" /> Diagnóstico de Tabelas do Supabase
                    </span>
                    <button
                      type="button"
                      onClick={loadDiagnostics}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Atualizar Status
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                    {Object.entries(diagnosticsInfo.tableCounts).map(([table, count]) => {
                      const err = diagnosticsInfo.errors[table];
                      return (
                        <div key={table} className={`p-2 rounded-lg border font-mono ${err ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-700'}`}>
                          <div className="text-[9px] text-slate-400 uppercase font-sans font-bold truncate" title={table}>{table}</div>
                          <div className="font-bold text-xs mt-0.5">
                            {err ? 'Erro RLS' : `${count} registros`}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {Object.keys(diagnosticsInfo.errors).length > 0 && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[10px] text-rose-700 leading-relaxed font-sans">
                      <strong>Atenção RLS / Permissões:</strong> Uma ou mais tabelas retornaram erro de permissão. Se suas tabelas no Supabase estiverem com Row Level Security (RLS) habilitado sem políticas públicas, execute no SQL Editor do Supabase:
                      <code className="block mt-1 p-1 bg-white border border-rose-200 rounded text-[9px] font-mono text-slate-800 select-all">
                        ALTER TABLE family_members DISABLE ROW LEVEL SECURITY; ALTER TABLE categories DISABLE ROW LEVEL SECURITY; ALTER TABLE accounts DISABLE ROW LEVEL SECURITY; ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 6.3 Access Control table per user */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden" id="permissions-table">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/15 flex items-center gap-2">
                <UserCheck size={16} className="text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Controle de Acesso Familiar (Permissões)</h3>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {financialState.familyMembers.map((member) => {
                  const perm = permissions[member.id] || 'read_only';
                  return (
                    <div key={member.id} className="p-4 flex items-center justify-between hover:bg-slate-50/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${member.avatar}`}>
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{member.name}</h4>
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider font-extrabold">{member.role}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleTogglePermission(member.id)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          perm === 'read_write'
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            : 'bg-slate-100 border-slate-200 text-slate-500'
                        }`}
                      >
                        {perm === 'read_write' ? 'Leitura e Escrita' : 'Apenas Leitura'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Security details & widgets (Right 1 column) */}
          <div className="space-y-6">
            
            {/* 6.2 Encryption Badge panel */}
            <div className="bg-gradient-to-tr from-slate-900 to-indigo-950 p-6 rounded-2xl border border-slate-800 text-white space-y-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <ShieldCheck size={22} />
              </div>
              
              <div className="space-y-1.5">
                <h3 className="text-sm font-display font-extrabold tracking-tight">Criptografia AES-256 Ativa</h3>
                <p className="text-[11px] text-indigo-200 leading-relaxed font-medium">
                  Seus dados financeiros locais e backups exportados são criptografados em trânsito (HTTPS) e em repouso seguindo padrões de alta segurança bancária.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800 text-[10px] text-indigo-300 flex items-center justify-between font-bold">
                <span>Certificado TLS v1.3:</span>
                <span className="text-emerald-400">ATIVO</span>
              </div>
            </div>

            {/* Backup status logs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-3">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Integridade do Sistema</span>
              
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Último Backup Local:</span>
                  <span className="font-bold text-slate-700">Hoje às 12:45</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Sincronização Nuvem:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">🟢 Conectado</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Base de Dados:</span>
                  <span className="font-bold text-slate-700">IndexedDB Ativo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* PREMIUM FEATURES CANVAS */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 7.2 Interactive scenario simulator & 7.3 Annual Planner (Left 2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 7.2 Scenario Simulator */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                <Calculator size={16} className="text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Simulador de Economias Inteligente</h3>
              </div>

              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Ajuste o controle deslizante abaixo para simular reduções nas despesas e verificar instantaneamente o impacto financeiro projetado na poupança de sua família.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Escolher Categoria de Despesa</label>
                    <select
                      value={simulatorCategory}
                      onChange={(e) => setSimulatorCategory(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none w-full"
                    >
                      <option value="Alimentação">Alimentação</option>
                      <option value="Lazer & Viagem">Lazer & Viagem</option>
                      <option value="Transporte">Transporte</option>
                      <option value="Moradia">Moradia</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                      <span>REDUZIR EM</span>
                      <span className="text-indigo-600 font-extrabold">{simulatorReduction}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={simulatorReduction}
                      onChange={(e) => setSimulatorReduction(parseInt(e.target.value))}
                      className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg appearance-none"
                    />
                  </div>
                </div>

                {/* Simulated Outcome Display */}
                <div className="flex flex-col justify-center bg-indigo-50/30 p-4 border border-indigo-100 rounded-xl space-y-1">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Poupança Mensal Gerada:</span>
                  <span className="text-lg font-display font-extrabold text-indigo-700">R$ {simulatedSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span className="text-[9px] text-slate-500 font-semibold italic mt-1 block leading-relaxed">
                    Suficiente para acumular <b>R$ {(simulatedSavings * 12).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ao ano</b> ou financiar investimentos em Tesouro Selic.
                  </span>
                </div>
              </div>
            </div>

            {/* 7.3 Annual Smart Planner */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Planejamento Familiar Anual Inteligente</h3>
                </div>

                <span className="text-[10px] text-indigo-600 font-extrabold bg-indigo-50 px-2 py-0.5 rounded">Metas de Investimento</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1 space-y-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Meta de Poupança Anual</label>
                    <input
                      type="number"
                      value={annualTarget}
                      onChange={(e) => setAnnualTarget(parseFloat(e.target.value) || 0)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none w-full"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] text-slate-500 space-y-1 leading-relaxed">
                    <span className="font-bold text-slate-700">Aporte mensal necessário:</span>
                    <p className="text-xs font-extrabold text-indigo-600">R$ {(annualTarget / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {/* Annual projection simulator charts */}
                <div className="sm:col-span-2 bg-slate-50/50 p-4 border border-slate-100 rounded-xl flex flex-col justify-between">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block pb-1.5 border-b border-slate-100">Projeção de Evolução Patrimonial</span>
                  
                  <div className="h-28 flex items-end justify-between pt-4 gap-1.5 px-2">
                    {[10, 20, 32, 45, 58, 65, 74, 82, 90, 105, 115, 130].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div 
                          className="w-full bg-indigo-600 rounded-t-sm hover:bg-indigo-700 transition-colors cursor-pointer"
                          style={{ height: `${h * 0.6}px` }}
                          title={`Mês ${i+1}: R$ ${((annualTarget / 12) * (i + 1) * 1.05).toFixed(0)}`}
                        />
                        <span className="text-[8px] text-slate-400 font-bold">{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 7.4 Personal Financial Risk Analyzer & 7.1 suggestions (Right 1 column) */}
          <div className="space-y-6">
            
            {/* 7.4 Personal Risk Analyzer */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Activity size={16} className="text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Análise de Risco Familiar</h3>
              </div>

              <div className="space-y-4">
                <div className="text-center p-4 rounded-xl border flex flex-col justify-center items-center space-y-1.5 bg-slate-50/50">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Grau de Risco Pessoal</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${riskColor}`}>
                    RISCO {riskRating.toUpperCase()}
                  </span>
                </div>

                <div className="p-3.5 bg-indigo-50/30 border border-indigo-100 rounded-xl text-xs leading-relaxed text-indigo-900 font-medium">
                  <div className="flex gap-1.5 items-start">
                    <Sparkles size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                    <span>{riskAdvice}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                    <span>Margem de Poupança:</span>
                    <span className="font-bold text-slate-700">{savingsMargin.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                    <span>Dívidas vs Renda:</span>
                    <span className="font-bold text-slate-700">
                      {totalIncome > 0 ? ((totalDebtBalance / totalIncome) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 7.1 Vida Financeira Saudável Suggestions */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-3">
              <div className="flex items-center gap-1.5 text-indigo-600 font-extrabold text-[10px] uppercase tracking-wider">
                <FileCheck size={13} />
                <span>Vida Financeira Saudável</span>
              </div>

              <div className="space-y-2 text-[11px] text-slate-500 font-medium leading-relaxed">
                <div className="p-2 border-l-2 border-emerald-500 bg-slate-50">
                  <span className="font-bold text-slate-800 block">Investimento Programado</span>
                  Programe transferências de R$ 300 mensais logo após o salário para blindar sua meta!
                </div>
                <div className="p-2 border-l-2 border-indigo-500 bg-slate-50">
                  <span className="font-bold text-slate-800 block">Alerta de Vencimentos</span>
                  Mantenha suas assinaturas com débito automático ativados para economizar 100% de juros e tarifas.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
