import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthModal from './AuthModal';
import { getSupabaseClient, getSupabaseCredentials } from '@/lib/supabase';

const mockClient = {
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    signInWithOtp: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    updateUser: vi.fn(),
  },
};

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
  getSupabaseCredentials: vi.fn(() => ({ url: 'https://x.supabase.co', anonKey: 'anon-key' })),
}));

const renderModal = (props: Partial<Parameters<typeof AuthModal>[0]> = {}) => {
  return render(
    <AuthModal
      isOpen
      onClose={vi.fn()}
      currentUser={null}
      onSessionChange={vi.fn()}
      {...props}
    />
  );
};

const byId = (id: string) => document.getElementById(id) as HTMLInputElement;
const submitForm = () => fireEvent.submit(document.querySelector('form') as HTMLFormElement);

beforeEach(() => {
  vi.mocked(getSupabaseClient).mockReturnValue(mockClient as any);
});

describe('AuthModal', () => {
  it('renderiza o formulário de login quando aberto', () => {
    renderModal();
    expect(screen.getByRole('heading', { level: 3, name: 'Autenticação Supabase' })).toBeInTheDocument();
    expect(byId('auth-login-email-input')).toBeInTheDocument();
    expect(byId('auth-login-password-input')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar na Conta/i })).toBeInTheDocument();
  });

  it('não renderiza nada quando fechado', () => {
    render(<AuthModal isOpen={false} onClose={vi.fn()} currentUser={null} />);
    expect(screen.queryByText('Autenticação')).not.toBeInTheDocument();
  });

  it('chama signInWithPassword ao enviar o login com sucesso', async () => {
    mockClient.auth.signInWithPassword.mockResolvedValue({
      data: { session: { user: { id: 'u1', email: 'a@b.com' } } },
      error: null,
    });
    const onSessionChange = vi.fn();
    renderModal({ onSessionChange });

    fireEvent.change(byId('auth-login-email-input'), { target: { value: 'a@b.com' } });
    fireEvent.change(byId('auth-login-password-input'), { target: { value: 'senha123' } });
    submitForm();

    await waitFor(() => expect(mockClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'senha123',
    }));
    await waitFor(() => expect(onSessionChange).toHaveBeenCalled());
  });

  it('exibe erro amigável para credenciais inválidas', async () => {
    mockClient.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    renderModal();

    fireEvent.change(byId('auth-login-email-input'), { target: { value: 'a@b.com' } });
    fireEvent.change(byId('auth-login-password-input'), { target: { value: 'errada' } });
    submitForm();

    await waitFor(() => expect(screen.getByText(/E-mail ou senha incorretos/i)).toBeInTheDocument());
  });

  it('valida campos obrigatórios no login', async () => {
    renderModal();
    submitForm();
    expect(mockClient.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByText(/preencha o e-mail e a senha/i)).toBeInTheDocument();
  });

  describe('cadastro', () => {
    const goSignUp = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));
    };

    it('valida senha mínima de 6 caracteres', async () => {
      renderModal();
      await goSignUp();

      fireEvent.change(byId('auth-signup-name-input'), { target: { value: 'Ana' } });
      fireEvent.change(byId('auth-signup-email-input'), { target: { value: 'ana@b.com' } });
      fireEvent.change(byId('auth-signup-password-input'), { target: { value: '123' } });
      fireEvent.change(byId('auth-signup-confirm-password-input'), { target: { value: '123' } });
      submitForm();

      expect(screen.getByText(/mínimo 6 caracteres/i)).toBeInTheDocument();
      expect(mockClient.auth.signUp).not.toHaveBeenCalled();
    });

    it('valida senhas diferentes', async () => {
      renderModal();
      await goSignUp();

      fireEvent.change(byId('auth-signup-email-input'), { target: { value: 'ana@b.com' } });
      fireEvent.change(byId('auth-signup-password-input'), { target: { value: 'senha123' } });
      fireEvent.change(byId('auth-signup-confirm-password-input'), { target: { value: 'senha456' } });
      submitForm();

      expect(screen.getByText(/não coincidem/i)).toBeInTheDocument();
    });

    it('chama signUp com nome e email', async () => {
      mockClient.auth.signUp.mockResolvedValue({
        data: { user: { id: 'u2' }, session: null },
        error: null,
      });
      renderModal();
      await goSignUp();

      fireEvent.change(byId('auth-signup-name-input'), { target: { value: 'Ana' } });
      fireEvent.change(byId('auth-signup-email-input'), { target: { value: 'ana@b.com' } });
      fireEvent.change(byId('auth-signup-password-input'), { target: { value: 'senha123' } });
      fireEvent.change(byId('auth-signup-confirm-password-input'), { target: { value: 'senha123' } });
      submitForm();

      await waitFor(() => expect(mockClient.auth.signUp).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByText(/e-mail de confirmação/i)).toBeInTheDocument());
    });
  });

  describe('recuperação de senha', () => {
    it('abre o formulário de recuperação ao clicar em Esqueceu a senha', async () => {
      renderModal();
      await userEvent.click(screen.getByRole('button', { name: /Esqueceu a senha/i }));
      expect(screen.getByText(/Digite o e-mail cadastrado/i)).toBeInTheDocument();
    });

    it('chama resetPasswordForEmail com o e-mail informado', async () => {
      mockClient.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
      renderModal();
      await userEvent.click(screen.getByRole('button', { name: /Esqueceu a senha/i }));

      fireEvent.change(byId('auth-forgot-email-input'), { target: { value: 'recupera@b.com' } });
      submitForm();

      await waitFor(() => expect(mockClient.auth.resetPasswordForEmail).toHaveBeenCalledWith('recupera@b.com', {
        redirectTo: window.location.origin,
      }));
      await waitFor(() => expect(screen.getByText(/Enviamos as instruções/i)).toBeInTheDocument());
    });

    it('exibe erro se faltar e-mail', async () => {
      renderModal();
      await userEvent.click(screen.getByRole('button', { name: /Esqueceu a senha/i }));
      submitForm();
      expect(screen.getByText(/Digite seu e-mail/i)).toBeInTheDocument();
    });
  });

  it('oferece botões de login social Google e GitHub', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /Google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GitHub/i })).toBeInTheDocument();
  });

  it('mostra aviso quando o Supabase não está configurado', () => {
    vi.mocked(getSupabaseCredentials).mockReturnValueOnce({ url: '', anonKey: '' });
    renderModal();
    expect(screen.getByText(/Credenciais Supabase Ausentes/i)).toBeInTheDocument();
  });
});