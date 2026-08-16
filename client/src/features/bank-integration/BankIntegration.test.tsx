import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BankIntegration from './BankIntegration';
import { makeCategory, makeSubcategory, makeTag, makeAccount, makeRule, makeTx, noop } from '@/test/fixtures';
import { PluggyPendingTx, Transaction } from '@ff/shared';

// Mock do SDK do widget da Pluggy (captura o onSuccess para simular conexão)
const { capturedSuccess } = vi.hoisted(() => ({
  capturedSuccess: { current: null as null | ((arg: any) => void) },
}));

vi.mock('pluggy-connect-sdk', () => ({
  PluggyConnect: class {
    constructor(opts: any) { capturedSuccess.current = opts.onSuccess; }
    init() { return Promise.resolve(); }
  },
}));

// ---- Mock global fetch (API do servidor) ----
let requests: { url: string; method: string }[] = [];
let pendingDb: PluggyPendingTx[] = [];
let configured = false;
let accountDb: any[] = [];
let investmentDb: any[] = [];

function mockFetch(impl?: (url: string, init?: RequestInit) => any) {
  vi.stubGlobal('fetch', async (input: any, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    requests.push({ url, method });
    const body = impl ? await impl(url, init) : defaultImpl(url, method, init);
    return {
      ok: true,
      status: 200,
      json: async () => body,
    };
  });
}

function defaultImpl(url: string, method: string, init?: RequestInit): any {
  if (url.includes('/api/pluggy/config')) return { configured, webhookUrl: '/api/pluggy/webhook' };
  if (url.includes('/api/pluggy/pending?')) return pendingDb;
  if (url.includes('/api/pluggy/accounts/map')) return {};
  if (url.includes('/api/pluggy/accounts')) return accountDb;
  if (url.includes('/api/pluggy/connections')) {
    if (method === 'GET') return [];
    return {};
  }
  if (url.includes('/api/pluggy/investments')) return { investments: investmentDb };
  if (url.includes('/api/pluggy/demo/generate')) return { generated: 8, pending: pendingDb };
  if (url.includes('/approve') || url.includes('/reconcile') || url.includes('/ignore')) return pendingDb[0] || {};
  return {};
}

function makePending(over: Partial<PluggyPendingTx> = {}): PluggyPendingTx {
  return {
    id: 'pend_1',
    userId: 'local',
    accountId: 'a1',
    rawDescription: 'PIX *PADARIA SÃO JOSÉ',
    amount: 18.5,
    date: '2026-08-10',
    type: 'expense',
    paymentMethod: 'PIX',
    pluggyTransactionId: 'pluggy_1',
    pluggyItemId: 'item_1',
    suggestedCategoryId: undefined,
    suggestedCategory: 'Mercado',
    suggestedSubcategoryId: undefined,
    suggestedSubcategory: '',
    suggestedTagIds: [],
    aiConfidence: 92,
    suggestedReconcileTransactionId: null,
    status: 'PENDING',
    createdAt: '2026-08-10T10:00:00Z',
    updatedAt: '2026-08-10T10:00:00Z',
    ...over,
  };
}

const baseProps = {
  categories: [] as any[],
  subcategories: [] as any[],
  tags: [] as any[],
  accounts: [] as any[],
  transactions: [] as any[],
  automationRules: [] as any[],
  onImportTransactions: noop,
  onEditTransaction: noop,
  userId: 'local',
};

