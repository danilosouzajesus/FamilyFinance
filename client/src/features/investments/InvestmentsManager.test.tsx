import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InvestmentsManager from './InvestmentsManager';
import { makeInvestment, makeDebt, noop } from '@/test/fixtures';

const baseProps = {
  investments: [] as any[],
  debts: [] as any[],
  categories: [] as any[],
  isPrivateMode: false,
  onAddInvestment: noop,
  onEditInvestment: noop,
  onDeleteInvestment: noop,
  onAddDebt: noop,
  onEditDebt: noop,
  onDeleteDebt: noop,
};

describe('InvestmentsManager', () => {
  it('renderiza o gerenciador de investimentos', () => {
    const { container } = render(<InvestmentsManager {...baseProps} />);
    expect(container).not.toBeEmptyDOMElement();
  });

  it('lista os investimentos', () => {
    render(
      <InvestmentsManager
        {...baseProps}
        investments={[makeInvestment({ name: 'CDB 110%', currentAmount: 1100 })]}
      />
    );
    expect(screen.getByText('CDB 110%')).toBeInTheDocument();
    expect(screen.getAllByText(/R\$/).length).toBeGreaterThan(0);
  });

  it('lista as dívidas', () => {
    render(
      <InvestmentsManager
        {...baseProps}
        debts={[makeDebt({ name: 'Financiamento do carro' })]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Controle de Dívidas/i }));
    expect(screen.getByText('Financiamento do carro')).toBeInTheDocument();
  });

  it('mostra o total investido formatado', () => {
    render(
      <InvestmentsManager
        {...baseProps}
        investments={[makeInvestment({ currentAmount: 1250.5 })]}
      />
    );
    expect(screen.getAllByText(/1\.250,50/).length).toBeGreaterThan(0);
  });

  it('exibe a conta de investimento vinculada e o selo Pluggy no card', () => {
    render(
      <InvestmentsManager
        {...baseProps}
        accounts={[{ id: 'inv_acc', name: 'XP Investimentos', type: 'investment', balance: 0, color: 'indigo-500' }]}
        investments={[
          makeInvestment({ name: 'Tesouro Selic', accountId: 'inv_acc', origin: 'PLUGGY', isReconciled: true }),
        ]}
      />
    );
    expect(screen.getByText('Tesouro Selic')).toBeInTheDocument();
    expect(screen.getByText('XP Investimentos')).toBeInTheDocument();
    expect(screen.getByText(/Pluggy/i)).toBeInTheDocument();
  });

  it('lista a conta de investimento no seletor do formulário', () => {
    render(
      <InvestmentsManager
        {...baseProps}
        accounts={[{ id: 'inv_acc', name: 'Corretora XP', type: 'investment', balance: 0, color: 'indigo-500' }]}
        onAddInvestment={noop}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Novo Investimento/i }));
    expect(screen.getByText('Conta de Investimento')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Corretora XP' })).toBeInTheDocument();
  });

  it('mostra a conta de débito das parcelas no card da dívida', () => {
    render(
      <InvestmentsManager
        {...baseProps}
        accounts={[{ id: 'a1', name: 'Banco Itaú', type: 'bank', balance: 5000, color: 'blue-500' }]}
        debts={[makeDebt({ name: 'Financiamento do carro', accountId: 'a1' })]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Controle de Dívidas/i }));
    expect(screen.getByText('Financiamento do carro')).toBeInTheDocument();
    expect(screen.getByText(/Banco Itaú/)).toBeInTheDocument();
  });

  it('lista a conta de débito no formulário de dívida', () => {
    render(
      <InvestmentsManager
        {...baseProps}
        accounts={[{ id: 'a1', name: 'Banco Itaú', type: 'bank', balance: 5000, color: 'blue-500' }]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Controle de Dívidas/i }));
    fireEvent.click(screen.getByRole('button', { name: /Registrar Dívida/i }));
    expect(screen.getByText('Conta de Débito das Parcelas')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Banco Itaú' })).toBeInTheDocument();
  });

  it('avisa quando não há conta para debitar as parcelas', () => {
    render(
      <InvestmentsManager
        {...baseProps}
        accounts={[{ id: 'card1', name: 'Nubank Visa', type: 'credit', balance: -200, color: 'rose-500' }]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Controle de Dívidas/i }));
    fireEvent.click(screen.getByRole('button', { name: /Registrar Dívida/i }));
    expect(screen.getByText(/Cadastre uma conta corrente, dinheiro ou investimento para debitar as parcelas/i)).toBeInTheDocument();
  });

  it('cria dívida vinculada à conta de débito selecionada', () => {
    const onAddDebt = vi.fn();
    render(
      <InvestmentsManager
        {...baseProps}
        accounts={[{ id: 'a1', name: 'Banco Itaú', type: 'bank', balance: 5000, color: 'blue-500' }]}
        onAddDebt={onAddDebt}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Controle de Dívidas/i }));
    fireEvent.click(screen.getByRole('button', { name: /Registrar Dívida/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Empréstimo Itaú/), { target: { value: 'Empréstimo' } });
    fireEvent.change(screen.getByPlaceholderText(/Ex: 15000/), { target: { value: '12000' } });
    fireEvent.change(screen.getByPlaceholderText(/Ex: 620/), { target: { value: '500' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(onAddDebt).toHaveBeenCalledTimes(1);
    expect(onAddDebt.mock.calls[0][0].accountId).toBe('a1');
  });

  it('confirma exclusão de ativo mantendo os valores', () => {
    const onDeleteInvestment = vi.fn();
    render(
      <InvestmentsManager
        {...baseProps}
        onDeleteInvestment={onDeleteInvestment}
        investments={[makeInvestment({ name: 'CDB 110%', currentAmount: 1100 })]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Excluir ativo CDB 110%/i }));
    expect(screen.getByText(/Excluir Ativo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Manter valores/i }));
    expect(onDeleteInvestment).toHaveBeenCalledTimes(1);
    expect(onDeleteInvestment.mock.calls[0][0]).toBe('i1');
    expect(onDeleteInvestment.mock.calls[0][1]).toBe(false);
  });

  it('reverte lançamentos ao excluir dívida', () => {
    const onDeleteDebt = vi.fn();
    render(
      <InvestmentsManager
        {...baseProps}
        onDeleteDebt={onDeleteDebt}
        debts={[makeDebt({ name: 'Financiamento do carro', paidInstallments: 2 })]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Controle de Dívidas/i }));
    fireEvent.click(screen.getByRole('button', { name: /Excluir dívida Financiamento do carro/i }));
    expect(screen.getByText(/Excluir Dívida/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reverter lançamentos/i }));
    expect(onDeleteDebt).toHaveBeenCalledTimes(1);
    expect(onDeleteDebt.mock.calls[0][0]).toBe('d1');
    expect(onDeleteDebt.mock.calls[0][1]).toBe(true);
  });
});
