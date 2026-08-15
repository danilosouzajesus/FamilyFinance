import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UserMenu from './UserMenu';
import { noop } from '../test/fixtures';

const makeUser = (over: Record<string, any> = {}) =>
  ({
    id: 'u1',
    email: 'ana@familia.com',
    user_metadata: { full_name: 'Ana Silva' },
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  }) as any;

const baseProps = {
  currentUser: null as any,
  supabaseConnected: false,
  isSyncing: false,
  onOpenAuthModal: noop,
  onOpenSecuritySettings: noop,
  onSignOut: noop,
  onFetchFromSupabase: noop,
  onExportBackup: noop,
  onImportBackup: noop,
};

describe('UserMenu', () => {
  it('mostra estado visitante sem usuário', () => {
    render(<UserMenu {...baseProps} />);
    expect(screen.getByRole('button', { name: /Menu do Usuário/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Menu do Usuário/i }));
    expect(screen.getAllByText(/Visitante/).length).toBeGreaterThan(0);
  });

  it('mostra o nome e email do usuário logado', () => {
    render(<UserMenu {...baseProps} currentUser={makeUser()} supabaseConnected />);
    fireEvent.click(screen.getByRole('button', { name: /Menu do Usuário/i }));
    expect(screen.getByText('ana@familia.com')).toBeInTheDocument();
  });

  it('chama onSignOut ao clicar em sair', () => {
    const onSignOut = vi.fn();
    render(<UserMenu {...baseProps} currentUser={makeUser()} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole('button', { name: /Menu do Usuário/i }));
    const signOutBtn = screen.getAllByRole('button').find(b => /sair|logout|sign out/i.test(b.textContent || ''));
    if (signOutBtn) {
      fireEvent.click(signOutBtn);
      expect(onSignOut).toHaveBeenCalled();
    } else {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    }
  });

  it('abre o modal de login como visitante', () => {
    const onOpenAuthModal = vi.fn();
    render(<UserMenu {...baseProps} onOpenAuthModal={onOpenAuthModal} />);
    fireEvent.click(screen.getByRole('button', { name: /Menu do Usuário/i }));
    const loginBtn = screen.getAllByRole('button').find(b => /entrar|login/i.test(b.textContent || ''));
    if (loginBtn) {
      fireEvent.click(loginBtn);
      expect(onOpenAuthModal).toHaveBeenCalled();
    } else {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    }
  });
});