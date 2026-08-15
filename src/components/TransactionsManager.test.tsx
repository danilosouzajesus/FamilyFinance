import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TransactionsManager from './TransactionsManager';
import { makeTx, makeCategory, makeAccount, makeMember, makeTag, noop } from '../test/fixtures';
import { CreditCard, Invoice } from '../types';
import { invoiceIdFor } from '../utils/invoiceEngine';

vi.mock('../lib/supabase', () => ({
  fetchAppPreference: vi.fn(),
  saveAppPreference: vi.fn(),
}));

import { fetchAppPreference, saveAppPreference } from '../lib/supabase';

const mockedFetchAppPreference = fetchAppPreference as unknown as ReturnType<typeof vi.fn>;
const mockedSaveAppPreference = saveAppPreference as unknown as ReturnType<typeof vi.fn>;

const baseProps = {
  transactions: [] as any[],
  categories: [] as any[],
  accounts: [] as any[],
  familyMembers: [] as any[],
  allTags: [] as any[],
  creditCards: [] as any[],
  invoices: [] as any[],
  isPrivateMode: false,
  onAddTag: noop,
  onAddTransaction: noop,
  onEditTransaction: noop,
  onDeleteTransaction: noop,
};

const makeCard = (over: Partial<CreditCard> = {}): CreditCard => ({
  id: 'card_nubank', name: 'Nubank', limitAmount: 5000, closingDay: 20, dueDay: 27,
  accountId: 'a1', ...over,
});

const makeInvoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: invoiceIdFor('card_nubank', 2026, 8),
  creditCardId: 'card_nubank', month: 8, year: 2026,
  closingDate: '2026-08-20', dueDate: '2026-08-27', totalAmount: 0, status: 'OPEN', ...over,
});

