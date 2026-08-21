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
    if (d.includes('SALARIO') || d.includes('SALÁRIO') || d.includes('PAGAMENTO DE SALARIO') || d.includes('REMUNERA')) {
      return { category: 'Salário & Benefícios', subcategory: 'Salário' };
    }
    if (d.includes('RENDIMENTO') || d.includes('DIVIDENDO') || d.includes('JUROS')) {
      return { category: 'Investimentos', subcategory: 'Rendimentos' };
    }
    if (d.includes('PIX') || d.includes('TRANSF') || d.includes('TED') || d.includes('DOC')) {
      return { category: 'Outras Receitas', subcategory: 'Transferências Recebidas' };
    }
    return { category: 'Outras Receitas' };
  }

  // Expense
  if (d.includes('PIX') || d.includes('TRANSF') || d.includes('TED') || d.includes('DOC')) {
    return { category: 'Outras Despesas', subcategory: 'Transferências Enviadas' };
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
 * Parser principal de extrato bancário em texto extraído
 */
export function parseBankStatementText(text: string): ParsedBankStatementResult {
  // 1. Tentar parser especializado do Banco BV
  const bvResult = parseBancoBvStatement(text);
  if (bvResult && bvResult.transactions.length > 0) {
    return bvResult;
  }

  // 2. Tentar parser genérico
  return parseGenericBankStatement(text);
}
