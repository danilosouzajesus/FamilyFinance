import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PasswordResetScreen from './PasswordResetScreen';
import { getSupabaseClient } from '@/lib/supabase';

const mockClient = {
  auth: {
    updateUser: vi.fn(),
  },
};

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
  getSupabaseCredentials: vi.fn(() => ({ url: 'https://x.supabase.co', anonKey: 'anon-key' })),
}));

const byId = (id: string) => document.getElementById(id) as HTMLInputElement;
const submitForm = () => fireEvent.submit(document.querySelector('form') as HTMLFormElement);

beforeEach(() => {
  vi.mocked(getSupabaseClient).mockReturnValue(mockClient as any);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PasswordResetScreen', () => {
  it('renderiza o formulário de nova senha', () => {
    render(<PasswordResetScreen onComplete={vi.fn()} onBackToLogin={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Definir Nova Senha' })).toBeInTheDocument();
    expect(byId('password-reset-new-input')).toBeInTheDocument();
    expect(byId('password-reset-confirm-input')).toBeInTheDocument();
  });

  it('valida senha mínima de 6 caracteres', async () => {
    render(<PasswordResetScreen onComplete={vi.fn()} onBackToLogin={vi.fn()} />);
    fireEvent.change(byId('password-reset-new-input'), { target: { value: '123' } });
    fireEvent.change(byId('password-reset-confirm-input'), { target: { value: '123' } });
    submitForm();
    expect(screen.getByText(/mínimo 6 caracteres/i)).toBeInTheDocument();
    expect(mockClient.auth.updateUser).not.toHaveBeenCalled();
  });

  it('valida senhas diferentes', async () => {
    render(<PasswordResetScreen onComplete={vi.fn()} onBackToLogin={vi.fn()} />);
    fireEvent.change(byId('password-reset-new-input'), { target: { value: 'senha123' } });
    fireEvent.change(byId('password-reset-confirm-input'), { target: { value: 'senha456' } });
    submitForm();
    expect(screen.getByText(/não coincidem/i)).toBeInTheDocument();
  });

  it('chama updateUser com a nova senha e chama onComplete após sucesso', async () => {
    vi.useFakeTimers();
    mockClient.auth.updateUser.mockResolvedValue({ data: {}, error: null });
    const onComplete = vi.fn();
    render(<PasswordResetScreen onComplete={onComplete} onBackToLogin={vi.fn()} />);

    fireEvent.change(byId('password-reset-new-input'), { target: { value: 'novaSenha123' } });
    fireEvent.change(byId('password-reset-confirm-input'), { target: { value: 'novaSenha123' } });
    submitForm();

    await act(async () => {});
    expect(mockClient.auth.updateUser).toHaveBeenCalledWith({ password: 'novaSenha123' });
    expect(screen.getByText(/Senha atualizada com sucesso/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(onComplete).toHaveBeenCalled();
  });

  it('exibe o erro retornado pelo Supabase', async () => {
    mockClient.auth.updateUser.mockResolvedValue({ data: {}, error: { message: 'Password should be at least 6 characters' } });
    render(<PasswordResetScreen onComplete={vi.fn()} onBackToLogin={vi.fn()} />);

    fireEvent.change(byId('password-reset-new-input'), { target: { value: 'abc12345' } });
    fireEvent.change(byId('password-reset-confirm-input'), { target: { value: 'abc12345' } });
    submitForm();

    await act(async () => {});
    expect(screen.getByText(/Password should be at least 6 characters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar Nova Senha/i })).toBeEnabled();
  });

  it('chama onBackToLogin ao clicar em voltar', () => {
    const onBackToLogin = vi.fn();
    render(<PasswordResetScreen onComplete={vi.fn()} onBackToLogin={onBackToLogin} />);
    fireEvent.click(screen.getByRole('button', { name: /Voltar para o login/i }));
    expect(onBackToLogin).toHaveBeenCalled();
  });
});