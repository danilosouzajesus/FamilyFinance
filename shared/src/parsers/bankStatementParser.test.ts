import { describe, it, expect } from 'vitest';
import {
  parseBankStatementText,
  parseBancoBvStatement,
  parseBancoBvInvoice,
  parseSantanderStatement,
  parseSantanderInvoice,
  parseItauStatement,
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

  it('faz parse de fatura de cartão de crédito do Banco BV corretamente', () => {
    const sampleBvInvoiceText = `
Olá, Danilo!
Esta é a sua fatura de Agosto no valor de R$ 106,66
Vencimento: 25/08/2026
Cartão BV Único - Master: **** **** **** 6097

Resumo das Transações
Essa fatura reflete os valores até a data de fechamento: 20/08/2026

Detalhamento das transações
Pagamentos
Data Descrição Valor em R$
27/07 Pagamento (-) R$ 182,82

Lançamentos nacionais
Data Descrição Localização Valor em R$
19/07 IFD*PATTIESVILA978D2C1 SAO PAULO R$ 37,48
31/07 Resgate Cashback - (-) R$ 0,55
18/08 ESTACIONAMENTO CIDADE SAO PAULO R$ 50,00
18/08 SAO JOSE MERCADO SAO PAULO R$ 19,73
    `;

    const result = parseBancoBvInvoice(sampleBvInvoiceText);
    expect(result).not.toBeNull();
    expect(result?.transactions).toHaveLength(5);

    const txs = result!.transactions;

    // Pagamento de fatura (crédito no cartão)
    expect(txs[0].date).toBe('2026-07-27');
    expect(txs[0].description).toBe('Pagamento');
    expect(txs[0].type).toBe('income');
    expect(txs[0].amount).toBe(182.82);

    // Compra 1 (Patties)
    expect(txs[1].date).toBe('2026-07-19');
    expect(txs[1].description).toBe('IFD*PATTIESVILA978D2C1');
    expect(txs[1].type).toBe('expense');
    expect(txs[1].amount).toBe(37.48);

    // Reembolso/Cashback
    expect(txs[2].date).toBe('2026-07-31');
    expect(txs[2].description).toBe('Resgate Cashback');
    expect(txs[2].type).toBe('income');
    expect(txs[2].amount).toBe(0.55);

    // Compra 2 (Estacionamento)
    expect(txs[3].date).toBe('2026-08-18');
    expect(txs[3].description).toBe('ESTACIONAMENTO CIDADE');
    expect(txs[3].type).toBe('expense');
    expect(txs[3].amount).toBe(50.0);

    // Compra 3 (Sao Jose Mercado)
    expect(txs[4].date).toBe('2026-08-18');
    expect(txs[4].description).toBe('SAO JOSE MERCADO');
    expect(txs[4].type).toBe('expense');
    expect(txs[4].amount).toBe(19.73);
  });

  it('faz parse de extrato de conta corrente do Santander corretamente', () => {
    const sampleSantanderText = `
Internet Banking
EXTRATO DE CONTA CORRENTE
DANILO DE SOUZA JESUS Agência e Conta: 2986 / 03018043-0
Período: 01/08/2026 a 22/08/2026
Data Descrição Docto Situação Crédito (R$) Débito (R$) Saldo (R$)
21/08/2026 DEBITO VISA ELECTRON BRASIL 21/08 OTICA RED 390165 -20,00 389,33
19/08/2026 REMUNERACAO APLICACAO AUTOMATICA 000000 0,02 409,33
19/08/2026 PAGAMENTO CARTAO CREDITO BCE 19/08 06:44 CARTAO VISA 064410 -8.765,68 409,31
18/08/2026 PAGAMENTO DE BOLETO OUTROS BANCOS WATER PARK SAO
PEDRO EMPR
000000 -488,94 7.320,98
14/08/2026 PIX RECEBIDO DANILO DE SOUZA JESUS 000000 7.300,62 8.298,86
Saldo anterior
Data
01/08/2026
Saldo (R$)
82,21
    `;

    const result = parseSantanderStatement(sampleSantanderText);
    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('Banco Santander');
    expect(result?.bankCode).toBe('033');
    expect(result?.agency).toBe('2986');
    expect(result?.accountNumber).toBe('03018043-0');
    expect(result?.holderName).toBe('DANILO DE SOUZA JESUS');
    expect(result?.period).toBe('01/08/2026 a 22/08/2026');

    const txs = result?.transactions || [];
    expect(txs).toHaveLength(5);

    // Transação 1: Débito com data
    expect(txs[0].date).toBe('2026-08-21');
    expect(txs[0].description).toBe('DEBITO VISA ELECTRON BRASIL 21/08 OTICA RED');
    expect(txs[0].type).toBe('expense');
    expect(txs[0].amount).toBe(20.0);
    expect(txs[0].balanceAfter).toBe(389.33);

    // Transação 2: Crédito com data
    expect(txs[1].date).toBe('2026-08-19');
    expect(txs[1].description).toBe('REMUNERACAO APLICACAO AUTOMATICA');
    expect(txs[1].type).toBe('income');
    expect(txs[1].amount).toBe(0.02);
    expect(txs[1].balanceAfter).toBe(409.33);

    // Transação 3: Grande débito
    expect(txs[2].date).toBe('2026-08-19');
    expect(txs[2].description).toBe('PAGAMENTO CARTAO CREDITO BCE 19/08 06:44 CARTAO VISA');
    expect(txs[2].type).toBe('expense');
    expect(txs[2].amount).toBe(8765.68);

    // Transação 4: Multiline
    expect(txs[3].date).toBe('2026-08-18');
    expect(txs[3].description).toBe('PAGAMENTO DE BOLETO OUTROS BANCOS WATER PARK SAO PEDRO EMPR');
    expect(txs[3].type).toBe('expense');
    expect(txs[3].amount).toBe(488.94);

    // Transação 5: PIX Recebido
    expect(txs[4].date).toBe('2026-08-14');
    expect(txs[4].description).toBe('PIX RECEBIDO DANILO DE SOUZA JESUS');
    expect(txs[4].type).toBe('income');
    expect(txs[4].amount).toBe(7300.62);
  });

  it('faz parse de extrato de conta corrente do Itaú corretamente', () => {
    const sampleItauText = `
Itaú   DANILO DE SOUZA JESUS   CPF: 359.533.768-98   agência: 0350   conta: 21911-9
saldo em conta R$ 0,00   Limite da Conta utilizado R$ 0,00   Limite da Conta disponível R$ 50,00
extrato conta corrente
lançamentos
período de visualização: de 01/08/2026 até 22/08/2026   emitido em: 22/08/2026 00:22:40
data lançamentos valor (R$) saldo (R$)
31/07/2026 SALDO ANTERIOR 0,00
05/08/2026 PIX TRANSF SUL AME05/08 336,00
05/08/2026 SALDO TOTAL DISPONÍVEL DIA 336,00
19/08/2026 PIX TRANSF DANILO 19/08 -336,00
19/08/2026 SALDO TOTAL DISPONÍVEL DIA 0,00
    `;

    const result = parseItauStatement(sampleItauText);
    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('Banco Itaú');
    expect(result?.bankCode).toBe('341');
    expect(result?.agency).toBe('0350');
    expect(result?.accountNumber).toBe('21911-9');
    expect(result?.holderName).toBe('DANILO DE SOUZA JESUS');
    expect(result?.period).toBe('01/08/2026 até 22/08/2026');
    expect(result?.availableBalance).toBe(0.0);

    const txs = result?.transactions || [];
    expect(txs).toHaveLength(2); // Deve filtrar e pular as linhas de "SALDO ANTERIOR" e "SALDO TOTAL DISPONÍVEL DIA"

    // Transação 1: PIX Recebido (Crédito)
    expect(txs[0].date).toBe('2026-08-05');
    expect(txs[0].description).toBe('PIX TRANSF SUL AME05/08');
    expect(txs[0].type).toBe('income');
    expect(txs[0].amount).toBe(336.00);

    // Transação 2: PIX Enviado (Débito)
    expect(txs[1].date).toBe('2026-08-19');
    expect(txs[1].description).toBe('PIX TRANSF DANILO 19/08');
    expect(txs[1].type).toBe('expense');
    expect(txs[1].amount).toBe(336.00);
  });

  it('faz parse de fatura de cartão de crédito do Santander corretamente', () => {
    const sampleSantanderInvoiceText = `
Olá, Danilo! Esta é a fatura do seu cartão SANTANDER
UNIQUE VISA contendo compras e pagamentos realizados até 17/08.
DANILO DE SOUZA JESUS - 4258 XXXX XXXX 8773
Total a Pagar R$ 8.765,68
Vencimento 23/08/2026
Seu limite é R$68.924,00

Detalhamento da Fatura
DANILO SOUZA JESUS - 4258 XXXX XXXX 8773
Pagamento e Demais Créditos
Compra Data Descrição Parcela R$ US$
17/06 CAOA CHERY JOAO DIAS -0,02
18/07 PAGAMENTO DE FATURA-INTERNET -8.192,68
31/07 CASHBACK ESFERA - 316850069 -257,64

Parcelamentos
Compra Data Descrição Parcela R$ US$
3 27/11 JOAO FREIRE BRAGA JUN 09/12 281,00
3 17/06 CAOA CHERY JOAO DIAS 02/03 808,97

Despesas
Compra Data Descrição Parcela R$ US$
3 15/07 BACIO DI LATTE-LJ0007 74,85
3 15/07 RESTAURANTE MORUMBI CA 58,80
3 15/07 OXXO VISTA POPULAR 19,58
3 31/07 TIPO PRIME 123,00
17/08 ANUIDADE DIFERENCIADA 0,00
    `;

    const result = parseSantanderInvoice(sampleSantanderInvoiceText);
    expect(result).not.toBeNull();
    expect(result?.bankName).toBe('Banco Santander');
    expect(result?.bankCode).toBe('033');
    expect(result?.accountNumber).toBe('4258 XXXX XXXX 8773');
    expect(result?.holderName).toBe('DANILO DE SOUZA JESUS');
    expect(result?.availableBalance).toBe(-8765.68); // Saldo a pagar negativo

    const txs = result?.transactions || [];
    expect(txs).toHaveLength(9); // Não inclui anuidade zerada ou linhas informativas

    // Pagamento/Crédito: -8192.68
    expect(txs[1].description).toBe('PAGAMENTO DE FATURA-INTERNET');
    expect(txs[1].type).toBe('income');
    expect(txs[1].amount).toBe(8192.68);

    // Parcelado: JOAO FREIRE BRAGA JUN 09/12
    expect(txs[3].description).toBe('JOAO FREIRE BRAGA JUN (Parcela 09/12)');
    expect(txs[3].type).toBe('expense');
    expect(txs[3].amount).toBe(281.00);

    // Despesa comum: BACIO DI LATTE
    expect(txs[5].description).toBe('BACIO DI LATTE-LJ0007');
    expect(txs[5].type).toBe('expense');
    expect(txs[5].amount).toBe(74.85);
  });
});
