import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SubscriptionsManager from './SubscriptionsManager';
import { makeSubscription, makeRule, makeCategory, makeMember, makeAccount, noop } from '@/test/fixtures';

const baseProps = {
  subscriptions: [] as any[],
  automationRules: [] as any[],
  categories: [] as any[],
  familyMembers: [] as any[],
  transactions: [] as any[],
  accounts: [] as any[],
  isPrivateMode: false,
  onAddSubscription: noop,
  onEditSubscription: noop,
  onEditSubscriptionWithScope: noop,
  onDeleteSubscription: noop,
  onAddRule: noop,
  onEditRule: noop,
  onDeleteRule: noop,
};

describe('SubscriptionsManager', () => {
  it('renderiza o gerenciador de assinaturas', () => {
    const { container } = render(<SubscriptionsManager {...baseProps} />);
    expect(container.querySelector('#subs-manager-container')).toBeTruthy();
  });

  it('lista as assinaturas cadastradas', () => {
    render(
      <SubscriptionsManager
        {...baseProps}
        subscriptions={[makeSubscription()]}
        categories={[makeCategory()]}
        familyMembers={[makeMember()]}
      />
    );
    expect(screen.getByText('Netflix')).toBeInTheDocument();
  });

  it('lista as regras de automação', () => {
    render(
      <SubscriptionsManager
        {...baseProps}
        automationRules={[makeRule({ conditionValue: 'iFood', actionValue: 'Alimentação' })]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Regras de Conciliação/i }));
    expect(screen.getByText(/iFood/)).toBeInTheDocument();
  });

  it('mostra o total anual de assinaturas', () => {
    render(<SubscriptionsManager {...baseProps} subscriptions={[makeSubscription({ amount: 39.9 })]} />);
    expect(screen.getAllByText(/R\$/).length).toBeGreaterThan(0);
  });

  it('mostra a conta de débito das mensalidades no card', () => {
    render(
      <SubscriptionsManager
        {...baseProps}
        accounts={[makeAccount({ id: 'a1', name: 'Banco Itaú', type: 'bank', balance: 5000 })]}
        subscriptions={[makeSubscription({ accountId: 'a1' })]}
      />
    );
    expect(screen.getByText('Conta de débito:')).toBeInTheDocument();
    expect(screen.getByText('Banco Itaú')).toBeInTheDocument();
  });

  it('lista a conta de débito no formulário de assinatura', () => {
    render(
      <SubscriptionsManager
        {...baseProps}
        accounts={[makeAccount({ id: 'a1', name: 'Banco Itaú', type: 'bank', balance: 5000 })]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar Assinatura/i }));
    expect(screen.getByText('Conta de Débito das Mensalidades')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Banco Itaú' })).toBeInTheDocument();
  });

  it('cria assinatura vinculada à conta de débito selecionada', () => {
    const onAddSubscription = vi.fn();
    render(
      <SubscriptionsManager
        {...baseProps}
        accounts={[makeAccount({ id: 'a1', name: 'Banco Itaú', type: 'bank', balance: 5000 })]}
        categories={[makeCategory()]}
        familyMembers={[makeMember()]}
        onAddSubscription={onAddSubscription}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar Assinatura/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Netflix, Academia/), { target: { value: 'Spotify' } });
    fireEvent.change(screen.getByPlaceholderText(/Ex: 55.90/), { target: { value: '21.90' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(onAddSubscription).toHaveBeenCalledTimes(1);
    expect(onAddSubscription.mock.calls[0][0].accountId).toBe('a1');
  });
});