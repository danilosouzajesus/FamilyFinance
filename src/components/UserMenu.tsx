import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  User as UserIcon, 
  LogOut, 
  LogIn, 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  Sliders, 
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Key,
  HardDrive
} from 'lucide-react';
import { User } from '@supabase/supabase-js';

interface UserMenuProps {
  currentUser: User | null;
  supabaseConnected: boolean;
  isSyncing: boolean;
  onOpenAuthModal: () => void;
  onOpenSecuritySettings: () => void;
  onSignOut: () => void;
  onFetchFromSupabase: () => void;
  onExportBackup: () => void;
  onImportBackup: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function UserMenu({
  currentUser,
  supabaseConnected,
  isSyncing,
  onOpenAuthModal,
  onOpenSecuritySettings,
  onSignOut,
  onFetchFromSupabase,
  onExportBackup,
  onImportBackup
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef} id="user-menu-dropdown-wrapper">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 bg-slate-50 hover:bg-slate-100/90 active:bg-slate-200/80 border border-slate-200/80 rounded-xl transition-all shadow-2xs cursor-pointer"
        id="user-menu-trigger-btn"
        aria-label="Menu do Usuário"
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
          {currentUser ? (
            (currentUser.user_metadata?.full_name || currentUser.email || 'U')[0].toUpperCase()
          ) : (
            <UserIcon size={16} />
          )}
        </div>

        <div className="hidden md:flex flex-col text-left min-w-0 max-w-[120px]">
          <span className="text-xs font-bold text-slate-800 truncate leading-tight">
            {currentUser ? (currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]) : 'Usuário'}
          </span>
          <span className="text-[10px] text-slate-400 font-medium truncate">
            {currentUser ? 'Conectado' : 'Visitante'}
          </span>
        </div>

        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Hidden File Input for Backup Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={(e) => {
          onImportBackup(e);
          setIsOpen(false);
        }} 
        accept=".json" 
        className="hidden" 
      />

      {/* Dropdown Menu Overlay / Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Header Profile Info */}
          <div className="p-4 bg-gradient-to-br from-indigo-50/80 via-slate-50 to-white border-b border-slate-100">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm">
                  {currentUser ? (
                    (currentUser.user_metadata?.full_name || currentUser.email || 'U')[0].toUpperCase()
                  ) : (
                    <UserIcon size={20} />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-extrabold text-slate-900 truncate">
                    {currentUser ? (currentUser.user_metadata?.full_name || 'Conta Supabase') : 'Visitante (Modo Local)'}
                  </h4>
                  <p className="text-xs text-slate-500 truncate font-mono">
                    {currentUser ? currentUser.email : 'Sem login ativo'}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                supabaseConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {supabaseConnected ? 'Nuvem OK' : 'Local'}
              </span>
            </div>
          </div>

          {/* Quick Actions List */}
          <div className="p-2 space-y-1">
            
            {/* 1. Account / Auth */}
            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  onOpenAuthModal();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
              >
                <UserIcon size={16} className="text-indigo-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800">Minha Conta</p>
                  <p className="text-[10px] text-slate-400">Ver detalhes do perfil e sessão</p>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onOpenAuthModal();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors text-left shadow-xs cursor-pointer"
              >
                <LogIn size={16} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold">Entrar / Cadastrar</p>
                  <p className="text-[10px] text-indigo-100">Sincronize seus dados em qualquer dispositivo</p>
                </div>
              </button>
            )}

            {/* 2. Security & Privacy */}
            <button
              type="button"
              onClick={() => {
                onOpenSecuritySettings();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
              id="user-menu-security-btn"
            >
              <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-800">Segurança & Privacidade</p>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">Config</span>
                </div>
                <p className="text-[10px] text-slate-400">Políticas de privacidade, permissões e 2FA</p>
              </div>
            </button>

            {/* 3. Force Sync */}
            <button
              type="button"
              onClick={() => {
                onFetchFromSupabase();
                setIsOpen(false);
              }}
              disabled={isSyncing}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 transition-colors text-left cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={16} className={`text-emerald-600 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800">Sincronizar Agora</p>
                <p className="text-[10px] text-slate-400">Forçar atualização com banco de dados</p>
              </div>
            </button>

            <div className="my-1 border-t border-slate-100" />

            {/* 4. Backup Export */}
            <button
              type="button"
              onClick={() => {
                onExportBackup();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
            >
              <Download size={15} className="text-slate-500 shrink-0" />
              <span className="text-slate-800 font-medium">Exportar Backup (.json)</span>
            </button>

            {/* 5. Backup Import */}
            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
            >
              <Upload size={15} className="text-slate-500 shrink-0" />
              <span className="text-slate-800 font-medium">Importar Backup</span>
            </button>

            {currentUser && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    onSignOut();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                  id="user-menu-logout-btn"
                >
                  <LogOut size={16} className="shrink-0" />
                  <span>Sair da Conta</span>
                </button>
              </>
            )}
          </div>

          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-semibold text-center">
            FamilyFinance System
          </div>
        </div>
      )}
    </div>
  );
}
