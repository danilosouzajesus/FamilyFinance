import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Reports from './Reports';
import { makeTx, makeCategory, makeAccount, makeMember, makeSubscription, makeDebt, noop } from '@/test/fixtures';
import { Invoice, CreditCard } from '@ff/shared';

const baseProps = {
  transactions: [] as any[],
  categories: [] as any[],
  accounts: [] as any[],
  familyMembers: [] as any[],
  isPrivateMode: false,
};

describe('Reports', () => {
  it('renderiza o título principal', () => {
    render(<Reports {...baseProps} />);
    expect(screen.getByText(/Relatórios Financeiros/)).toBeInTheDocument();
  });

  it('exibe totais de receitas e despesas', () => {
    render(
      <Reports
        {...baseProps}
        transactions={[
          makeTx({ id: 't1', type: 'income', amount: 5000 }),
          makeTx({ id: 't2', type: 'expense', amount: 1000 }),
        ]}
      />
    );
    expect(screen.getAllByText(/R\$/).length).toBeGreaterThan(0);
  });

  it('renderiza com categorias, contas e membros', () => {
    const { container } = render(
      <Reports
        {...baseProps}
        transactions={[makeTx()]}
        categories={[makeCategory()]}
        accounts={[makeAccount()]}
        familyMembers={[makeMember()]}
        subscriptions={[makeSubscription()]}
        debts={[makeDebt()]}
      />
    );
    expect(container).not.toBeEmptyDOMElement();
  });

  it('exibe a taxa de poupança', () => {
    render(
      <Reports
        {...baseProps}
        transactions={[
          makeTx({ id: 't1', type: 'income', amount: 1000 }),
          makeTx({ id: 't2', type: 'expense', amount: 400 }),
        ]}
      />
    );
    expect(screen.getByText(/60[.,]0%/)).toBeInTheDocument();
  });

  it('abre a aba Cartão de Crédito e mostra gastos e faturas', () => {
    const card: CreditCard = { id: 'card1', name: 'Nubank Final', limitAmount: 5000, closingDay: 10, dueDay: 5, accountId: 'a1' };
    const inv: Invoice = {
      id: 'inv1', creditCardId: 'card1', year: 2026, month: 8,
      closingDate: '2026-08-10', dueDate: '2026-09-05', status: 'OPEN', totalAmount: 120,
    };
    render(
      <Reports
        {...baseProps}
        creditCards={[card]}
        invoices={[inv]}
        transactions={[
          makeTx({ id: 't1', creditCardId: 'card1', invoiceId: 'inv1', amount: 120 }),
        ]}
      />
    );
    fireEvent.click(screen.getByText('Cartão de Crédito'));
    expect(screen.getByText('Gastos no Cartão por Categoria')).toBeInTheDocument();
    expect(screen.getByText('Faturas Ativas')).toBeInTheDocument();
    expect(screen.getByText('Nubank Final • 8/2026')).toBeInTheDocument();
  });

  it('mostra estado vazio no cartão sem faturas', () => {
    render(<Reports {...baseProps} creditCards={[]} invoices={[]} />);
    fireEvent.click(screen.getByText('Cartão de Crédito'));
    expect(screen.getByText('Nenhuma fatura ativa.')).toBeInTheDocument();
  });
});