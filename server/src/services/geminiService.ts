import { GoogleGenAI, Type } from '@google/genai';

// Único ponto que importa @google/genai no projeto. Isola a inicialização
// do client para que nenhuma outra camada dependa da SDK diretamente.
let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is missing. Please configure it in Settings > Secrets.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * Analisa e extrai dados de extratos bancários (incluindo PDFs digitalizados ou imagens) via Gemini.
 */
export async function parseStatementWithGemini(fileBase64: string, fileType: string): Promise<any> {
  const ai = getGeminiClient();

  const prompt = `Você é um leitor de extratos bancários e faturas de cartão de crédito de alta precisão especializado em bancos brasileiros (Itaú, Banco BV, Santander, Nubank, Banco do Brasil, Bradesco, Caixa, etc.).
Analise este arquivo (pode ser um extrato de conta corrente, fatura de cartão de crédito nativa ou digitalizada, ou imagem) e extraia de forma estruturada:
1. Metadados do extrato ou cartão de crédito:
   - Nome do Banco (ex: "Banco Santander", "Banco Itaú", "Banco BV")
   - Código do Banco (ex: "033" para Santander, "341" para Itaú, "413" para BV)
   - Agência (se houver, ex: "0350")
   - Conta Corrente ou número final do Cartão de Crédito (ex: "21911-9", "4258 XXXX XXXX 8773")
   - Nome do titular da conta ou do cartão (ex: "DANILO DE SOUZA JESUS")
   - Período do extrato ou período de compras da fatura (ex: "17/07/2026 a 17/08/2026")
   - Saldo disponível ou valor total da fatura (no caso de faturas a pagar, represente como saldo disponível negativo)
2. Todas as transações financeiras reais de despesa (compras) ou receita (créditos/pagamentos de fatura/estornos).
   - Ignore linhas informativas de totais ou resumos, como "SALDO ANTERIOR", "SALDO TOTAL", "LIMITE CONTRATADO", "PAGAMENTO MÍNIMO", "VALOR TOTAL".
   - Extraia a data no formato ISO "YYYY-MM-DD" (se o ano não estiver evidente, assuma o ano vigente 2026).
   - Extraia a descrição literal e precisa da transação. Se for uma compra parcelada, tente incluir a informação da parcela na descrição (ex: "BAHIA MOVEIS (Parcela 02/05)").
   - Identifique o tipo de transação:
     * Para extratos normais: "income" para créditos/receitas e "expense" para débitos/despesas/tarifas.
     * Para faturas de cartão de crédito: "expense" para compras/juros/tarifas (valores positivos na fatura) e "income" para pagamentos de fatura, cashback ou estornos (valores negativos na fatura).
   - O valor (amount) deve ser sempre um número decimal positivo que representa o valor absoluto da transação.

Retorne estritamente o JSON estruturado conforme o schema solicitado.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.7-flash',
    contents: [
      {
        inlineData: {
          mimeType: fileType,
          data: fileBase64,
        },
      },
      prompt,
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bankName: { type: Type.STRING },
          bankCode: { type: Type.STRING },
          agency: { type: Type.STRING },
          accountNumber: { type: Type.STRING },
          holderName: { type: Type.STRING },
          period: { type: Type.STRING },
          availableBalance: { type: Type.NUMBER },
          transactions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING, description: 'Format: YYYY-MM-DD' },
                description: { type: Type.STRING },
                type: { type: Type.STRING, description: '"income" or "expense"' },
                amount: { type: Type.NUMBER, description: 'Absolute positive value of transaction' },
                paymentMethod: { type: Type.STRING, description: 'e.g., PIX, Boleto, Cartão, Transferência, etc.' },
                balanceAfter: { type: Type.NUMBER, description: 'Opcional. Saldo da conta após a transação se disponível.' }
              },
              required: ['date', 'description', 'type', 'amount']
            }
          }
        },
        required: ['transactions']
      }
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error('Nenhuma resposta gerada pela IA.');
  }

  return JSON.parse(text);
}

// Fallback offline: relatório financeiro local, sem chamada à IA.
export function generateOfflineAdvisory(state: any, userQuery: string): string {
  const { transactions, budgets, goals, categories } = state;

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const monthOf = (dateStr: string) => (dateStr || '').slice(0, 7);
  const curTxs = transactions.filter((t: any) => monthOf(t.date) === currentMonth);

  const totalIncome = curTxs
    .filter((t: any) => t.type === 'income')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const totalExpense = curTxs
    .filter((t: any) => t.type === 'expense')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const net = totalIncome - totalExpense;
  const pctSavings = totalIncome > 0 ? ((net / totalIncome) * 100).toFixed(1) : '0';

  const categoryNameById = (categories || []).reduce((acc: any, c: any) => {
    acc[c.id] = c.name;
    return acc;
  }, {});

  const overBudgets = budgets.map((b: any) => {
    const catName = categoryNameById[b.categoryId] || b.categoryId || b.category;
    const spent = curTxs
      .filter((t: any) => t.type === 'expense' && (t.category === catName || t.categoryId === b.categoryId))
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
    return { name: catName, limit: b.limit, spent };
  }).filter((b: any) => b.spent > b.limit);

  let advice = `### 🤖 Serenity AI — Modo Consultoria Local

*Nota: Para habilitar a análise inteligente avançada e profunda baseada em IA generativa, por favor, configure uma chave **GEMINI_API_KEY** no painel lateral de Configurações (Secrets) do seu AI Studio.*

Com base nos dados matemáticos do seu aplicativo, aqui está o seu **relatório financeiro de saúde familiar**:

#### 📊 Resumo da Balança (${currentMonth})
* **Receitas Totais:** R$ ${totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Despesas Totais:** R$ ${totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Saldo Líquido:** R$ ${net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${net >= 0 ? 'Saldo Positivo! 🎉' : 'Atenção: Saldo Negativo! ⚠️'})
* **Taxa de Poupança:** ${net > 0 ? `${pctSavings}% das suas receitas foram poupadas.` : 'Você está gastando mais do que ganha!'}

`;

  if (overBudgets.length > 0) {
    advice += `#### 🚨 Alerta de Orçamentos Estourados
Você tem **${overBudgets.length}** categorias onde ultrapassou o teto planejado:
${overBudgets.map((ob: any) => `* **${ob.name}**: Limite de R$ ${ob.limit} | Gasto R$ ${ob.spent.toFixed(2)} (*Estouro de R$ ${(ob.spent - ob.limit).toFixed(2)}*)`).join('\n')}
*Sugestão:* Congele compras não-essenciais nestas categorias pelos próximos 10 dias.

`;
  } else {
    advice += `#### ✅ Orçamentos sob Controle
Parabéns! Todas as suas categorias de despesas monitoradas estão dentro dos limites orçamentários estabelecidos para este mês. Continue assim!

`;
  }

  if (goals.length > 0) {
    advice += `#### 🎯 Progresso de Metas de Poupança
Suas metas ativas estão progredindo:
${goals.map((g: any) => {
      const pct = Math.round((g.currentAmount / g.targetAmount) * 100);
      return `* **${g.name}**: ${pct}% concluída (R$ ${g.currentAmount} de R$ ${g.targetAmount})`;
    }).join('\n')}

`;
  }

  advice += `#### 💡 Conselhos Práticos Locais
1. **Foco no Saldo Líquido:** Priorize guardar pelo menos 15% das receitas logo no início do mês (regra "Pague-se Primeiro").
2. **Revisão Semanal:** Reúna a família por 15 minutos no fim de semana para alinhar as despesas registradas e evitar surpresas na fatura.
3. **Controle o Cartão:** O limite do cartão de crédito não é extensão do salário. Monitore os parcelamentos ativos!

*Se tiver alguma dúvida específica sobre despesas, digite sua pergunta acima. Tentarei responder com meus algoritmos locais!*`;

  return advice;
}