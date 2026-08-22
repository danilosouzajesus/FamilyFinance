import { inferPaymentMethod } from '../integration/pluggy';

export interface ParsedBankTx {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  documentNumber?: string;
  type: 'income' | 'expense';
  amount: number;
  paymentMethod: string;
  suggestedCategory: string;
  suggestedSubcategory?: string;
  confidence: number;
  balanceAfter?: number;
}

export interface ParsedBankStatementResult {
  bankName?: string;
  bankCode?: string;
  agency?: string;
  accountNumber?: string;
  holderName?: string;
  period?: string;
  availableBalance?: number;
  transactions: ParsedBankTx[];
}

/**
 * Converte data DD/MM/YYYY ou DD-MM-YYYY para YYYY-MM-DD
 */
export function normalizeDateString(dateStr: string): string {
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const isoMatch = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Converte string de valor em pt-BR (ex: "7.373,62", "148,51", "- 1.518,00") para number
 */
export function parseBRLNumber(valStr: string): number {
  if (!valStr || valStr === '-') return 0;
  const clean = valStr
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Sugere categoria padrão a partir da descrição e tipo do extrato bancário
 */
export function suggestCategoryForStatement(description: string, type: 'income' | 'expense'): { category: string; subcategory?: string } {
  const d = description.toUpperCase();

  if (type === 'income') {
    if (d.includes('TRANSFERENCIA') || d.includes('TRANSFERÊNCIA') || d.includes('ENTRE CONTAS') || d.includes('TRANSF')) {
      return { category: 'Transferências', subcategory: 'Transferência entre Contas' };
    }
    if (d.includes('SALARIO') || d.includes('SALÁRIO') || d.includes('PAGAMENTO DE SALARIO') || d.includes('REMUNERA')) {
      return { category: 'Salário & Benefícios', subcategory: 'Salário' };
    }
    if (d.includes('RENDIMENTO') || d.includes('DIVIDENDO') || d.includes('JUROS')) {
      return { category: 'Investimentos', subcategory: 'Rendimentos' };
    }
    if (d.includes('PIX') || d.includes('TED') || d.includes('DOC')) {
      return { category: 'Transferências', subcategory: 'PIX Enviado / Recebido' };
    }
    return { category: 'Outras Receitas' };
  }

  // Expense
  if (d.includes('TRANSFERENCIA') || d.includes('TRANSFERÊNCIA') || d.includes('ENTRE CONTAS') || d.includes('TRANSF')) {
    return { category: 'Transferências', subcategory: 'Transferência entre Contas' };
  }
  if (d.includes('PIX') || d.includes('TED') || d.includes('DOC')) {
    return { category: 'Transferências', subcategory: 'PIX Enviado / Recebido' };
  }
  if (d.includes('BOLETO') || d.includes('COBRANCA') || d.includes('PAGAMENTO')) {
    return { category: 'Moradia & Contas', subcategory: 'Boletos' };
  }
  if (d.includes('MERCADO') || d.includes('SUPERMERCADO') || d.includes('PADARIA') || d.includes('ASSAI') || d.includes('EXTRA')) {
    return { category: 'Mercado', subcategory: 'Supermercado' };
  }
  if (d.includes('FARMACIA') || d.includes('DROGARIA') || d.includes('MEDIC')) {
    return { category: 'Saúde', subcategory: 'Farmácia' };
  }
  if (d.includes('POSTO') || d.includes('COMBUSTIVEL') || d.includes('GASOLINA') || d.includes('UBER')) {
    return { category: 'Transporte', subcategory: 'Combustível' };
  }

  return { category: 'Outras Despesas' };
}

/**
 * Parser especializado para Extratos do Banco BV (Banco 413 / Votorantim)
 */
export function parseBancoBvStatement(text: string): ParsedBankStatementResult | null {
  const isBV = /BANCO\s*(?:DO\s*)?BV|BANCO\s*413|BANCO\s*VOTORANTIM|413\s+2020/i.test(text) ||
    (text.includes('Extrato de Conta Corrente') && text.includes('No Documento') && text.includes('Debito') && text.includes('Credito'));

  if (!isBV) return null;

  const result: ParsedBankStatementResult = {
    bankName: 'Banco BV',
    bankCode: '413',
    transactions: []
  };

  // Extração de Metadados
  const holderMatch = text.match(/Titular:\s*([^\n\r]+?)(?:\s+Cpf|\s+Emissao|\s+Conta|$)/i) ||
    text.match(/Cliente\s*\n\s*([A-Z\s]{4,})/i);
  if (holderMatch) {
    result.holderName = holderMatch[1].replace(/Cpf\/Cnpj:.*$/i, '').trim();
  }

  const agencyMatch = text.match(/Agencia:\s*(\d+)/i) || text.match(/\b413\s+(\d{4})\b/);
  if (agencyMatch) result.agency = agencyMatch[1].trim();

  const accountMatch = text.match(/Conta Corrente:\s*(\d+)/i) || text.match(/\b413\s+\d{4}\s+(\d{6,12})\b/);
  if (accountMatch) result.accountNumber = accountMatch[1].trim();

  const periodMatch = text.match(/Periodo:\s*([^\n\r]+)/i);
  if (periodMatch) result.period = periodMatch[1].trim();

  const balanceMatch = text.match(/Saldo Disponivel:\s*([\d.,]+)/i);
  if (balanceMatch) result.availableBalance = parseBRLNumber(balanceMatch[1]);

  // Processamento de linhas de transação
  // Formato da tabela BV:
  // Data | Historico | No Documento | Debito | Credito | Saldo
  // Exemplo: "06/08/2026 Transferência recebida via Pix E18236120202608061421s041ead00b4 - 148,51 148,51"
  // Exemplo: "10/08/2026 Transferência enviada via Pix E0185877420260810223224363P3EUCM 2.291,98 - 0,00"
  // Exemplo: "14/08/2026 RECEBIMENTO DE SALARIO 00119595881110001034fe853abf2d - 7.373,62 7.373,62"

  // Limpar quebras intermediárias dentro de códigos de documento longos (ex: "E182...\n041ead...")
  const normalizedText = text.replace(/([A-Za-z0-9]{10,})\s*\n\s*([A-Za-z0-9]{5,})/g, '$1$2');
  const lines = normalizedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let txIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Ignorar cabeçalhos e totais de rodapé
    if (/^Data\s+Historico/i.test(line) || /^Saldo em:/i.test(line) || /^Periodo:/i.test(line) || /^Valores expressos/i.test(line)) {
      continue;
    }

    // Verificar se começa com data DD/MM/YYYY
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
    if (!dateMatch) continue;

    const rawDate = dateMatch[1];
    const rest = dateMatch[2].trim();

    // Regex para pegar os valores finais: Debito, Credito, Saldo
    // Pode ter: "- 148,51 148,51" ou "2.291,98 - 0,00" ou "7.300,62 - 73,00"
    const amountsMatch = rest.match(/(-|[\d.,]+)\s+(-|[\d.,]+)\s+([\d.,]+)$/);
    if (!amountsMatch) continue;

    const debitoStr = amountsMatch[1];
    const creditoStr = amountsMatch[2];
    const saldoStr = amountsMatch[3];

    // Conteúdo antes dos valores é a Descrição + No Documento
    const descAndDoc = rest.slice(0, rest.length - amountsMatch[0].length).trim();

    // Separar documento alfanumérico no final da descrição se houver (ex: E182361..., 0011959588...)
    let description = descAndDoc;
    let docNumber: string | undefined;

    const docExtract = descAndDoc.match(/^(.+?)\s+([A-Za-z0-9]{12,})$/);
    if (docExtract) {
      description = docExtract[1].trim();
      docNumber = docExtract[2].trim();
    }

    const debitoVal = parseBRLNumber(debitoStr);
    const creditoVal = parseBRLNumber(creditoStr);
    const isIncome = creditoVal > 0 && (debitoVal === 0 || debitoStr === '-');
    const amount = isIncome ? creditoVal : debitoVal;

    if (amount <= 0) continue;

    txIdx++;
    const type: 'income' | 'expense' = isIncome ? 'income' : 'expense';
    const catSuggestion = suggestCategoryForStatement(description, type);

    result.transactions.push({
      id: `bv_pdf_${Date.now()}_${txIdx}`,
      date: normalizeDateString(rawDate),
      description,
      documentNumber: docNumber,
      type,
      amount,
      paymentMethod: inferPaymentMethod(description),
      suggestedCategory: catSuggestion.category,
      suggestedSubcategory: catSuggestion.subcategory,
      confidence: description.toUpperCase().includes('SALARIO') ? 95 : 90,
      balanceAfter: parseBRLNumber(saldoStr)
    });
  }

  return result.transactions.length > 0 ? result : null;
}

/**
 * Parser genérico para Extratos Bancários Brasileiros em formato Texto/PDF
 */
export function parseGenericBankStatement(text: string): ParsedBankStatementResult {
  const result: ParsedBankStatementResult = {
    transactions: []
  };

  // Identificação do banco genérico
  if (/NUBANK|NU PAGAMENTOS/i.test(text)) {
    result.bankName = 'Nubank';
    result.bankCode = '260';
  } else if (/ITAU|ITAÚ/i.test(text)) {
    result.bankName = 'Itaú Unibanco';
    result.bankCode = '341';
  } else if (/BRADESCO/i.test(text)) {
    result.bankName = 'Banco Bradesco';
    result.bankCode = '237';
  } else if (/SANTANDER/i.test(text)) {
    result.bankName = 'Banco Santander';
    result.bankCode = '033';
  } else if (/INTER|BANCO INTER/i.test(text)) {
    result.bankName = 'Banco Inter';
    result.bankCode = '077';
  } else if (/BANCO DO BRASIL|BB/i.test(text)) {
    result.bankName = 'Banco do Brasil';
    result.bankCode = '001';
  } else if (/C6 BANK|C6/i.test(text)) {
    result.bankName = 'C6 Bank';
    result.bankCode = '336';
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let txIdx = 0;

  for (const line of lines) {
    if (/^Data\b/i.test(line) || /^Saldo\b/i.test(line) || /^Extrato/i.test(line) || /^Total/i.test(line)) {
      continue;
    }

    // Padrão 1: Data DD/MM/YYYY seguida de descrição e valor com R$ ou -/+
    const match = line.match(/(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+(.+?)\s+([+-]?\s*(?:R\$\s*)?[\d.]+,\d{2})(?:\s+([+-]?\s*(?:R\$\s*)?[\d.]+,\d{2}))?$/);
    if (!match) continue;

    const rawDate = match[1];
    const description = match[2].trim();
    const rawAmount = match[3];

    const isExplicitExpense = rawAmount.includes('-') || line.toLowerCase().includes('debito') || line.toLowerCase().includes('saída');
    const isExplicitIncome = rawAmount.includes('+') || line.toLowerCase().includes('credito') || line.toLowerCase().includes('entrada');
    
    const absVal = parseBRLNumber(rawAmount);
    if (absVal <= 0) continue;

    const type: 'income' | 'expense' = isExplicitIncome ? 'income' : (isExplicitExpense ? 'expense' : (rawAmount.includes('-') ? 'expense' : 'expense'));
    const catSuggestion = suggestCategoryForStatement(description, type);

    txIdx++;
    result.transactions.push({
      id: `gen_pdf_${Date.now()}_${txIdx}`,
      date: normalizeDateString(rawDate),
      description,
      type,
      amount: absVal,
      paymentMethod: inferPaymentMethod(description),
      suggestedCategory: catSuggestion.category,
      suggestedSubcategory: catSuggestion.subcategory,
      confidence: 80
    });
  }

  return result;
}

/**
 * Parser especializado para Faturas de Cartão de Crédito do Banco BV
 */
export function parseBancoBvInvoice(text: string): ParsedBankStatementResult | null {
  const isBVInvoice = /Cartão BV/i.test(text) && /Lançamentos nacionais|Resumo das Transações/i.test(text);
  if (!isBVInvoice) return null;

  const result: ParsedBankStatementResult = {
    bankName: 'Banco BV',
    bankCode: '413',
    transactions: []
  };

  // Encontra a data de fechamento ou vencimento para extrair o ano de referência
  const closingDateMatch = text.match(/fechamento:\s*(\d{2}\/\d{2}\/\d{4})/i) ||
                           text.match(/Vencimento:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const refDateStr = closingDateMatch ? closingDateMatch[1] : undefined;
  
  let refYear = new Date().getFullYear();
  let refMonth = new Date().getMonth() + 1;
  if (refDateStr) {
    const parts = refDateStr.split('/');
    refYear = parseInt(parts[2], 10);
    refMonth = parseInt(parts[1], 10);
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let txIdx = 0;

  for (const line of lines) {
    // Procura por linhas que começam com data DD/MM (ex: 19/07 ou 18/08)
    const match = line.match(/^(\d{2})[/-](\d{2})\s+(.+?)\s+([+-]?\s*(?:\(-\)\s*)?(?:R\$\s*)?[\d.]+,\d{2})$/);
    if (!match) continue;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const descAndLoc = match[3].trim();
    const rawAmount = match[4];

    // Evita pegar linhas de resumo ou totais que por acaso batam no regex
    if (descAndLoc.toLowerCase().includes('fechamento') || descAndLoc.toLowerCase().includes('vencimento') || descAndLoc.toLowerCase().includes('total')) {
      continue;
    }

    // Resolve o ano correto para a data DD/MM
    let year = refYear;
    if (month > refMonth && refMonth <= 2 && month >= 11) {
      year = refYear - 1;
    }
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Em fatura de cartão de crédito: se tem "(-)" ou "-" na frente do valor, é um crédito (receita/redução de saldo)
    const isCredit = rawAmount.includes('(-)') || rawAmount.includes('-');
    const type: 'income' | 'expense' = isCredit ? 'income' : 'expense';
    
    // Limpa a descrição removendo localização redundante como "SAO PAULO" ou "-" antes do valor se houver
    let description = descAndLoc;
    description = description.replace(/\s+[A-Z\s]{3,15}$/, '').replace(/\s+-$/, '').trim();

    // Extrai apenas o número com vírgula para evitar problemas com múltiplos sinais (-) ou -
    const numMatch = rawAmount.match(/[\d.]+,\d{2}/);
    const amount = numMatch ? parseBRLNumber(numMatch[0]) : 0;
    if (amount <= 0) continue;

    const catSuggestion = suggestCategoryForStatement(description, type);

    txIdx++;
    result.transactions.push({
      id: `bv_cc_pdf_${Date.now()}_${txIdx}`,
      date: dateStr,
      description,
      type,
      amount,
      paymentMethod: type === 'expense' ? 'CARTAO_CREDITO' : 'PIX',
      suggestedCategory: catSuggestion.category,
      suggestedSubcategory: catSuggestion.subcategory,
      confidence: 85
    });
  }

  return result.transactions.length > 0 ? result : null;
}

/**
 * Parser especializado para Extratos do Banco Santander (Banco 033)
 */
export function parseSantanderStatement(text: string): ParsedBankStatementResult | null {
  const isSantander = /SANTANDER/i.test(text) || (text.includes('EXTRATO DE CONTA CORRENTE') && text.includes('Agência e Conta:'));
  if (!isSantander) return null;

  const result: ParsedBankStatementResult = {
    bankName: 'Banco Santander',
    bankCode: '033',
    transactions: []
  };

  // Extração de Metadados
  let holderName: string | undefined;
  const holderMatch1 = text.match(/([^\n\r]+?)(?=\s+Agência e Conta:)/i);
  if (holderMatch1) {
    holderName = holderMatch1[1].trim();
  } else {
    const holderMatch2 = text.match(/EXTRATO DE CONTA CORRENTE\s*\n\s*([^\n\r]+)/i);
    if (holderMatch2) {
      holderName = holderMatch2[1].trim();
    }
  }
  if (holderName) {
    result.holderName = holderName;
  }

  const agCcMatch = text.match(/Agência e Conta:\s*(\d+)\s*\/\s*([\d-]+)/i);
  if (agCcMatch) {
    result.agency = agCcMatch[1].trim();
    result.accountNumber = agCcMatch[2].trim();
  }

  const periodMatch = text.match(/Período:\s*([^\n\r]+)/i);
  if (periodMatch) {
    result.period = periodMatch[1].trim();
  }

  const balanceMatch = text.match(/Saldo de conta corrente\s*R\$\s*([\d.,]+)/i) || 
                       text.match(/Saldo disponível conta corrente\s*R\$\s*([\d.,]+)/i);
  if (balanceMatch) {
    result.availableBalance = parseBRLNumber(balanceMatch[1]);
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let txIdx = 0;

  interface PendingTx {
    date: string;
    descParts: string[];
  }

  let pending: PendingTx | null = null;

  for (const line of lines) {
    // Ignorar linhas conhecidas de cabeçalhos de tabela ou saldos isolados
    if (/^Data\s+Descrição/i.test(line) || /^Saldo anterior/i.test(line) || /^Último movimento/i.test(line) || /^Saldo de conta/i.test(line)) {
      continue;
    }

    // Verificar se a linha começa com data DD/MM/YYYY
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.*)$/);

    if (dateMatch) {
      const rawDate = dateMatch[1];
      const rest = dateMatch[2].trim();

      // Checa se o restante da linha já contém os valores de encerramento da transação
      // Padrão de encerramento: [Docto de 6 dígitos] [Valor Crédito/Débito] [Saldo]
      const endMatch = rest.match(/\s+(\d{6})\s+(-?[\d.]+,\d{2})\s+(-?[\d.]+,\d{2})$/);
      
      if (endMatch) {
        // Linha única completa
        const docNumber = endMatch[1];
        const rawAmount = endMatch[2];
        const rawBalance = endMatch[3];
        const descAndDoc = rest.slice(0, rest.length - endMatch[0].length).trim();

        const amount = Math.abs(parseBRLNumber(rawAmount));
        const type: 'income' | 'expense' = parseBRLNumber(rawAmount) < 0 ? 'expense' : 'income';
        const catSuggestion = suggestCategoryForStatement(descAndDoc, type);

        txIdx++;
        result.transactions.push({
          id: `santander_pdf_${Date.now()}_${txIdx}`,
          date: normalizeDateString(rawDate),
          description: descAndDoc,
          documentNumber: docNumber,
          type,
          amount,
          paymentMethod: inferPaymentMethod(descAndDoc),
          suggestedCategory: catSuggestion.category,
          suggestedSubcategory: catSuggestion.subcategory,
          confidence: descAndDoc.toUpperCase().includes('SALARIO') ? 95 : 90,
          balanceAfter: parseBRLNumber(rawBalance)
        });
        pending = null;
      } else {
        // Multi-line inicia aqui
        pending = {
          date: rawDate,
          descParts: [rest]
        };
      }
    } else if (pending) {
      // Se não começa com data, mas temos transação pendente, pode ser a continuação da descrição ou a linha com os valores
      const endMatch = line.match(/^(.*?)\s*(\d{6})\s+(-?[\d.]+,\d{2})\s+(-?[\d.]+,\d{2})$/);
      
      if (endMatch) {
        // Linha final com valores!
        const extraDesc = endMatch[1].trim();
        const docNumber = endMatch[2];
        const rawAmount = endMatch[3];
        const rawBalance = endMatch[4];

        if (extraDesc) {
          pending.descParts.push(extraDesc);
        }

        const description = pending.descParts.join(' ').replace(/\s+/g, ' ').trim();
        const amount = Math.abs(parseBRLNumber(rawAmount));
        const type: 'income' | 'expense' = parseBRLNumber(rawAmount) < 0 ? 'expense' : 'income';
        const catSuggestion = suggestCategoryForStatement(description, type);

        txIdx++;
        result.transactions.push({
          id: `santander_pdf_${Date.now()}_${txIdx}`,
          date: normalizeDateString(pending.date),
          description,
          documentNumber: docNumber,
          type,
          amount,
          paymentMethod: inferPaymentMethod(description),
          suggestedCategory: catSuggestion.category,
          suggestedSubcategory: catSuggestion.subcategory,
          confidence: description.toUpperCase().includes('SALARIO') ? 95 : 90,
          balanceAfter: parseBRLNumber(rawBalance)
        });
        pending = null;
      } else {
        // É apenas mais um pedaço de descrição
        // Mas evite incluir cabeçalhos estranhos, páginas etc.
        if (!line.includes('Página') && !line.includes('Internet Banking') && !line.toLowerCase().includes('agência e conta')) {
          pending.descParts.push(line);
        }
      }
    }
  }

  return result.transactions.length > 0 ? result : null;
}

/**
 * Parser especializado para Faturas de Cartão de Crédito do Banco Santander
 */
export function parseSantanderInvoice(text: string): ParsedBankStatementResult | null {
  const isSantanderInvoice = /SANTANDER/i.test(text) && (/fatura do seu cartão/i.test(text) || /Detalhamento da Fatura/i.test(text));
  if (!isSantanderInvoice) return null;

  const result: ParsedBankStatementResult = {
    bankName: 'Banco Santander',
    bankCode: '033',
    transactions: []
  };

  // Extração de Metadados
  const holderMatch = text.match(/([A-Z\s]+?)\s*-\s*\d{4}\s+XXXX\s+XXXX\s+\d{4}/i) || text.match(/([A-Z\s]+?)\s*CPF:/i);
  if (holderMatch) {
    result.holderName = holderMatch[1].trim();
  }

  const cardMatch = text.match(/(\d{4}\s+XXXX\s+XXXX\s+\d{4})/i);
  if (cardMatch) {
    result.accountNumber = cardMatch[1].trim();
  }

  // Se houver período de compras, tenta extrair
  const periodMatch = text.match(/Período das compras\s*\n?\s*AGO\.\s*R\$\s*[\d.,-]+\s*Esta Fatura\s*(\d{2}\/\d{2}\/\d{2,4}\s+a\s+\d{2}\/\d{2}\/\d{2,4})/i) ||
                      text.match(/(\d{2}\/\d{2}\/\d{2,4}\s+a\s+\d{2}\/\d{2}\/\d{2,4})/i);
  if (periodMatch) {
    result.period = periodMatch[1].trim();
  }

  const totalMatch = text.match(/Total a Pagar\s*\n?\s*R\$\s*([\d.,]+)/i) || text.match(/Total desta Fatura\s*R\$\s*([\d.,]+)/i);
  if (totalMatch) {
    result.availableBalance = -parseBRLNumber(totalMatch[1]); // Saldo do cartão/fatura a pagar representado negativamente no balanço geral
  }

  // Tenta encontrar o ano de referência
  let refYear = new Date().getFullYear();
  const yearMatch = text.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    refYear = parseInt(yearMatch[1], 10);
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let txIdx = 0;

  for (const line of lines) {
    // Ignorar linhas totais e de metadados
    if (line.toUpperCase().includes('VALOR TOTAL') || line.toUpperCase().includes('TOTAL DE COMPRAS') || line.toUpperCase().includes('TOTAL DE DÉBITOS')) {
      continue;
    }

    // Procura por linhas que começam com data DD/MM (ex: 15/07 ou 05/08)
    // Opcionalmente precedidas por um prefixo como '3 ', '@ ', etc.
    const lineMatch = line.match(/^(?:[^/]{1,4}\s+)?(\d{2}\/\d{2})\s+(.+)$/);
    if (!lineMatch) continue;

    const rawDate = lineMatch[1]; // ex: '15/07'
    const rest = lineMatch[2].trim();

    // Procura por valor monetário no final da linha (ex: 74,85 ou -8.192,68)
    // Pode ter USD ou não depois, por isso usamos $ no final para garantir que seja BRL ou se houver USD, que termine com valor
    const valueMatch = rest.match(/\s+(-?[\d.]+,\d{2})(?:\s+[\d.,-]+)?$/);
    if (!valueMatch) continue;

    const rawAmount = valueMatch[1];
    const remaining = rest.slice(0, rest.length - valueMatch[0].length).trim();

    // Verifica se possui um indicador de parcelas no final (ex: '09/12')
    const parcelMatch = remaining.match(/\s+(\d{2}\/\d{2})$/);
    let description = remaining;
    if (parcelMatch) {
      const cleanDesc = remaining.slice(0, remaining.length - parcelMatch[0].length).trim();
      description = `${cleanDesc} (Parcela ${parcelMatch[1]})`;
    }

    // Limpar termos adicionais de cancelamento ou marcadores no início da descrição
    description = description.replace(/^[32@]\s+/, '').trim();

    // Ignorar linhas de saldo anterior, saldo total etc.
    const lowerDesc = description.toLowerCase();
    if (
      lowerDesc.includes('saldo anterior') ||
      lowerDesc.includes('saldo total') ||
      lowerDesc.includes('esta fatura') ||
      lowerDesc.includes('resumo da fatura') ||
      lowerDesc.includes('anuidade diferenciada') && rawAmount === '0,00'
    ) {
      continue;
    }

    const parsedVal = parseBRLNumber(rawAmount);
    if (parsedVal === 0) continue; // Pular transações de valor zero (como anuidade zerada)

    const amount = Math.abs(parsedVal);
    // Nas faturas de cartão, valores negativos representam créditos/pagamentos (income)
    // e valores positivos representam compras/despesas (expense)
    const type: 'income' | 'expense' = parsedVal < 0 ? 'income' : 'expense';
    const catSuggestion = suggestCategoryForStatement(description, type);

    // Constrói a data com o ano de referência
    const [day, month] = rawDate.split('/');
    const dateStr = `${refYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    txIdx++;
    result.transactions.push({
      id: `santander_inv_${Date.now()}_${txIdx}`,
      date: dateStr,
      description,
      type,
      amount,
      paymentMethod: type === 'income' ? 'Transferência' : 'Cartão de Crédito',
      suggestedCategory: catSuggestion.category,
      suggestedSubcategory: catSuggestion.subcategory,
      confidence: 92
    });
  }

  return result.transactions.length > 0 ? result : null;
}

/**
 * Parser especializado para Extratos do Banco Itaú (Banco 341)
 */
export function parseItauStatement(text: string): ParsedBankStatementResult | null {
  const isItau = /itau|itaú/i.test(text) && (/extrato/i.test(text) || /lançamentos|lancamentos/i.test(text));
  if (!isItau) return null;

  const result: ParsedBankStatementResult = {
    bankName: 'Banco Itaú',
    bankCode: '341',
    transactions: []
  };

  // Extração de Metadados
  const holderMatch = text.match(/(?:itau|itaú)?\s*([^\n\r]+?)(?=\s+CPF:)/i);
  if (holderMatch) {
    result.holderName = holderMatch[1].replace(/^(?:itau|itaú)\s+/i, '').trim();
  }

  const agCcMatch = text.match(/agência:\s*(\d+)\s+conta:\s*([\d-]+)/i) || text.match(/agencia:\s*(\d+)\s+conta:\s*([\d-]+)/i);
  if (agCcMatch) {
    result.agency = agCcMatch[1].trim();
    result.accountNumber = agCcMatch[2].trim();
  }

  const periodMatch = text.match(/período de visualização:\s*(?:de\s+)?(\d{2}\/\d{2}\/\d{4}\s+(?:até|a)\s+\d{2}\/\d{2}\/\d{4})/i) || 
                      text.match(/periodo de visualizacao:\s*(?:de\s+)?(\d{2}\/\d{2}\/\d{4}\s+(?:ate|a)\s+\d{2}\/\d{2}\/\d{4})/i) ||
                      text.match(/período de visualização:\s*(?:de\s+)?([^\n\r]+)/i) || 
                      text.match(/periodo de visualizacao:\s*(?:de\s+)?([^\n\r]+)/i);
  if (periodMatch) {
    result.period = periodMatch[1].trim();
  }

  const balanceMatch = text.match(/saldo em conta\s*R\$\s*([\d.,-]+)/i) || text.match(/saldo em conta\s*([\d.,-]+)/i);
  if (balanceMatch) {
    result.availableBalance = parseBRLNumber(balanceMatch[1]);
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let txIdx = 0;

  for (const line of lines) {
    // Verificar se a linha começa com data DD/MM/YYYY
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.*)$/);
    if (!dateMatch) continue;

    const rawDate = dateMatch[1];
    const rest = dateMatch[2].trim();

    // Encontrar o valor na extremidade da linha
    // Padrão: pode ser positivo (ex: 336,00) ou negativo (ex: -336,00)
    const valueMatch = rest.match(/\s+(-?[\d.]+,\d{2})$/);
    if (!valueMatch) continue;

    const rawAmount = valueMatch[1];
    const description = rest.slice(0, rest.length - valueMatch[0].length).trim();

    // Ignorar linhas informativas de saldo ou limite que contenham a data
    const lowerDesc = description.toLowerCase();
    if (
      lowerDesc.includes('saldo anterior') || 
      lowerDesc.includes('saldo total') || 
      lowerDesc.includes('saldo disponível') || 
      lowerDesc.includes('saldo disponivel') || 
      lowerDesc.includes('saldo em conta') ||
      lowerDesc.includes('limite da conta') ||
      lowerDesc.includes('total contratado') ||
      lowerDesc.includes('saldo total disponível dia') ||
      lowerDesc.includes('saldo total disponivel dia')
    ) {
      continue;
    }

    const parsedVal = parseBRLNumber(rawAmount);
    const amount = Math.abs(parsedVal);
    const type: 'income' | 'expense' = parsedVal < 0 ? 'expense' : 'income';
    const catSuggestion = suggestCategoryForStatement(description, type);

    txIdx++;
    result.transactions.push({
      id: `itau_pdf_${Date.now()}_${txIdx}`,
      date: normalizeDateString(rawDate),
      description,
      type,
      amount,
      paymentMethod: inferPaymentMethod(description),
      suggestedCategory: catSuggestion.category,
      suggestedSubcategory: catSuggestion.subcategory,
      confidence: description.toUpperCase().includes('SALARIO') ? 95 : 90
    });
  }

  return result.transactions.length > 0 ? result : null;
}

/**
 * Parser principal de extrato bancário em texto extraído
 */
export function parseBankStatementText(text: string): ParsedBankStatementResult {
  // 1. Tentar parser de fatura do Banco Santander
  const santanderInvoiceResult = parseSantanderInvoice(text);
  if (santanderInvoiceResult && santanderInvoiceResult.transactions.length > 0) {
    return santanderInvoiceResult;
  }

  // 1. Tentar parser de fatura do Banco BV
  const bvInvoiceResult = parseBancoBvInvoice(text);
  if (bvInvoiceResult && bvInvoiceResult.transactions.length > 0) {
    return bvInvoiceResult;
  }

  // 2. Tentar parser de extrato do Banco BV
  const bvResult = parseBancoBvStatement(text);
  if (bvResult && bvResult.transactions.length > 0) {
    return bvResult;
  }

  // 3. Tentar parser de extrato do Banco Santander
  const santanderResult = parseSantanderStatement(text);
  if (santanderResult && santanderResult.transactions.length > 0) {
    return santanderResult;
  }

  // Tentar parser de extrato do Banco Itaú
  const itauResult = parseItauStatement(text);
  if (itauResult && itauResult.transactions.length > 0) {
    return itauResult;
  }

  // 4. Tentar parser genérico
  return parseGenericBankStatement(text);
}