beforeEach(() => {
  requests = [];
  pendingDb = [];
  configured = false;
  accountDb = [];
  investmentDb = [];
  capturedSuccess.current = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BankIntegration', () => {
  it('renderiza o título principal', () => {
    mockFetch();
    render(<BankIntegration {...baseProps} />);
    expect(screen.getByText(/Banco & Conciliação/)).toBeInTheDocument();
  });

  it('renderiza com categorias, contas e tags', () => {
    mockFetch();
    const { container } = render(
      <BankIntegration
        {...baseProps}
        categories={[makeCategory()]}
        subcategories={[makeSubcategory()]}
        tags={[makeTag()]}
        accounts={[makeAccount()]}
        automationRules={[makeRule()]}
      />
    );
    expect(container).not.toBeEmptyDOMElement();
  });

  it('mostra as contas no seletor de destino', () => {
    mockFetch();
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount(), makeAccount({ id: 'a2', name: 'Nubank' })]}
      />
    );
    expect(screen.getByRole('option', { name: /Banco Itaú/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Nubank/ })).toBeInTheDocument();
  });

  it('mostra botão de modo demonstração quando não configurado', () => {
    mockFetch();
    render(<BankIntegration {...baseProps} accounts={[makeAccount()]} />);
    expect(screen.getByText(/Modo demonstração/)).toBeInTheDocument();
  });

  it('gera pendências de demonstração e lista na Caixa de Entrada', async () => {
    mockFetch();
    pendingDb = [makePending()];
    render(<BankIntegration {...baseProps} accounts={[makeAccount()]} />);

    fireEvent.click(screen.getByText(/Modo demonstração/));

    await waitFor(() => {
      expect(requests.some(r => r.url.includes('/api/pluggy/demo/generate'))).toBe(true);
    });

    fireEvent.click(screen.getByText('Painel de Conciliação'));
    await waitFor(() => {
      expect(screen.getByText('PIX *PADARIA SÃO JOSÉ')).toBeInTheDocument();
    });
    expect(screen.getByText(/1 pendências/)).toBeInTheDocument();
  });

  it('aprova uma pendência da Pluggy: chama o servidor e importa a transação', async () => {
    mockFetch();
    pendingDb = [makePending()];
    const importSpy = vi.fn();
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount()]}
        transactions={[makeTx({ id: 'mt1', amount: 55.9, date: '2026-08-09' })]}
        onImportTransactions={importSpy}
      />
    );

    fireEvent.click(screen.getByText('Painel de Conciliação'));
    await waitFor(() => {
      expect(screen.getByText('PIX *PADARIA SÃO JOSÉ')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Aprovar')[0]);

    await waitFor(() => {
      expect(requests.some(r => r.method === 'POST' && r.url.includes('/approve'))).toBe(true);
      expect(importSpy).toHaveBeenCalledTimes(1);
    });
    const imported = importSpy.mock.calls[0][0][0] as Transaction;
    expect(imported.origin).toBe('PLUGGY');
    expect(imported.pluggyTransactionId).toBe('pluggy_1');
    expect(imported.isReconciled).toBe(true);
    expect(imported.amount).toBe(18.5);
  });

  it('ignora uma pendência da Pluggy chamando o servidor', async () => {
    mockFetch();
    pendingDb = [makePending()];
    render(<BankIntegration {...baseProps} accounts={[makeAccount()]} />);

    fireEvent.click(screen.getByText('Painel de Conciliação'));
    await waitFor(() => {
      expect(screen.getByText('PIX *PADARIA SÃO JOSÉ')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ignorar'));

    await waitFor(() => {
      expect(requests.some(r => r.method === 'POST' && r.url.includes('/ignore'))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByText('PIX *PADARIA SÃO JOSÉ')).not.toBeInTheDocument();
    });
  });

  it('concilia com uma transação manual existente (sem duplicar)', async () => {
    mockFetch();
    pendingDb = [makePending()];
    const editSpy = vi.fn();
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount()]}
        transactions={[makeTx({ id: 'mt1', amount: 18.5, date: '2026-08-10', notes: 'Compra padaria' })]}
        onEditTransaction={editSpy}
      />
    );

    fireEvent.click(screen.getByText('Painel de Conciliação'));
    await waitFor(() => {
      expect(screen.getByText('PIX *PADARIA SÃO JOSÉ')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Conciliar'));
    await waitFor(() => {
      expect(screen.getByText(/Conciliar transação/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Compra padaria'));

    await waitFor(() => {
      expect(requests.some(r => r.method === 'POST' && r.url.includes('/reconcile'))).toBe(true);
      expect(editSpy).toHaveBeenCalledTimes(1);
    });
    const stamped = editSpy.mock.calls[0][0] as Transaction;
    expect(stamped.id).toBe('mt1');
    expect(stamped.isReconciled).toBe(true);
    expect(stamped.pluggyTransactionId).toBe('pluggy_1');
  });

  it('busca a Caixa de Entrada ao carregar', async () => {
    mockFetch();
    render(<BankIntegration {...baseProps} accounts={[makeAccount()]} />);
    await waitFor(() => {
      expect(requests.some(r => r.url.includes('/api/pluggy/pending?'))).toBe(true);
      expect(requests.some(r => r.url.includes('/api/pluggy/config'))).toBe(true);
    });
  });

  it('seleciona transações e aprova em lote', async () => {
    mockFetch();
    pendingDb = [makePending(), makePending({ id: 'pend_2', rawDescription: 'IFOOD', pluggyTransactionId: 'pluggy_2' })];
    const importSpy = vi.fn();
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount()]}
        onImportTransactions={importSpy}
      />
    );

    fireEvent.click(screen.getByText('Painel de Conciliação'));
    await waitFor(() => {
      expect(screen.getByText('PIX *PADARIA SÃO JOSÉ')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByTitle('Selecionar para ação em lote');
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText('1 selecionadas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Aprovar \(1\)/ }));

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledTimes(1);
    });
    expect(requests.some(r => r.method === 'POST' && r.url.includes('/approve'))).toBe(true);
  });

  it('clica na transação e abre o painel de edição lateral', async () => {
    mockFetch();
    pendingDb = [makePending()];
    render(<BankIntegration {...baseProps} accounts={[makeAccount()]} />);

    fireEvent.click(screen.getByText('Painel de Conciliação'));
    await waitFor(() => {
      expect(screen.getByText('PIX *PADARIA SÃO JOSÉ')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('PIX *PADARIA SÃO JOSÉ'));
    await waitFor(() => {
      expect(screen.getByText('Editar transação')).toBeInTheDocument();
    });
    expect(screen.getByText('Salvar')).toBeInTheDocument();
  });

  it('seleciona múltiplas e aplica edição em lote pelo painel lateral', async () => {
    mockFetch();
    pendingDb = [makePending(), makePending({ id: 'pend_2', rawDescription: 'IFOOD', pluggyTransactionId: 'pluggy_2' })];
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount()]}
        categories={[makeCategory(), makeCategory({ id: 'cat2', name: 'Alimentação' })]}
      />
    );

    fireEvent.click(screen.getByText('Painel de Conciliação'));
    await waitFor(() => {
      expect(screen.getByText('PIX *PADARIA SÃO JOSÉ')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByTitle('Selecionar para ação em lote');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText('2 selecionadas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Editar \(2\)/ }));
    await waitFor(() => {
      expect(screen.getByText('Editar 2 transações')).toBeInTheDocument();
    });

    const panelCategorySelect = screen.getAllByDisplayValue('Mercado').pop() as HTMLElement;
    fireEvent.change(panelCategorySelect, { target: { value: 'Alimentação' } });
    fireEvent.click(screen.getByText('Aplicar a todas'));

    await waitFor(() => {
      expect(screen.queryByText('Editar 2 transações')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Alimentação').length).toBeGreaterThan(0);
  });

  it('mostra o mapeamento de contas e salva a associação via API', async () => {
    mockFetch();
    accountDb = [
      { pluggyAccountId: 'pluggy_acc_1', itemId: 'item_1', name: 'Conta Corrente Itaú', subtype: 'CHECKING_ACCOUNT', mappedAppAccountId: null },
      { pluggyAccountId: 'pluggy_acc_2', itemId: 'item_1', name: 'Cartão de Crédito Itaú', subtype: 'CREDIT_CARD', mappedAppAccountId: null },
    ];
    pendingDb = [makePending({ accountId: 'pluggy_acc_1' })];
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount(), makeAccount({ id: 'a2', name: 'Nubank' })]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Mapeamento de contas/)).toBeInTheDocument();
    });
    expect(screen.getByText('Conta Corrente Itaú')).toBeInTheDocument();
    expect(screen.getByText('Cartão de Crédito Itaú')).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    const mapSelect = selects[selects.length - 2]; // primeiro cartão de mapeamento
    fireEvent.change(mapSelect, { target: { value: 'a2' } });

    await waitFor(() => {
      expect(requests.some(r => r.method === 'POST' && r.url.includes('/api/pluggy/accounts/map'))).toBe(true);
    });
  });

  it('mostra o botão de sincronizar por conta na tela de mapeamento', async () => {
    mockFetch();
    accountDb = [
      { pluggyAccountId: 'pluggy_acc_1', itemId: 'item_1', name: 'Conta Corrente Itaú', subtype: 'CHECKING_ACCOUNT', mappedAppAccountId: null },
      { pluggyAccountId: 'pluggy_acc_2', itemId: 'item_1', name: 'Cartão de Crédito Itaú', subtype: 'CREDIT_CARD', mappedAppAccountId: null },
    ];
    pendingDb = [makePending({ accountId: 'pluggy_acc_1' })];
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount()]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Mapeamento de contas/)).toBeInTheDocument();
    });

    const syncButtons = screen.getAllByTitle(/Sincronizar as transações/);
    expect(syncButtons).toHaveLength(2);

    fireEvent.click(syncButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/Sincronizar a partir de/)).toBeInTheDocument();
      expect(screen.getByText(/Baixar as transações de "Conta Corrente Itaú"/)).toBeInTheDocument();
    });
  });

  it('aprova pendência usando a conta mapeada em vez da Conta de Destino', async () => {
    mockFetch();
    accountDb = [
      { pluggyAccountId: 'pluggy_acc_1', itemId: 'item_1', name: 'Conta Corrente Itaú', subtype: 'CHECKING_ACCOUNT', mappedAppAccountId: 'a2' },
    ];
    pendingDb = [makePending({ accountId: 'pluggy_acc_1' })];
    const importSpy = vi.fn();
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount(), makeAccount({ id: 'a2', name: 'Nubank' })]}
        onImportTransactions={importSpy}
      />
    );

    fireEvent.click(screen.getByText('Painel de Conciliação'));
    await waitFor(() => {
      expect(screen.getByText('PIX *PADARIA SÃO JOSÉ')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Aprovar')[0]);

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledTimes(1);
    });
    const imported = importSpy.mock.calls[0][0][0] as Transaction;
    expect(imported.accountId).toBe('a2');
  });

  it('mostra cartões de crédito como opção de mapeamento e seta creditCardId ao aprovar', async () => {
    mockFetch();
    accountDb = [
      { pluggyAccountId: 'pluggy_acc_credit', itemId: 'item_1', name: 'Cartão Itaú', subtype: 'CREDIT_CARD', mappedAppAccountId: null },
    ];
    pendingDb = [makePending({ accountId: 'pluggy_acc_credit' })];
    const importSpy = vi.fn();
    const card = { id: 'card_itau', name: 'Cartão Nubank', limitAmount: 5000, closingDay: 10, dueDay: 18, accountId: 'a1' };
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount(), makeAccount({ id: 'a2', name: 'Nubank' })]}
        creditCards={[card as any]}
        onImportTransactions={importSpy}
      />
    );

    // O cartão aparece como opção no select de mapeamento da pendência
    fireEvent.click(screen.getByText('Painel de Conciliação'));
    await waitFor(() => {
      expect(screen.getByText('PIX *PADARIA SÃO JOSÉ')).toBeInTheDocument();
    });

    const mapSelect = screen.getByTitle('Associe a conta/cartão da Pluggy a uma conta cadastrada no sistema') as HTMLSelectElement;
    expect(Array.from(mapSelect.options).some(o => o.value === 'card_itau')).toBe(true);

    fireEvent.change(mapSelect, { target: { value: 'card_itau' } });
    await waitFor(() => {
      expect(requests.some(r => r.method === 'POST' && r.url.includes('/api/pluggy/accounts/map'))).toBe(true);
    });

    fireEvent.click(screen.getAllByText('Aprovar')[0]);
    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledTimes(1);
    });
    const imported = importSpy.mock.calls[0][0][0] as Transaction;
    expect(imported.creditCardId).toBe('card_itau');
    expect(imported.accountId).toBe('a1'); // conta padrão do cartão
    expect(imported.includeInBalanceSum).toBe(false);
  });

  it('usa a Conta de Destino quando não há mapeamento', async () => {
    mockFetch();
    accountDb = [
      { pluggyAccountId: 'pluggy_acc_1', itemId: 'item_1', name: 'Conta Corrente Itaú', subtype: 'CHECKING_ACCOUNT', mappedAppAccountId: null },
    ];
    pendingDb = [makePending({ accountId: 'pluggy_acc_1' })];
    const importSpy = vi.fn();
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount(), makeAccount({ id: 'a2', name: 'Nubank' })]}
        onImportTransactions={importSpy}
      />
    );

    fireEvent.click(screen.getByText('Painel de Conciliação'));
    await waitFor(() => {
      expect(screen.getByText('PIX *PADARIA SÃO JOSÉ')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Aprovar')[0]);

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledTimes(1);
    });
    const imported = importSpy.mock.calls[0][0][0] as Transaction;
    expect(imported.accountId).toBe('a1'); // Conta de Destino padrão
  });

  it('permite associar a conta Pluggy à conta do app dentro da pendência', async () => {
    mockFetch();
    accountDb = [
      { pluggyAccountId: 'pluggy_acc_1', itemId: 'item_1', name: 'Conta Corrente Itaú', subtype: 'CHECKING_ACCOUNT', mappedAppAccountId: null },
    ];
    pendingDb = [makePending({ accountId: 'pluggy_acc_1' })];
    const importSpy = vi.fn();
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount(), makeAccount({ id: 'a2', name: 'Nubank' })]}
        onImportTransactions={importSpy}
      />
    );

    fireEvent.click(screen.getByText('Painel de Conciliação'));
    await waitFor(() => {
      expect(screen.getByText('PIX *PADARIA SÃO JOSÉ')).toBeInTheDocument();
    });

    const rowAccountSelect = screen.getByTitle('Associe a conta/cartão da Pluggy a uma conta cadastrada no sistema');
    fireEvent.change(rowAccountSelect, { target: { value: 'a2' } });

    await waitFor(() => {
      expect(requests.some(r => r.method === 'POST' && r.url.includes('/api/pluggy/accounts/map'))).toBe(true);
    });

    fireEvent.click(screen.getAllByText('Aprovar')[0]);
    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledTimes(1);
    });
    const imported = importSpy.mock.calls[0][0][0] as Transaction;
    expect(imported.accountId).toBe('a2');
  });

  it('após conectar, abre o modal de associação de contas e salva sem sincronizar', async () => {
    mockFetch((url: string, init?: RequestInit) => {
      if (url.includes('/api/pluggy/connect-token')) {
        return { accessToken: 'tok_123' };
      }
      if (url.includes('/api/pluggy/connections') && init?.method === 'POST') {
        return { id: 'conn_1', itemId: 'item_1', connectorName: 'Banco Itaú' };
      }
      return defaultImpl(url, init?.method || 'GET', init);
    });
    accountDb = [
      { pluggyAccountId: 'pluggy_acc_1', itemId: 'item_1', name: 'Conta Corrente Itaú', subtype: 'CHECKING_ACCOUNT', mappedAppAccountId: null },
    ];

    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount(), makeAccount({ id: 'a2', name: 'Nubank' })]}
      />
    );

    fireEvent.click(screen.getByText('Conectar banco'));
    await waitFor(() => {
      expect(capturedSuccess.current).not.toBeNull();
    });

    capturedSuccess.current!({ item: { id: 'item_1', connector: { name: 'Banco Itaú', imageUrl: '' } } });

    await waitFor(() => {
      expect(screen.getByText(/Associar contas do banco/)).toBeInTheDocument();
    });
    expect(screen.getAllByText('Conta Corrente Itaú').length).toBeGreaterThan(0);

    const mappingSelect = screen.getAllByRole('combobox').pop() as HTMLElement;
    fireEvent.change(mappingSelect, { target: { value: 'a2' } });

    fireEvent.click(screen.getByText('Salvar associações'));

    await waitFor(() => {
      expect(requests.some(r => r.method === 'POST' && r.url.includes('/api/pluggy/accounts/map'))).toBe(true);
    });
    expect(requests.some(r => r.method === 'POST' && r.url.includes('/api/pluggy/sync'))).toBe(false);
  });

  it('sincroniza apenas uma conta pelo card da aba Conexões', async () => {
    mockFetch();
    accountDb = [
      { pluggyAccountId: 'pluggy_acc_1', itemId: 'item_1', name: 'Conta Corrente Itaú', subtype: 'CHECKING_ACCOUNT', mappedAppAccountId: 'a1' },
      { pluggyAccountId: 'pluggy_acc_credit', itemId: 'item_1', name: 'Cartão de Crédito (demo)', subtype: 'CREDIT_CARD', mappedAppAccountId: 'a2' },
    ];
    pendingDb = [];
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount(), makeAccount({ id: 'a2', name: 'Nubank' })]}
      />
    );

    fireEvent.click(screen.getByText('Conexões'));
    await waitFor(() => {
      expect(screen.getByText('Conta Corrente Itaú')).toBeInTheDocument();
    });

    const syncButtons = screen.getAllByTitle(/Sincronizar as transações/);
    fireEvent.click(syncButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Sincronizar a partir de/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Sincronizar/ }).pop()!);

    await waitFor(() => {
      const call = requests.find(r => r.method === 'POST' && r.url.includes('/api/pluggy/sync'));
      expect(call).toBeTruthy();
      expect(call!.url).toContain('accountId=pluggy_acc_1');
      expect(call!.url).not.toContain('accountId=pluggy_acc_credit');
    });
  });

  it('envia a data inicial (from) ao sincronizar uma conta', async () => {
    mockFetch();
    accountDb = [
      { pluggyAccountId: 'pluggy_acc_1', itemId: 'item_1', name: 'Conta Corrente Itaú', subtype: 'CHECKING_ACCOUNT', mappedAppAccountId: null },
    ];
    pendingDb = [];
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount()]}
      />
    );

    fireEvent.click(screen.getByText('Conexões'));
    await waitFor(() => {
      expect(screen.getByText('Conta Corrente Itaú')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByTitle(/Sincronizar as transações/)[0]);
    await waitFor(() => {
      expect(screen.getByText(/Sincronizar a partir de/)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Sincronizar a partir de'), { target: { value: '2026-08-01' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Sincronizar/ }).pop()!);

    await waitFor(() => {
      const call = requests.find(r => r.method === 'POST' && r.url.includes('/api/pluggy/sync'));
      expect(call).toBeTruthy();
      expect(call!.url).toContain('from=2026-08-01');
    });
  });

  it('não exibe pendências com data anterior à data selecionada', async () => {
    mockFetch();
    accountDb = [
      { pluggyAccountId: 'pluggy_acc_1', itemId: 'item_1', name: 'Conta Corrente Itaú', subtype: 'CHECKING_ACCOUNT', mappedAppAccountId: 'a1' },
    ];
    pendingDb = [
      makePending({ id: 'pend_old', date: '2025-12-01', rawDescription: 'COMPRA ANTIGA 2025' }),
      makePending({ id: 'pend_new', date: '2026-08-10' }),
    ];
    render(<BankIntegration {...baseProps} accounts={[makeAccount()]} />);

    fireEvent.click(screen.getByText('Conexões'));
    await waitFor(() => {
      expect(screen.getByText('Conta Corrente Itaú')).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByTitle(/Sincronizar as transações/)[0]);
    await waitFor(() => {
      expect(screen.getByText(/Sincronizar a partir de/)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Sincronizar a partir de'), { target: { value: '2026-08-01' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Sincronizar/ }).pop()!);

    await waitFor(() => {
      expect(screen.getByText(/A partir de 2026-08-01/)).toBeInTheDocument();
    });
    expect(screen.getByText('PIX *PADARIA SÃO JOSÉ')).toBeInTheDocument();
    expect(screen.queryByText('COMPRA ANTIGA 2025')).not.toBeInTheDocument();
  });

  it('mostra as contas demo na aba Conexões mesmo sem pendências', async () => {
    mockFetch();
    accountDb = [
      { pluggyAccountId: 'pluggy_acc_checking', name: 'Conta Corrente (demo)', subtype: 'CHECKING_ACCOUNT', mappedAppAccountId: null },
      { pluggyAccountId: 'pluggy_acc_credit', name: 'Cartão de Crédito (demo)', subtype: 'CREDIT_CARD', mappedAppAccountId: null },
    ];
    pendingDb = [];
    render(
      <BankIntegration
        {...baseProps}
        accounts={[makeAccount()]}
      />
    );

    fireEvent.click(screen.getByText('Conexões'));
    await waitFor(() => {
      expect(screen.getByText('Conta Corrente (demo)')).toBeInTheDocument();
    });
    expect(screen.getByText('Cartão de Crédito (demo)')).toBeInTheDocument();
    expect(screen.getAllByTitle(/Sincronizar as transações/)).toHaveLength(2);
  });

  it('importa investimento da Pluggy vinculado à conta de investimento', async () => {
    mockFetch();
    investmentDb = [
      { id: 'pluggy_inv_1', name: 'Tesouro Selic 2029', type: 'FIXED_INCOME', subtype: 'TREASURY', amount: 12450.8, amountOriginal: 11000, amountProfit: 1450.8, acquisitionDate: '2025-01-01', annualRate: 11.25 },
    ];
    const onImportInvestments = vi.fn();
    const { rerender } = render(
      <BankIntegration
        {...baseProps}
        accounts={[
          makeAccount(),
          { id: 'inv_acc', name: 'XP Investimentos', type: 'investment', balance: 0, color: 'indigo-500' },
        ]}
        onImportInvestments={onImportInvestments}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tesouro Selic 2029')).toBeInTheDocument();
    });
    expect(screen.getByText(/Carteira de Investimentos/)).toBeInTheDocument();

    const cardSelect = screen
      .getAllByRole('combobox')
      .find(s => Array.from(s.querySelectorAll('option')).some(o => o.textContent === 'Selecione a conta de investimento'));
    fireEvent.change(cardSelect!, { target: { value: 'inv_acc' } });
    fireEvent.click(screen.getByRole('button', { name: /Importar para o app/i }));

    await waitFor(() => {
      expect(onImportInvestments).toHaveBeenCalledTimes(1);
    });
    const inv = onImportInvestments.mock.calls[0][0][0];
    expect(inv.name).toBe('Tesouro Selic 2029');
    expect(inv.accountId).toBe('inv_acc');
    expect(inv.origin).toBe('PLUGGY');
    expect(inv.isReconciled).toBe(true);
    expect(inv.pluggyInvestmentId).toBe('pluggy_inv_1');

    // O status "Importado" deriva da lista real de investimentos do app (via pluggyInvestmentId)
    rerender(
      <BankIntegration
        {...baseProps}
        accounts={[
          makeAccount(),
          { id: 'inv_acc', name: 'XP Investimentos', type: 'investment', balance: 0, color: 'indigo-500' },
        ]}
        investments={[inv]}
        onImportInvestments={onImportInvestments}
      />
    );
    expect(screen.getByText('Importado')).toBeInTheDocument();
  });

  it('oculta investimentos com saldo zero', async () => {
    mockFetch();
    investmentDb = [
      { id: 'pluggy_inv_1', name: 'Tesouro Selic 2029', type: 'FIXED_INCOME', subtype: 'TREASURY', amount: 12450.8 },
      { id: 'pluggy_inv_2', name: 'Fundo Liquidado', type: 'MUTUAL_FUND', amount: 0 },
      { id: 'pluggy_inv_3', name: 'CDB Resgatado', type: 'FIXED_INCOME', subtype: 'CDB', amount: -50 },
    ];
    render(
      <BankIntegration
        {...baseProps}
        accounts={[
          makeAccount(),
          { id: 'inv_acc', name: 'XP Investimentos', type: 'investment', balance: 0, color: 'indigo-500' },
        ]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tesouro Selic 2029')).toBeInTheDocument();
    });
    expect(screen.getByText('Tesouro Selic 2029')).toBeInTheDocument();
    expect(screen.queryByText('Fundo Liquidado')).not.toBeInTheDocument();
    expect(screen.queryByText('CDB Resgatado')).not.toBeInTheDocument();
  });

  it('importa em lote os ativos selecionados para a conta de investimento', async () => {
    mockFetch();
    investmentDb = [
      { id: 'pluggy_inv_1', name: 'Tesouro Selic 2029', type: 'FIXED_INCOME', subtype: 'TREASURY', amount: 12450.8, amountProfit: 1450.8, acquisitionDate: '2025-01-01', annualRate: 11.25 },
      { id: 'pluggy_inv_2', name: 'CDB Banco XP', type: 'FIXED_INCOME', subtype: 'CDB', amount: 8750.25, amountProfit: 750.25, acquisitionDate: '2025-06-01', annualRate: 14.95 },
    ];
    const onImportInvestments = vi.fn();
    render(
      <BankIntegration
        {...baseProps}
        accounts={[
          makeAccount(),
          { id: 'inv_acc', name: 'XP Investimentos', type: 'investment', balance: 0, color: 'indigo-500' },
        ]}
        onImportInvestments={onImportInvestments}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tesouro Selic 2029')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Selecionar todos/ }));
    fireEvent.change(screen.getByRole('combobox', { name: /Aplicar conta a todos os selecionados/ }), { target: { value: 'inv_acc' } });
    fireEvent.click(screen.getByRole('button', { name: /Importar selecionados/ }));

    await waitFor(() => {
      expect(onImportInvestments).toHaveBeenCalledTimes(1);
    });
    const imported = onImportInvestments.mock.calls[0][0];
    expect(imported).toHaveLength(2);
    expect(imported.map((i: any) => i.name).sort()).toEqual(['CDB Banco XP', 'Tesouro Selic 2029']);
    expect(imported.every((i: any) => i.origin === 'PLUGGY' && i.isReconciled === true && i.pluggyInvestmentId)).toBe(true);
    expect(imported.every((i: any) => i.accountId === 'inv_acc')).toBe(true);
  });

  it('não reimporta ativo já presente no app', async () => {
    mockFetch();
    investmentDb = [
      { id: 'pluggy_inv_1', name: 'Tesouro Selic 2029', type: 'FIXED_INCOME', subtype: 'TREASURY', amount: 12450.8 },
    ];
    const onImportInvestments = vi.fn();
    const { rerender } = render(
      <BankIntegration
        {...baseProps}
        accounts={[
          makeAccount(),
          { id: 'inv_acc', name: 'XP Investimentos', type: 'investment', balance: 0, color: 'indigo-500' },
        ]}
        investments={[{
          id: 'existing_inv', type: 'TREASURY', name: 'Tesouro Selic 2029',
          initialAmount: 11000, currentAmount: 12450.8, startDate: '2025-01-01', simpleYield: 11.25,
          accountId: 'inv_acc', origin: 'PLUGGY', pluggyInvestmentId: 'pluggy_inv_1', isReconciled: true, contributionsCount: 1,
        }]}
        onImportInvestments={onImportInvestments}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Importado')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Importado/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Selecionar todos \(0\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar selecionados \(0\)/ })).toBeDisabled();

    // Simula uma nova carga da Pluggy (remoção da seleção e reload): o ativo continua marcado
    rerender(
      <BankIntegration
        {...baseProps}
        accounts={[
          makeAccount(),
          { id: 'inv_acc', name: 'XP Investimentos', type: 'investment', balance: 0, color: 'indigo-500' },
        ]}
        investments={[{
          id: 'existing_inv', type: 'TREASURY', name: 'Tesouro Selic 2029',
          initialAmount: 11000, currentAmount: 12450.8, startDate: '2025-01-01', simpleYield: 11.25,
          accountId: 'inv_acc', origin: 'PLUGGY', pluggyInvestmentId: 'pluggy_inv_1', isReconciled: true, contributionsCount: 1,
        }]}
        onImportInvestments={onImportInvestments}
      />
    );
    expect(screen.getByText('Importado')).toBeInTheDocument();
  });

  it('avisa quando não há conta de investimento para vincular', async () => {
    mockFetch();
    investmentDb = [
      { id: 'pluggy_inv_1', name: 'Tesouro Selic 2029', type: 'FIXED_INCOME', amount: 12450.8 },
    ];
    render(<BankIntegration {...baseProps} accounts={[makeAccount()]} />);

    await waitFor(() => {
      expect(screen.getByText('Tesouro Selic 2029')).toBeInTheDocument();
    });
    expect(screen.getByText(/Nenhuma conta de investimento cadastrada/i)).toBeInTheDocument();
  });

  it('aplica a conta de investimento escolhida no lote a todos os ativos selecionados', async () => {
    mockFetch();
    investmentDb = [
      { id: 'pluggy_inv_1', name: 'Tesouro Selic 2029', type: 'FIXED_INCOME', subtype: 'TREASURY', amount: 12450.8, amountProfit: 1450.8, acquisitionDate: '2025-01-01', annualRate: 11.25 },
      { id: 'pluggy_inv_2', name: 'CDB Banco XP', type: 'FIXED_INCOME', subtype: 'CDB', amount: 8750.25, amountProfit: 750.25, acquisitionDate: '2025-06-01', annualRate: 14.95 },
    ];
    const onImportInvestments = vi.fn();
    render(
      <BankIntegration
        {...baseProps}
        accounts={[
          makeAccount(),
          { id: 'inv_acc', name: 'XP Investimentos', type: 'investment', balance: 0, color: 'indigo-500' },
          { id: 'inv_acc2', name: 'Inter Invest', type: 'investment', balance: 0, color: 'green-500' },
        ]}
        onImportInvestments={onImportInvestments}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tesouro Selic 2029')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Selecionar todos/ }));
    const batchSelect = screen.getByRole('combobox', { name: /Aplicar conta a todos os selecionados/ }) as HTMLSelectElement;
    fireEvent.change(batchSelect, { target: { value: 'inv_acc2' } });
    expect(batchSelect.value).toBe('inv_acc2');

    // Os selects individuais de cada card refletem a conta aplicada em lote
    const cardSelects = screen.getAllByRole('combobox').filter(s => (s as HTMLSelectElement).value === 'inv_acc2' && (s as HTMLSelectElement).getAttribute('aria-label') !== 'Aplicar conta a todos os selecionados');
    expect(cardSelects.length).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: /Importar selecionados/ }));
    await waitFor(() => {
      expect(onImportInvestments).toHaveBeenCalledTimes(1);
    });
    const imported = onImportInvestments.mock.calls[0][0];
    expect(imported.every((i: any) => i.accountId === 'inv_acc2')).toBe(true);
  });
});