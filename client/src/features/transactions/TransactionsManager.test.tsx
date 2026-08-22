import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TransactionsManager from './TransactionsManager';
import { makeTx, makeCategory, makeAccount, makeMember, makeTag, noop } from '@/test/fixtures';
import { CreditCard, Invoice } from '@ff/shared';
import { invoiceIdFor } from '@ff/shared';

vi.mock('@/lib/supabase', () => ({
  fetchAppPreference: vi.fn(),
  saveAppPreference: vi.fn(),
}));

import { fetchAppPreference, saveAppPreference } from '@/lib/supabase';

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

  it('permite alternar ordenação por data entre crescente e decrescente', () => {
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[
          makeTx({ id: 't1', notes: 'Mais Antiga', date: '2026-08-01' }),
          makeTx({ id: 't2', notes: 'Intermediária', date: '2026-08-15' }),
          makeTx({ id: 't3', notes: 'Mais Recente', date: '2026-08-30' }),
        ]}
        categories={[makeCategory()]}
      />
    );

    // Por padrão, a ordenação é crescente (asc)
    const tableBody = document.querySelector('#txs-table tbody');
    expect(tableBody).toBeTruthy();
    let rows = tableBody!.querySelectorAll('tr');
    expect(rows[0].textContent).toContain('Mais Antiga');
    expect(rows[1].textContent).toContain('Intermediária');
    expect(rows[2].textContent).toContain('Mais Recente');

    // Clica no cabeçalho "Data" para alternar para decrescente (desc)
    const sortDateBtn = document.getElementById('sort-date-col-btn');
    expect(sortDateBtn).toBeTruthy();
    fireEvent.click(sortDateBtn!);

    rows = tableBody!.querySelectorAll('tr');
    expect(rows[0].textContent).toContain('Mais Recente');
    expect(rows[1].textContent).toContain('Intermediária');
    expect(rows[2].textContent).toContain('Mais Antiga');

    // Clica novamente para voltar a crescente (asc)
    fireEvent.click(sortDateBtn!);
    rows = tableBody!.querySelectorAll('tr');
    expect(rows[0].textContent).toContain('Mais Antiga');
    expect(rows[1].textContent).toContain('Intermediária');
    expect(rows[2].textContent).toContain('Mais Recente');
  });

  it('exibe o saldo inicial fechado antes do período selecionado e atualiza com filtro de conta', () => {
    const acc1 = makeAccount({ id: 'acc-1', name: 'Nubank Corrente', balance: 0 });
    const acc2 = makeAccount({ id: 'acc-2', name: 'Itaú', balance: 0 });

    // Transações em julho (fechamento de julho)
    const txJul1 = makeTx({ id: 'j1', accountId: 'acc-1', type: 'income', amount: 5000, date: '2026-07-10' });
    const txJul2 = makeTx({ id: 'j2', accountId: 'acc-1', type: 'expense', amount: 2000, date: '2026-07-20' }); // Saldo acc-1 em julho = 3000
    const txJul3 = makeTx({ id: 'j3', accountId: 'acc-2', type: 'income', amount: 4000, date: '2026-07-15' }); // Saldo acc-2 em julho = 4000
    
    // Transações em agosto
    const txAug1 = makeTx({ id: 'a1', accountId: 'acc-1', type: 'expense', amount: 500, date: '2026-08-05' });

    render(
      <TransactionsManager
        {...baseProps}
        accounts={[acc1, acc2]}
        transactions={[txJul1, txJul2, txJul3, txAug1]}
        categories={[makeCategory()]}
      />
    );

    // Seleciona o mês de Agosto / período com data inicial 2026-08-01
    const startDateInput = document.getElementById('filter-start-date') as HTMLInputElement;
    expect(startDateInput).toBeTruthy();
    fireEvent.change(startDateInput, { target: { value: '2026-08-01' } });

    // Saldo inicial consolidado antes de 01/08/2026 deve ser 3.000 + 4.000 = 7.000 (fechamento de 31/07/2026)
    const balanceCard = document.getElementById('opening-balance-card');
    expect(balanceCard).toBeInTheDocument();
    expect(balanceCard?.textContent).toContain('R$ 7.000,00');
    expect(balanceCard?.textContent).toContain('31/07/2026');

    // Ao filtrar ciclo dia 15 (ex: início 2026-08-15)
    fireEvent.change(startDateInput, { target: { value: '2026-08-15' } });
    // Saldo antes de 15/08: (3000 - 500 de 05/08) + 4000 = 6500 (fechamento de 14/08/2026)
    expect(balanceCard?.textContent).toContain('R$ 6.500,00');
    expect(balanceCard?.textContent).toContain('14/08/2026');
  });

  it('exibe modal de confirmação e exclui transação não recorrente', async () => {
    const onDelete = vi.fn();
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[
          makeTx({ id: 'tx-del-1', notes: 'Almoço Restaurante', amount: 50, recurring: 'none' })
        ]}
        categories={[makeCategory()]}
        onDeleteTransaction={onDelete}
      />
    );

    // Clica no botão de excluir transação
    const deleteBtn = document.getElementById('delete-tx-btn-tx-del-1');
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn!);

    // O modal de confirmação deve aparecer
    expect(document.getElementById('delete-tx-modal')).toBeTruthy();
    expect(screen.getByText('Excluir Transação')).toBeInTheDocument();

    // Clica no botão de confirmar no modal
    const confirmBtn = document.getElementById('confirm-delete-tx-btn');
    expect(confirmBtn).toBeTruthy();
    fireEvent.click(confirmBtn!);

    expect(onDelete).toHaveBeenCalledWith('tx-del-1', 'only_this');
  });

  it('permite selecionar múltiplas transações, exibe a barra de ações em lote e calcula totais', () => {
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[
          makeTx({ id: 'tx-1', notes: 'Salário', amount: 3000, type: 'income' }),
          makeTx({ id: 'tx-2', notes: 'Mercado', amount: 500, type: 'expense' }),
          makeTx({ id: 'tx-3', notes: 'Farmácia', amount: 100, type: 'expense' }),
        ]}
        categories={[makeCategory()]}
      />
    );

    // Barra de ações não deve estar visível inicialmente
    expect(document.getElementById('tx-bulk-actions-bar')).toBeNull();

    // Seleciona a primeira e a segunda transação
    const cb1 = document.getElementById('select-tx-tx-1') as HTMLInputElement;
    const cb2 = document.getElementById('select-tx-tx-2') as HTMLInputElement;
    expect(cb1).toBeTruthy();
    expect(cb2).toBeTruthy();

    fireEvent.click(cb1);
    fireEvent.click(cb2);

    // Barra de ações deve aparecer indicando 2 transações selecionadas
    expect(document.getElementById('tx-bulk-actions-bar')).toBeInTheDocument();
    expect(document.getElementById('bulk-selected-count')?.textContent).toContain('2 transações selecionadas');
    expect(document.getElementById('bulk-selected-totals')?.textContent).toContain('3.000,00');
    expect(document.getElementById('bulk-selected-totals')?.textContent).toContain('500,00');

    // Botão de desmarcar limpa a seleção
    const clearBtn = document.getElementById('bulk-clear-btn');
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn!);
    expect(document.getElementById('tx-bulk-actions-bar')).toBeNull();
  });

  it('permite selecionar e desmarcar todas as transações pelo checkbox do cabeçalho', () => {
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[
          makeTx({ id: 'tx-1', notes: 'Tx 1', amount: 100 }),
          makeTx({ id: 'tx-2', notes: 'Tx 2', amount: 200 }),
        ]}
        categories={[makeCategory()]}
      />
    );

    const selectAllCb = document.getElementById('select-all-txs-checkbox') as HTMLInputElement;
    expect(selectAllCb).toBeTruthy();
    expect(selectAllCb.checked).toBe(false);

    // Seleciona todas
    fireEvent.click(selectAllCb);
    expect(document.getElementById('bulk-selected-count')?.textContent).toContain('2 transações selecionadas');

    // Desmarca todas
    fireEvent.click(selectAllCb);
    expect(document.getElementById('tx-bulk-actions-bar')).toBeNull();
  });

  it('permite exclusão em lote de múltiplas transações selecionadas', () => {
    const onDelete = vi.fn();
    render(
      <TransactionsManager
        {...baseProps}
        transactions={[
          makeTx({ id: 'tx-1', notes: 'Almoço 1', amount: 50 }),
          makeTx({ id: 'tx-2', notes: 'Almoço 2', amount: 60 }),
          makeTx({ id: 'tx-3', notes: 'Almoço 3', amount: 70 }),
        ]}
        categories={[makeCategory()]}
        onDeleteTransaction={onDelete}
      />
    );

    // Seleciona tx-1 e tx-3
    fireEvent.click(document.getElementById('select-tx-tx-1')!);
    fireEvent.click(document.getElementById('select-tx-tx-3')!);

    // Clica no botão Excluir em Lote
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    expect(bulkDeleteBtn).toBeTruthy();
    fireEvent.click(bulkDeleteBtn!);

    // Modal de exclusão em lote aberto
    expect(document.getElementById('bulk-delete-modal')).toBeInTheDocument();
    expect(screen.getByText('Excluir Transações em Lote')).toBeInTheDocument();

    // Confirma exclusão
    const confirmBtn = document.getElementById('confirm-bulk-delete-btn');
    expect(confirmBtn).toBeTruthy();
    fireEvent.click(confirmBtn!);

    expect(onDelete).toHaveBeenCalledTimes(2);
    expect(onDelete).toHaveBeenCalledWith('tx-1', 'only_this');
    expect(onDelete).toHaveBeenCalledWith('tx-3', 'only_this');
    expect(document.getElementById('bulk-delete-modal')).toBeNull();
  });

  it('permite edição em lote de múltiplas transações selecionadas', () => {
    const onEdit = vi.fn();
    const catLazer = makeCategory({ id: 'cat-lazer', name: 'Lazer', color: '#10B981' });
    const acc2 = makeAccount({ id: 'acc-2', name: 'Itaú Cartão' });
    const mem2 = makeMember({ id: 'mem-2', name: 'Maria' });

    render(
      <TransactionsManager
        {...baseProps}
        transactions={[
          makeTx({ id: 'tx-1', notes: 'Cinema', category: 'Outros', accountId: 'acc_main', memberId: 'mem-1' }),
          makeTx({ id: 'tx-2', notes: 'Parque', category: 'Outros', accountId: 'acc_main', memberId: 'mem-1' }),
        ]}
        categories={[makeCategory(), catLazer]}
        accounts={[makeAccount(), acc2]}
        familyMembers={[makeMember(), mem2]}
        onEditTransaction={onEdit}
      />
    );

    // Seleciona todas
    fireEvent.click(document.getElementById('select-all-txs-checkbox')!);

    // Clica no botão Editar em Lote
    const bulkEditBtn = document.getElementById('bulk-edit-btn');
    expect(bulkEditBtn).toBeTruthy();
    fireEvent.click(bulkEditBtn!);

    // Modal de edição em lote aberto
    expect(document.getElementById('bulk-edit-modal')).toBeInTheDocument();
    expect(screen.getByText('Editar Transações em Lote')).toBeInTheDocument();

    // Altera a categoria para 'Lazer' e conta para 'acc-2'
    fireEvent.change(document.getElementById('bulk-edit-category-select')!, { target: { value: 'Lazer' } });
    fireEvent.change(document.getElementById('bulk-edit-account-select')!, { target: { value: 'acc-2' } });
    fireEvent.change(document.getElementById('bulk-edit-member-select')!, { target: { value: 'mem-2' } });
    fireEvent.change(document.getElementById('bulk-edit-status-select')!, { target: { value: 'REALIZADO' } });

    // Confirma alterações
    const confirmEditBtn = document.getElementById('confirm-bulk-edit-btn');
    expect(confirmEditBtn).toBeTruthy();
    fireEvent.click(confirmEditBtn!);

    expect(onEdit).toHaveBeenCalledTimes(2);
    expect(onEdit).toHaveBeenCalledWith('tx-1', expect.objectContaining({
      category: 'Lazer',
      categoryId: 'cat-lazer',
      accountId: 'acc-2',
      memberId: 'mem-2',
      status: 'REALIZADO'
    }), 'only_this');
    expect(onEdit).toHaveBeenCalledWith('tx-2', expect.objectContaining({
      category: 'Lazer',
      categoryId: 'cat-lazer',
      accountId: 'acc-2',
      memberId: 'mem-2',
      status: 'REALIZADO'
    }), 'only_this');
  });
});