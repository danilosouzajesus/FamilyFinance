import { describe, it, expect } from 'vitest';
import {
  parseBankStatementText,
  parseBancoBvStatement,
  normalizeDateString,
  parseBRLNumber,
} from './bankStatementParser';

describe('bankStatementParser', () => {
  const sampleBancoBvText = `
Cliente
DANILO DE SOUZA JESUS Cpf/Cnpj: 359.533.768-98
Conta
Extrato de Conta Corrente
Titular: DANILO DE SOUZA JESUS
Emissao: 21/08/2026 19:58
Banco: 413 Agencia: 2020 Conta Corrente: 19557787 Aberta em: 14/10/2021
Saldo Disponivel: 0,00
Periodo: 01/08/2026 a 20/08/2026

Data Historico No Documento Debito Credito Saldo
06/08/2026 Transferência recebida via Pix E18236120202608061421s041ead00b4 - 148,51 148,51
07/08/2026 Transferência recebida via Pix E3187249520260807172020292VBDJyd - 2.143,47 2.291,98
10/08/2026 Transferência enviada via Pix E0185877420260810223224363P3EUCM 2.291,98 - 0,00
14/08/2026 RECEBIMENTO DE SALARIO 00119595881110001034fe853abf2d - 7.373,62 7.373,62
14/08/2026 Transferência enviada via Pix E0185877420260814123902137P9BAQ3 7.300,62 - 73,00
19/08/2026 Transferência recebida via Pix E3187249520260819093510729y7H53U - 1.445,00 1.518,00
19/08/2026 Transferência enviada via Pix E0185877420260819094237024PNO1DN 1.518,00 - 0,00
Saldo em: 20/08/2026 0,00
`;

  it('extrai metadados da conta do Banco BV corretamente', () => {
    const result = parseBancoBvStatement(sampleBancoBvText);
    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('Banco BV');
    expect(result?.bankCode).toBe('413');
    expect(result?.agency).toBe('2020');
    expect(result?.accountNumber).toBe('19557787');
    expect(result?.holderName).toBe('DANILO DE SOUZA JESUS');
    expect(result?.period).toBe('01/08/2026 a 20/08/2026');
  });

  it('extrai todas as 7 transações do extrato Banco BV com tipos e valores precisos', () => {
    const result = parseBankStatementText(sampleBancoBvText);
    expect(result.transactions).toHaveLength(7);

    const [tx1, tx2, tx3, tx4, tx5, tx6, tx7] = result.transactions;

    // Tx 1: PIX Recebido R$ 148,51 (06/08/2026)
    expect(tx1.date).toBe('2026-08-06');
    expect(tx1.description).toBe('Transferência recebida via Pix');
    expect(tx1.documentNumber).toBe('E18236120202608061421s041ead00b4');
    expect(tx1.type).toBe('income');
    expect(tx1.amount).toBe(148.51);
    expect(tx1.paymentMethod).toBe('PIX');
    expect(tx1.balanceAfter).toBe(148.51);

    // Tx 2: PIX Recebido R$ 2.143,47 (07/08/2026)
    expect(tx2.date).toBe('2026-08-07');
    expect(tx2.type).toBe('income');
    expect(tx2.amount).toBe(2143.47);

    // Tx 3: PIX Enviado R$ 2.291,98 (10/08/2026)
    expect(tx3.date).toBe('2026-08-10');
    expect(tx3.description).toBe('Transferência enviada via Pix');
    expect(tx3.type).toBe('expense');
    expect(tx3.amount).toBe(2291.98);
    expect(tx3.paymentMethod).toBe('PIX');

    // Tx 4: Salário R$ 7.373,62 (14/08/2026)
    expect(tx4.date).toBe('2026-08-14');
    expect(tx4.description).toBe('RECEBIMENTO DE SALARIO');
    expect(tx4.type).toBe('income');
    expect(tx4.amount).toBe(7373.62);
    expect(tx4.suggestedCategory).toBe('Salário & Benefícios');

    // Tx 5: PIX Enviado R$ 7.300,62 (14/08/2026)
    expect(tx5.date).toBe('2026-08-14');
    expect(tx5.type).toBe('expense');
    expect(tx5.amount).toBe(7300.62);

    // Tx 6: PIX Recebido R$ 1.445,00 (19/08/2026)
    expect(tx6.date).toBe('2026-08-19');
    expect(tx6.type).toBe('income');
    expect(tx6.amount).toBe(1445.0);

    // Tx 7: PIX Enviado R$ 1.518,00 (19/08/2026)
    expect(tx7.date).toBe('2026-08-19');
    expect(tx7.type).toBe('expense');
    expect(tx7.amount).toBe(1518.0);
    expect(tx7.balanceAfter).toBe(0);
  });

  it('normaliza datas corretamente', () => {
    expect(normalizeDateString('21/08/2026')).toBe('2026-08-21');
    expect(normalizeDateString('01-05-2025')).toBe('2025-05-01');
    expect(normalizeDateString('2026-08-20')).toBe('2026-08-20');
  });

  it('faz parse de valores em reais pt-BR', () => {
    expect(parseBRLNumber('7.373,62')).toBe(7373.62);
    expect(parseBRLNumber('R$ 1.518,00')).toBe(1518);
    expect(parseBRLNumber('-')).toBe(0);
  });
});
