import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AccountsAndCardsManager from './AccountsAndCardsManager';
import { makeAccount, makeTx, noop } from '../test/fixtures';
import { CreditCard, Invoice } from '../types';
import { invoiceIdFor } from '../utils/invoiceEngine';

const baseProps = {
  accounts: [] as any[],
  transactions: [] as any[],
  creditCards: [] as any[],
  invoices: [] as any[],
  isPrivateMode: false,
  onAddAccount: noop,
  onEditAccount: noop,
  onDeleteAccount: noop,
  onAddCreditCard: noop,
  onEditCreditCard: noop,
  onDeleteCreditCard: noop,
  onPayInvoice: noop,
};

const makeCard = (over: Partial<CreditCard> = {}): CreditCard => ({
  id: 'card_nubank', name: 'Nubank Roxinho', limitAmount: 5000, closingDay: 20, dueDay: 27,
  accountId: 'a1', color: '#8B5CF6', ...over,
});

const makeInvoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: invoiceIdFor('card_nubank', 2026, 8),
  creditCardId: 'card_nubank', month: 8, year: 2026,
  closingDate: '2026-08-20', dueDate: '2026-08-27', totalAmount: 3500, status: 'OPEN', ...over,
});

describe('AccountsAndCardsManager', () => {
  it('renderiza sem contas', () => {
    const { container } = render(<AccountsAndCardsManager {...baseProps} />);
    expect(container).not.toBeEmptyDOMElement();
  });

  it('lista as contas cadastradas', () => {
    render(<AccountsAndCardsManager {...baseProps} accounts={[makeAccount(), makeAccount({ id: 'a2', name: 'Nubank', type: 'credit' })]} />);
    expect(screen.getByText('Banco Itaú')).toBeInTheDocument();
    expect(screen.getByText('Nubank')).toBeInTheDocument();
  });

  it('exibe o saldo formatado', () => {
    const { container } = render(<AccountsAndCardsManager {...baseProps} accounts={[makeAccount({ balance: 1250.5 })]} />);
    expect(container.textContent).toContain('1.250,50');
  });

  it('abre o formulário para nova conta', () => {
    render(<AccountsAndCardsManager {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Nova Conta|Adicionar|Adicionar Conta/i }));
    expect(document.querySelector('form')).toBeTruthy();
  });

  it('lista os cartões de crédito com faturas', () => {
    render(
      <AccountsAndCardsManager
        {...baseProps}
        accounts={[makeAccount()]}
        creditCards={[makeCard()]}
        invoices={[makeInvoice()]}
      />
    );
    expect(screen.getByText('Nubank Roxinho')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/1 Faturas/));
    expect(screen.getByText('Ago/2026')).toBeInTheDocument();
    expect(screen.getByText('Aberta')).toBeInTheDocument();
  });

  it('abre formulário de novo cartão com campos de fatura', () => {
    render(<AccountsAndCardsManager {...baseProps} accounts={[makeAccount()]} />);
    fireEvent.click(document.getElementById('btn-add-credit-card-top')!);
    expect(screen.getByText('Dia de Fechamento')).toBeInTheDocument();
    expect(screen.getByText('Dia de Vencimento')).toBeInTheDocument();
    expect(screen.getByText('Limite do Cartão (R$)')).toBeInTheDocument();
  });

  it('botão de destaque "Criar Cartão de Crédito" no topo abre o mesmo formulário', () => {
    render(<AccountsAndCardsManager {...baseProps} accounts={[makeAccount()]} />);
    fireEvent.click(document.getElementById('btn-add-credit-card-top')!);
    expect(screen.getByText('Dia de Fechamento')).toBeInTheDocument();
    expect(screen.getByText('Limite do Cartão (R$)')).toBeInTheDocument();
  });

  it('cria cartão com os dados do formulário', () => {
    const onAddCard = vi.fn();
    render(<AccountsAndCardsManager {...baseProps} accounts={[makeAccount()]} onAddCreditCard={onAddCard} />);
    fireEvent.click(document.getElementById('btn-add-credit-card-top')!);
    fireEvent.change(screen.getByPlaceholderText(/Ex: Banco Itaú/i), { target: { value: 'XP Infinite' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '10000' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(onAddCard).toHaveBeenCalledTimes(1);
    const card = onAddCard.mock.calls[0][0];
    expect(card.name).toBe('XP Infinite');
    expect(card.limitAmount).toBe(10000);
  });

  it('chama onPayInvoice ao pagar uma fatura aberta', () => {
    const onPay = vi.fn();
    render(
      <AccountsAndCardsManager
        {...baseProps}
        accounts={[makeAccount()]}
        creditCards={[makeCard()]}
        invoices={[makeInvoice()]}
        onPayInvoice={onPay}
      />
    );
    fireEvent.click(screen.getByText(/1 Faturas/));
    fireEvent.click(screen.getByText(/Pagar Fatura de Ago\/2026/));
    expect(onPay).toHaveBeenCalledWith('card_nubank_2026-08');
  });
});