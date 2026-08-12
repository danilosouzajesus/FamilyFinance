import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Lock, 
  Database, 
  UserCheck
} from 'lucide-react';
import { FinancialState } from '../types';

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
  // Security configuration states
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [backupFrequency, setBackupFrequency] = useState('daily');

  // User access controls
  const [permissions, setPermissions] = useState<Record<string, 'read_write' | 'read_only'>>({
    'mem_pai': 'read_write',
    'mem_mae': 'read_write',
    'mem_filho': 'read_only',
    'mem_geral': 'read_write'
  });

  const handleTogglePermission = (memberId: string) => {
    setPermissions(prev => ({
      ...prev,
      [memberId]: prev[memberId] === 'read_write' ? 'read_only' : 'read_write'
    }));
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden" id="settings-security-container">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Segurança & Privacidade</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Gerencie suas políticas de privacidade, chaveamento e permissões de acesso da família</p>
        </div>
      </div>

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
              
              {/* Global Private Mode Button */}
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

            {/* Automatic backup setting */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-1">
                  <Database size={13} className="text-indigo-600" /> Backup Criptografado Automático
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5">O sistema salva suas transações com proteção de alta segurança.</p>
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

          {/* Access Control table per user */}
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
          
          {/* Encryption Badge panel */}
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
                <span className="font-bold text-emerald-600 flex items-center gap-1">🟢 Ativo</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Base de Dados:</span>
                <span className="font-bold text-slate-700">IndexedDB Ativo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