describe('TransactionsManager', () => {
  beforeEach(() => {
    mockedFetchAppPreference.mockReset();
    mockedSaveAppPreference.mockReset();
    mockedFetchAppPreference.mockResolvedValue(null);
    mockedSaveAppPreference.mockResolvedValue(true);
  });
  it('renderiza o título principal', () => {
    render(<TransactionsManager {...baseProps} />);
    expect(screen.getByText('Controle de Despesas e Receitas')).toBeInTheDocument();
  });

  it('lista as transações cadastradas', () => {
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[makeTx({ notes: 'Compras do mês', amount: 250 })]}
        categories={[makeCategory()]}
      />
    );
    expect(screen.getByText('Compras do mês')).toBeInTheDocument();
    expect(screen.getAllByText('Mercado').length).toBeGreaterThan(0);
  });

  it('lista receitas e despesas com valores formatados', () => {
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[
          makeTx({ id: 't1', type: 'income', amount: 5000 }),
          makeTx({ id: 't2', type: 'expense', amount: 150.75 }),
        ]}
        categories={[makeCategory(), makeCategory({ id: 'cat2', name: 'Salário', type: 'income' })]}
      />
    );
    expect(screen.getAllByText(/R\$/).length).toBeGreaterThan(0);
  });

  it('filtra por busca textual', () => {
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[makeTx({ notes: 'Mercado Semanal' }), makeTx({ id: 't2', notes: 'Cinema' })]}
        categories={[makeCategory()]}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/Descri/i), { target: { value: 'Cinema' } });
    expect(screen.getByText('Cinema')).toBeInTheDocument();
    expect(screen.queryByText('Mercado Semanal')).not.toBeInTheDocument();
  });

  it('abre o modal de nova transação', () => {
    render(
      <TransactionsManager
        {...baseProps}
        accounts={[makeAccount()]}
        familyMembers={[makeMember()]}
        categories={[makeCategory()]}
        allTags={[makeTag()]}
      />
    );
    fireEvent.click(document.getElementById('add-tx-btn')!);
    expect(document.getElementById('tx-form-container')).toBeTruthy();
    expect(screen.getByText('Insira os detalhes abaixo para contabilização')).toBeInTheDocument();
  });

  it('aplica o período "Ano" filtrando as transações do ano', async () => {
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[
          makeTx({ id: 't1', notes: 'Antiga 2025', date: '2025-06-15' }),
          makeTx({ id: 't2', notes: 'Atual', date: '2026-08-10' }),
        ]}
        categories={[makeCategory()]}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Atual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('period-mode-year'));
    fireEvent.change(screen.getByTestId('period-year-input'), { target: { value: '2025' } });

    await waitFor(() => {
      expect(screen.getByText('Antiga 2025')).toBeInTheDocument();
      expect(screen.queryByText('Atual')).not.toBeInTheDocument();
    });
  });

  it('aplica o período cíclico dia→dia (ex: 15 → 15) entre meses', async () => {
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[
          makeTx({ id: 't1', notes: 'Fora antes', date: '2026-08-14' }),
          makeTx({ id: 't2', notes: 'Dentro 15', date: '2026-08-15' }),
          makeTx({ id: 't3', notes: 'Fora depois', date: '2026-09-16' }),
        ]}
        categories={[makeCategory()]}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Fora antes')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('period-mode-cycle'));
    fireEvent.change(screen.getByTestId('period-cycle-start-day'), { target: { value: '15' } });
    fireEvent.change(screen.getByTestId('period-cycle-end-day'), { target: { value: '15' } });

    await waitFor(() => {
      expect(screen.getByText('Dentro 15')).toBeInTheDocument();
      expect(screen.queryByText('Fora antes')).not.toBeInTheDocument();
      expect(screen.queryByText('Fora depois')).not.toBeInTheDocument();
    });
  });

  it('filtra faturas de cartão pela data de vencimento no período cíclico (15/08 → 15/09)', async () => {
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[
          // Compra de agosto (vence dia 20/08, DENTRO do ciclo 15/08→15/09)
          makeTx({ id: 't1', notes: 'Mercado', amount: 100, date: '2026-08-10', creditCardId: 'card_nubank', invoiceId: 'card_nubank_2026-08', includeInBalanceSum: false }),
          // Compra com vencimento 16/09, FORA do ciclo mesmo com a compra em 22/08
          makeTx({ id: 't2', notes: 'Carrefour', amount: 200, date: '2026-08-22', creditCardId: 'card_nubank', invoiceId: 'card_nubank_2026-09', includeInBalanceSum: false }),
        ]}
        categories={[makeCategory()]}
        creditCards={[makeCard()]}
        invoices={[
          makeInvoice({ id: 'card_nubank_2026-08', month: 8, year: 2026, dueDate: '2026-08-20', totalAmount: 100, status: 'OPEN' }),
          makeInvoice({ id: 'card_nubank_2026-09', month: 9, year: 2026, dueDate: '2026-09-16', totalAmount: 200, status: 'OPEN' }),
        ]}
      />
    );
    await waitFor(() => {
      expect(screen.getByText(/FATURA NUBANK/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('period-mode-cycle'));
    fireEvent.change(screen.getByTestId('period-cycle-start-day'), { target: { value: '15' } });
    fireEvent.change(screen.getByTestId('period-cycle-end-day'), { target: { value: '15' } });

    await waitFor(() => {
      // Fatura de agosto (vence 20/08) permanece dentro do ciclo
      expect(screen.getByText('- R$ 100,00')).toBeInTheDocument();
      // Fatura de setembro (vence 16/09) é excluída do ciclo 15/08 → 15/09
      expect(screen.queryByText('- R$ 200,00')).not.toBeInTheDocument();
    });
  });

  it('salva o período como padrão no Supabase e aplica ao abrir', async () => {
    mockedFetchAppPreference.mockResolvedValue({ mode: 'year', year: 2025 });
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[
          makeTx({ id: 't1', notes: 'Antiga 2025', date: '2025-06-15' }),
          makeTx({ id: 't2', notes: 'Atual', date: '2026-08-10' }),
        ]}
        categories={[makeCategory()]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Antiga 2025')).toBeInTheDocument();
      expect(screen.queryByText('Atual')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Padrão: Ano/)).toBeInTheDocument();

    // Define novo padrão (mês atual) e verifica se salvou
    fireEvent.click(screen.getByTestId('period-mode-month'));
    await waitFor(() => {
      expect(mockedSaveAppPreference).not.toHaveBeenCalled();
    });
    fireEvent.click(screen.getByTestId('period-save-default'));
    await waitFor(() => {
      expect(mockedSaveAppPreference).toHaveBeenCalledWith(
        'transactions_period_default',
        expect.objectContaining({ mode: 'month' })
      );
    });
  });

  it('lança compra no cartão com fatura atribuída automaticamente (sem debitar saldo)', () => {
    const onAdd = vi.fn();
    render(
      <TransactionsManager
        {...baseProps}
        onAddTransaction={onAdd}
        accounts={[makeAccount()]}
        familyMembers={[makeMember()]}
        categories={[makeCategory()]}
        creditCards={[makeCard()]}
        invoices={[makeInvoice()]}
      />
    );
    fireEvent.click(document.getElementById('add-tx-btn')!);
    fireEvent.change(document.getElementById('tx-form-amount')!, { target: { value: '150' } });
    fireEvent.change(document.getElementById('tx-form-date')!, { target: { value: '2026-08-10' } });
    fireEvent.change(document.getElementById('tx-form-credit-card')!, { target: { value: 'card_nubank' } });
    fireEvent.submit(document.querySelector('form')!);

    expect(onAdd).toHaveBeenCalledTimes(1);
    const payload = onAdd.mock.calls[0][0];
    expect(payload.creditCardId).toBe('card_nubank');
    expect(payload.invoiceId).toBe('card_nubank_2026-08');
    expect(payload.includeInBalanceSum).toBe(false);
    expect(payload.installmentNumber).toBe(1);
  });

  it('re-atribui a fatura quando a data cruza o dia de fechamento', () => {
    render(
      <TransactionsManager
        {...baseProps}
        accounts={[makeAccount()]}
        familyMembers={[makeMember()]}
        categories={[makeCategory()]}
        creditCards={[makeCard()]}
        invoices={[makeInvoice()]}
      />
    );
    fireEvent.click(document.getElementById('add-tx-btn')!);
    fireEvent.change(document.getElementById('tx-form-date')!, { target: { value: '2026-08-10' } });
    fireEvent.change(document.getElementById('tx-form-credit-card')!, { target: { value: 'card_nubank' } });
    // antes do fechamento (dia 20) -> fatura de agosto
    expect((document.getElementById('tx-form-invoice') as HTMLSelectElement).value).toBe('card_nubank_2026-08');
    // muda para depois do fechamento -> fatura de setembro
    fireEvent.change(document.getElementById('tx-form-date')!, { target: { value: '2026-08-22' } });
    expect((document.getElementById('tx-form-invoice') as HTMLSelectElement).value).toBe('card_nubank_2026-09');
  });

  it('lança parcelamento gerando N transações para faturas futuras', () => {
    const onAdd = vi.fn();
    render(
      <TransactionsManager
        {...baseProps}
        onAddTransaction={onAdd}
        accounts={[makeAccount()]}
        familyMembers={[makeMember()]}
        categories={[makeCategory()]}
        creditCards={[makeCard()]}
        invoices={[makeInvoice()]}
      />
    );
    fireEvent.click(document.getElementById('add-tx-btn')!);
    fireEvent.change(document.getElementById('tx-form-amount')!, { target: { value: '300' } });
    fireEvent.change(document.getElementById('tx-form-date')!, { target: { value: '2026-08-05' } });
    fireEvent.change(document.getElementById('tx-form-credit-card')!, { target: { value: 'card_nubank' } });
    fireEvent.change(document.getElementById('tx-form-installments')!, { target: { value: '3' } });
    fireEvent.submit(document.querySelector('form')!);

    expect(onAdd).toHaveBeenCalledTimes(3);
    expect(onAdd.mock.calls[0][0].invoiceId).toBe('card_nubank_2026-08');
    expect(onAdd.mock.calls[1][0].invoiceId).toBe('card_nubank_2026-09');
    expect(onAdd.mock.calls[2][0].invoiceId).toBe('card_nubank_2026-10');
    expect(onAdd.mock.calls.map(c => c[0].installmentNumber)).toEqual([1, 2, 3]);
    expect(onAdd.mock.calls.every(c => c[0].includeInBalanceSum === false)).toBe(true);
  });

  it('exibe a fatura como linha expansível na lista de transações', () => {
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[
          makeTx({ id: 't1', notes: 'Pix', amount: 50 }),
          makeTx({ id: 't2', notes: 'Carrefour', amount: 450, creditCardId: 'card_nubank', invoiceId: 'card_nubank_2026-08', includeInBalanceSum: false }),
          makeTx({ id: 't3', notes: 'iFood', amount: 85, creditCardId: 'card_nubank', invoiceId: 'card_nubank_2026-08', includeInBalanceSum: false }),
        ]}
        categories={[makeCategory()]}
        creditCards={[makeCard()]}
        invoices={[makeInvoice({ totalAmount: 535 })]}
      />
    );
    // Fatura aparece como linha expansível na lista
    expect(screen.getByText(/FATURA NUBANK/i)).toBeInTheDocument();
    expect(screen.getByText('Pix')).toBeInTheDocument();
    // Compras de cartão ficam dentro da fatura expansível (não na lista principal)
    expect(screen.queryByText('Carrefour')).not.toBeInTheDocument();
    // Expandir a fatura revela os lançamentos
    fireEvent.click(screen.getByText(/FATURA NUBANK/i));
    expect(screen.getByText('Carrefour')).toBeInTheDocument();
    expect(screen.getByText('iFood')).toBeInTheDocument();
  });
});