import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from './Dashboard';
import { Transaction, Account, Budget, Goal, Category, Subscription, Invoice, CreditCard } from '@ff/shared';

const baseProps = {
  transactions: [] as Transaction[],
  accounts: [] as Account[],
  budgets: [] as Budget[],
  goals: [] as Goal[],
  categories: [] as Category[],
  setActiveView: () => {},
};

describe('Dashboard', () => {
  it('renderiza com dados vazios sem quebrar', () => {
    render(<Dashboard {...baseProps} />);
    expect(screen.getByText('Saldo Consolidado')).toBeInTheDocument();
  });

  it('exibe o saldo das contas', () => {
    render(
      <Dashboard
        {...baseProps}
        accounts={[{ id: 'a1', name: 'Banco', type: 'bank', balance: 1250.5, color: 'blue-500' }]}
      />
    );
    expect(screen.getByText('Contas e Saldos')).toBeInTheDocument();
    expect(screen.getByText('Banco')).toBeInTheDocument();
  });

  it('soma receitas e despesas do mês', () => {
    const tx: Transaction = {
      id: 't1', type: 'expense', categoryId: 'c1', category: 'Mercado', subcategory: '', tagIds: [],
      amount: 100, date: new Date().toISOString().slice(0, 10), recurring: 'none', notes: '',
      memberId: 'm1', accountId: 'a1', attachmentUrls: [], attachmentNames: [], status: 'REALIZADO',
    };
    render(<Dashboard {...baseProps} transactions={[tx]} />);
    expect(screen.getByText('Saldo Consolidado')).toBeInTheDocument();
  });

  it('REGRESSÃO: não quebra quando billingDate é número (coluna INT do banco)', () => {
    const sub: Subscription = {
      id: 's1', name: 'Netflix', amount: 39.9, frequency: 'monthly', category: 'Streaming',
      billingDate: 22 as unknown as string, autoNotify: true, memberId: 'm1',
    };
    render(<Dashboard {...baseProps} subscriptions={[sub]} />);
    expect(screen.getByText('Saldo Consolidado')).toBeInTheDocument();
  });

  it('exibe resumo de faturas de cartão em aberto', () => {
    const inv: Invoice = {
      id: 'inv1', creditCardId: 'card1', year: 2026, month: 8,
      closingDate: '2026-08-10', dueDate: '2026-09-05', status: 'OPEN', totalAmount: 500,
    };
    const card: CreditCard = { id: 'card1', name: 'Nubank Final', limitAmount: 5000, closingDay: 10, dueDay: 5, accountId: 'a1' };
    render(<Dashboard {...baseProps} invoices={[inv]} creditCards={[card]} />);
    expect(screen.getByText('Faturas em Aberto')).toBeInTheDocument();
    expect(screen.getByText('Faturas de Cartão')).toBeInTheDocument();
    expect(screen.getByText('Nubank Final')).toBeInTheDocument();
    expect(screen.getByText('Aberta')).toBeInTheDocument();
  });

  it('destaca fatura em atraso no resumo', () => {
    const inv: Invoice = {
      id: 'inv1', creditCardId: 'card1', year: 2026, month: 7,
      closingDate: '2026-07-20', dueDate: '2026-07-27', status: 'OVERDUE', totalAmount: 300,
    };
    render(<Dashboard {...baseProps} invoices={[inv]} creditCards={[{ id: 'card1', name: 'Nubank', limitAmount: 5000, closingDay: 20, dueDay: 27, accountId: 'a1' }]} />);
    expect(screen.getByText('Em atraso')).toBeInTheDocument();
  });

  it('não renderiza seção de faturas quando não há faturas ativas', () => {
    const inv: Invoice = {
      id: 'inv1', creditCardId: 'card1', year: 2026, month: 8,
      closingDate: '2026-08-10', dueDate: '2026-09-05', status: 'PAID', totalAmount: 0,
    };
    render(<Dashboard {...baseProps} invoices={[inv]} />);
    expect(screen.queryByText('Faturas de Cartão')).not.toBeInTheDocument();
  });

  it('mostra quanto do saldo consolidado está reservado em metas', () => {
    render(
      <Dashboard
        {...baseProps}
        accounts={[{ id: 'a1', name: 'Banco', type: 'bank', balance: 2000, color: 'blue-500' }]}
        goals={[{ id: 'g1', name: 'Reserva', targetAmount: 5000, currentAmount: 500, deadline: '2026-12-31', color: 'emerald-500' }]}
      />
    );
    expect(screen.getByText('Reservado em metas')).toBeInTheDocument();
    const reservedBlock = screen.getByText('Reservado em metas').closest('div');
    expect(reservedBlock?.textContent).toMatch(/500,00/);
    expect(reservedBlock?.textContent).toMatch(/25%/);
  });

  it('mostra as próximas parcelas de dívidas e financiamentos', () => {
    render(
      <Dashboard
        {...baseProps}
        debts={[
          {
            id: 'd1', name: 'Financiamento do carro', totalAmount: 10000, installmentsCount: 12,
            installmentAmount: 833.33, interestRate: 1.5, nextDueDate: '2026-09-01', category: 'Veículo',
            paidInstallments: 2, accountId: 'a1',
          },
        ]}
      />
    );
    expect(screen.getByText('Próximos Compromissos')).toBeInTheDocument();
    expect(screen.getByText('Financiamento do carro')).toBeInTheDocument();
    expect(screen.getByText(/10 parcelas restantes/)).toBeInTheDocument();
    const installmentsCard = screen.getByText('Próximos Compromissos').closest('div');
    expect(installmentsCard?.textContent).toMatch(/833,33/);
  });

  it('inclui assinaturas nos próximos compromissos (extrato geral)', () => {
    render(
      <Dashboard
        {...baseProps}
        subscriptions={[
          {
            id: 's1', name: 'Netflix', amount: 45.9, frequency: 'monthly', category: 'Streaming',
            billingDate: '15', autoNotify: true, memberId: 'm1', accountId: 'a1',
          },
        ]}
      />
    );
    expect(screen.getByText('Próximos Compromissos')).toBeInTheDocument();
    expect(screen.getByText('Netflix')).toBeInTheDocument();
    expect(screen.getByText(/Assinatura/)).toBeInTheDocument();
    const installmentsCard = screen.getByText('Próximos Compromissos').closest('div');
    expect(installmentsCard?.textContent).toMatch(/45,90/);
  });

  it('renderiza os cards no grid livre e salva o layout padrão no localStorage', () => {
    render(<Dashboard {...baseProps} />);
    expect(screen.getByText('Fluxo de Caixa Acumulado')).toBeInTheDocument();
    expect(screen.getByText('Despesas por Categoria')).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('dash_grid_layout') || '{}');
    expect(saved.balance).toMatchObject({ w: 3, h: 4 });
    expect(saved.cashflow).toMatchObject({ w: 8 });
  });

  it('restaura o layout padrão ao clicar em Restaurar Layout', () => {
    localStorage.setItem('dash_grid_layout', JSON.stringify({
      balance: { x: 6, y: 0, w: 3, h: 4 },
      cashflow: { x: 0, y: 10, w: 12, h: 4 },
    }));
    render(<Dashboard {...baseProps} />);
    expect(JSON.parse(localStorage.getItem('dash_grid_layout') || '{}').balance.x).toBe(6);
    fireEvent.click(screen.getByText('Restaurar Layout'));
    const restored = JSON.parse(localStorage.getItem('dash_grid_layout') || '{}');
    expect(restored.balance.x).toBe(0);
    expect(restored.cashflow.w).toBe(8);
  });

  it('não mostra próximos compromissos quando não há dívidas nem assinaturas', () => {
    render(
      <Dashboard
        {...baseProps}
        debts={[
          {
            id: 'd1', name: 'Financiamento do carro', totalAmount: 10000, installmentsCount: 12,
            installmentAmount: 833.33, interestRate: 1.5, nextDueDate: '2026-09-01', category: 'Veículo',
            paidInstallments: 12, accountId: 'a1',
          },
        ]}
      />
    );
    expect(screen.queryByText('Próximos Compromissos')).not.toBeInTheDocument();
  });
});