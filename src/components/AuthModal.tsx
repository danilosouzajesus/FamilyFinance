import React, { useState, useEffect } from 'react';
import { 
  LogIn, 
  UserPlus, 
  KeyRound, 
  Mail, 
  Lock, 
  User as UserIcon, 
  ArrowRight, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Shield, 
  Database, 
  LogOut,
  Send,
  ExternalLink
} from 'lucide-react';
import { getSupabaseClient, getSupabaseCredentials } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSessionChange?: (session: Session | null) => void;
  onOpenSettings?: () => void;
}

type AuthTab = 'sign_in' | 'sign_up' | 'forgot_password' | 'magic_link';

export default function AuthModal({
  isOpen,
  onClose,
  currentUser,
  onSessionChange,
  onOpenSettings
}: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>('sign_in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Quick credentials check
  const { url: supabaseUrl, anonKey: supabaseKey } = getSupabaseCredentials();
  const isSupabaseConfigured = !!supabaseUrl && !!supabaseKey;

  // Reset local state when tab changes
  useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [tab]);

  if (!isOpen) return null;

  // Sign In with Password
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMessage('O cliente Supabase não está configurado. Insira a URL e a Anon Key em Configurações.');
      return;
    }

    if (!email || !password) {
      setErrorMessage('Por favor, preencha o e-mail e a senha.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage('E-mail ou senha incorretos. Por favor, verifique e tente novamente.');
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMessage('O e-mail ainda não foi confirmado. Por favor, verifique sua caixa de entrada.');
        } else {
          setErrorMessage(error.message);
        }
        return;
      }

      setSuccessMessage('Login realizado com sucesso!');
      if (onSessionChange && data.session) {
        onSessionChange(data.session);
      }
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocorreu um erro ao fazer login.');
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up / Registration
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMessage('O cliente Supabase não está configurado.');
      return;
    }

    if (!email || !password) {
      setErrorMessage('Por favor, preencha o e-mail e a senha.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas digitadas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim() || undefined,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.user && !data.session) {
        setSuccessMessage('Conta criada com sucesso! Enviamos um e-mail de confirmação para ativar sua conta.');
      } else {
        setSuccessMessage('Conta criada e autenticada com sucesso!');
        if (onSessionChange && data.session) {
          onSessionChange(data.session);
        }
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocorreu um erro no cadastro.');
    } finally {
      setIsLoading(false);
    }
  };

  // Password Recovery
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMessage('O cliente Supabase não está configurado.');
      return;
    }

    if (!email) {
      setErrorMessage('Digite seu e-mail para receber o link de redefinição.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccessMessage(`Enviamos as instruções para ${email}. Verifique sua caixa de entrada e spam.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocorreu um erro ao enviar e-mail de recuperação.');
    } finally {
      setIsLoading(false);
    }
  };

  // Magic Link
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMessage('O cliente Supabase não está configurado.');
      return;
    }

    if (!email) {
      setErrorMessage('Digite seu e-mail para receber o Magic Link.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccessMessage(`Magic Link enviado para ${email}! Acesse sua caixa de entrada para entrar sem senha.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao solicitar Magic Link.');
    } finally {
      setIsLoading(false);
    }
  };

  // OAuth Provider Sign In (Google / GitHub)
  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMessage('O cliente Supabase não está configurado.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) setErrorMessage(error.message);
    } catch (err: any) {
      setErrorMessage(err.message || `Erro ao entrar com ${provider}.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Out
  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      if (onSessionChange) {
        onSessionChange(null);
      }
      setSuccessMessage('Sessão encerrada com sucesso.');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao sair.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
        id="auth-modal-container"
      >
        {/* Top Header Bar */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white px-6 py-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Fechar"
            id="close-auth-modal-btn"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/90 border border-indigo-400/30 flex items-center justify-center text-white shadow-lg shadow-indigo-900/50 shrink-0">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-xl tracking-tight text-white">
                Autenticação <span className="text-indigo-400">Supabase</span>
              </h3>
              <p className="text-xs text-indigo-200/80 font-medium mt-0.5">
                Controle de acesso seguro para a sua família
              </p>
            </div>
          </div>
        </div>

        {/* If user is ALREADY logged in */}
        {currentUser ? (
          <div className="p-6 space-y-6">
            <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                {(currentUser.user_metadata?.full_name || currentUser.email || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Conectado Atualmente</span>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {currentUser.user_metadata?.full_name || 'Usuário Supabase'}
                </p>
                <p className="text-xs text-slate-500 truncate font-mono">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-2xl space-y-2 text-xs text-slate-600">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                <span className="text-slate-400 font-medium">User ID:</span>
                <span className="font-mono text-[11px] text-slate-700 font-semibold truncate max-w-[180px]">{currentUser.id}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-medium">Último Login:</span>
                <span className="font-semibold text-slate-700">
                  {currentUser.last_sign_in_at ? new Date(currentUser.last_sign_in_at).toLocaleDateString('pt-BR') : 'Hoje'}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              id="auth-modal-sign-out-btn"
            >
              <LogOut size={16} />
              <span>{isLoading ? 'Saindo...' : 'Encerrar Sessão (Sair)'}</span>
            </button>
          </div>
        ) : (
          <div className="p-6">
            {/* Supabase Disconnected Warning */}
            {!isSupabaseConfigured && (
              <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertCircle size={16} className="text-amber-600 shrink-0" />
                  <span>Credenciais Supabase Ausentes</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800/90">
                  Para realizar login ou cadastro real, é necessário inserir a URL e a Anon Key do Supabase.
                </p>
                {onOpenSettings && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-[11px] transition-colors cursor-pointer"
                  >
                    <Database size={13} />
                    <span>Configurar Credenciais Agora</span>
                  </button>
                )}
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-2xl mb-6 text-xs font-bold">
              <button
                onClick={() => setTab('sign_in')}
                className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${tab === 'sign_in' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                id="auth-tab-sign-in"
              >
                Entrar
              </button>
              <button
                onClick={() => setTab('sign_up')}
                className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${tab === 'sign_up' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                id="auth-tab-sign-up"
              >
                Cadastrar
              </button>
              <button
                onClick={() => setTab('magic_link')}
                className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${tab === 'magic_link' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                id="auth-tab-magic-link"
              >
                Magic Link
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successMessage}</span>
              </div>
            )}

            {/* SIGN IN FORM */}
            {tab === 'sign_in' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      id="auth-login-email-input"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setTab('forgot_password')}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      id="auth-login-password-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  id="auth-login-submit-btn"
                >
                  <LogIn size={16} />
                  <span>{isLoading ? 'Autenticando...' : 'Entrar na Conta'}</span>
                </button>
              </form>
            )}

            {/* SIGN UP FORM */}
            {tab === 'sign_up' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <UserIcon size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: Carlos Silva"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      id="auth-signup-name-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      id="auth-signup-email-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      id="auth-signup-password-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a mesma senha"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      id="auth-signup-confirm-password-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  id="auth-signup-submit-btn"
                >
                  <UserPlus size={16} />
                  <span>{isLoading ? 'Criando Conta...' : 'Criar Nova Conta'}</span>
                </button>
              </form>
            )}

            {/* MAGIC LINK FORM */}
            {tab === 'magic_link' && (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Digite seu e-mail e enviaremos um link de acesso direto. Você poderá entrar com 1 clique, sem precisar de senha.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Seu E-mail
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      id="auth-magiclink-email-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  id="auth-magiclink-submit-btn"
                >
                  <Send size={16} />
                  <span>{isLoading ? 'Enviando...' : 'Enviar Magic Link'}</span>
                </button>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {tab === 'forgot_password' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Digite o e-mail cadastrado e enviaremos o link de recuperação para definir uma nova senha.
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    E-mail Cadastrado
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      id="auth-forgot-email-input"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTab('sign_in')}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <KeyRound size={16} />
                    <span>{isLoading ? 'Enviando...' : 'Enviar Instruções'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* OAuth Dividers & Social Logins */}
            {(tab === 'sign_in' || tab === 'sign_up') && (
              <div className="mt-6 pt-5 border-t border-slate-200/60 space-y-3">
                <div className="text-center text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  Ou acesse com sua conta social
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('google')}
                    className="py-2.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
                      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                      <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"/>
                      <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
                    </svg>
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('github')}
                    className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    <span>GitHub</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
