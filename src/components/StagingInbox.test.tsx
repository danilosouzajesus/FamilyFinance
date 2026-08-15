import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StagingInbox from './StagingInbox';
import { Transaction, Category, CreditCard, Invoice } from '../types';

const category: Category = {
  id: 'cat1', name: 'Mercado', type: 'expense', color: '#10B981', icon: 'ShoppingCart',
};

const pendingTx: Transaction = {
  id: 'tx1', type: 'expense', categoryId: 'cat1', category: 'Mercado', subcategory: '', tagIds: [],
  amount: 120, date: '2026-08-05', recurring: 'none', notes: 'Compras do mês',
  memberId: 'm1', accountId: 'a1', attachmentUrls: [], attachmentNames: [],
  status: 'PENDENTE', creditCardId: 'card1', invoiceId: 'inv1',
};

const approvedTx: Transaction = {
  id: 'tx2', type: 'expense', categoryId: 'cat1', category: 'Mercado', subcategory: '', tagIds: [],
  amount: 50, date: '2026-08-01', recurring: 'none', notes: 'Farmácia',
  memberId: 'm1', accountId: 'a1', attachmentUrls: [], attachmentNames: [],
  status: 'REALIZADO', creditCardId: 'card1', invoiceId: 'inv1',
};

const invoice: Invoice = {
  id: 'inv1', creditCardId: 'card1', year: 2026, month: 8,
  closingDate: '2026-08-10', dueDate: '2026-09-05', status: 'OPEN', totalAmount: 170,
};

const card: CreditCard = { id: 'card1', name: 'Nubank Final', limitAmount: 5000, closingDay: 10, dueDay: 5, accountId: 'a1' };

const baseProps = {
  transactions: [pendingTx, approvedTx] as Transaction[],
  categories: [category] as Category[],
  creditCards: [card] as CreditCard[],
  invoices: [invoice] as Invoice[],
  familyMembers: [{ id: 'm1', name: 'Danil' }],
  isPrivateMode: false,
  onAddTransaction: vi.fn(),
  onEditTransaction: vi.fn(),
  onDeleteTransaction: vi.fn(),
};

describe('StagingInbox', () => {
  it('renderiza lançamentos pendentes e o total', () => {
    render(<StagingInbox {...baseProps} />);
    expect(screen.getByText('Caixa de Entrada de Compras no Cartão')).toBeInTheDocument();
    expect(screen.getByText('PENDENTE')).toBeInTheDocument();
    expect(screen.getByText('Compras do mês')).toBeInTheDocument();
  });

  it('aprovacao marca a transação como REALIZADO', () => {
    const onEdit = vi.fn();
    render(<StagingInbox {...baseProps} onEditTransaction={onEdit} />);
    fireEvent.click(screen.getByText('Aprovar'));
    expect(onEdit).toHaveBeenCalledWith('tx1', { status: 'REALIZADO' }, 'only_this');
  });

  it('descartar chama onDeleteTransaction', () => {
    const onDelete = vi.fn();
    window.confirm = vi.fn(() => true);
    render(<StagingInbox {...baseProps} onDeleteTransaction={onDelete} />);
    fireEvent.click(screen.getByText('Descartar'));
    expect(onDelete).toHaveBeenCalledWith('tx1', 'only_this');
  });

  it('abre a aba de aprovados', () => {
    render(<StagingInbox {...baseProps} />);
    fireEvent.click(screen.getByText(/Aprovados \(1\)/));
    expect(screen.getByText('Farmácia')).toBeInTheDocument();
  });

  it('classificar salva a categoria escolhida', () => {
    const onEdit = vi.fn();
    render(<StagingInbox {...baseProps} onEditTransaction={onEdit} />);
    fireEvent.click(screen.getByText('Classificar'));
    fireEvent.click(screen.getByText('Salvar categoria'));
    expect(onEdit).toHaveBeenCalledWith('tx1', expect.objectContaining({ status: 'REALIZADO' }), 'only_this');
  });
});