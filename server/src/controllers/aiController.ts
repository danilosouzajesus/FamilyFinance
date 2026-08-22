import type { Request, Response } from 'express';
import { getGeminiClient, generateOfflineAdvisory, parseStatementWithGemini } from '../services/geminiService';

// AI Advisor / Advisor Chat Endpoint
export async function advisorHandler(req: Request, res: Response) {
  try {
    const { systemState, chatHistory, userMessage } = req.body;

    if (!systemState) {
      return res.status(400).json({ error: 'Missing system financial state' });
    }

    let client;
    try {
      client = getGeminiClient();
    } catch {
      console.warn('Gemini client initialization failed (API Key missing). Using fallback offline advisor response.');
      const offlineResponse = generateOfflineAdvisory(systemState, userMessage);
      return res.json({
        text: offlineResponse,
        isOfflineFallback: true,
      });
    }

    const { transactions, accounts, budgets, goals, familyMembers, categories } = systemState;

    const categoryNameById = (categories || []).reduce((acc: any, c: any) => {
      acc[c.id] = c.name;
      return acc;
    }, {});

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

    const netBalance = totalIncome - totalExpense;

    const categoryTotals = curTxs
      .filter((t: any) => t.type === 'expense')
      .reduce((acc: any, t: any) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {});

    const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevExpense = transactions
      .filter((t: any) => t.type === 'expense' && monthOf(t.date) === prevMonth)
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    const activeBudgets = budgets.map((b: any) => {
      const catName = categoryNameById[b.categoryId] || b.categoryId || b.category;
      const spent = curTxs
        .filter((t: any) => t.type === 'expense' && (t.category === catName || t.categoryId === b.categoryId))
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      return { category: catName, limit: b.limit, spent, month: b.month || currentMonth };
    });

    const activeGoals = goals.map((g: any) => ({
      name: g.name,
      target: g.targetAmount,
      current: g.currentAmount,
      deadline: g.deadline,
      pct: Math.round((g.currentAmount / g.targetAmount) * 100),
    }));

    const activeAccounts = accounts.map((a: any) => ({
      name: a.name,
      type: a.type,
      balance: a.balance,
    }));

    const activeMembers = familyMembers.map((m: any) => ({
      name: m.name,
      role: m.role,
    }));

    const contextPrompt = `
Você é o "Serenity AI", um consultor financeiro pessoal e familiar altamente sofisticado, empático e inteligente. Seu objetivo é ajudar a família a organizar suas finanças, economizar dinheiro, bater metas e gastar de forma consciente.

Aqui está o estado financeiro atual da família:
- Mês de Referência: ${currentMonth} (dados do mês vigente; mês anterior: ${prevMonth})
- Membros da Família: ${JSON.stringify(activeMembers)}
- Contas e Saldos: ${JSON.stringify(activeAccounts)}
- Receitas Totais no Período: R$ ${totalIncome.toFixed(2)}
- Despesas Totais no Período: R$ ${totalExpense.toFixed(2)}
- Despesas no Mês Anterior: R$ ${prevExpense.toFixed(2)} (use para comparação e tendências)
- Saldo Líquido: R$ ${netBalance.toFixed(2)} (Se negativo, recomende urgentemente cortes de gastos. Se positivo, sugira investimentos ou aportes para as metas).
- Gastos por Categoria: ${JSON.stringify(categoryTotals)}
- Orçamentos de Categorias (Teto de Gastos): ${JSON.stringify(activeBudgets)}
- Metas Financeiras Ativas: ${JSON.stringify(activeGoals)}

Histórico de Conversa Recente:
${(chatHistory || []).map((msg: any) => `${msg.role === 'user' ? 'Usuário' : 'Conselheiro'}: ${msg.content}`).join('\n')}

Nova mensagem do usuário: "${userMessage || 'Por favor, faça uma análise geral da minha saúde financeira e me dê 3 conselhos práticos em tópicos.'}"

Diretrizes de resposta:
1. Responda em português brasileiro fluído, profissional, acolhedor e direto.
2. Use formatação Markdown elegante (títulos, listas em tópicos, negrito).
3. Nunca invente informações. Analise estritamente o estado provido.
4. Identifique se algum orçamento foi estourado ou se as despesas excedem as receitas.
5. Se o usuário fizer uma pergunta geral, faça uma análise e sugira ações. Se ele fizer uma pergunta específica (ex: "Consigo comprar um carro?", "Quanto o Pedro gastou?"), responda diretamente cruzando os dados do estado financeiro.
6. Mantenha os conselhos práticos e perfeitamente aplicáveis para a realidade familiar demonstrada.
`;

    const response = await client.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: contextPrompt,
      config: {
        systemInstruction: 'Você é o Serenity AI, um conselheiro financeiro especializado em planejamento pessoal e familiar brasileiro. Ajude as famílias a alcançarem a liberdade financeira de forma construtiva e realista.',
        temperature: 0.7,
      },
    });

    res.json({
      text: response.text || 'Desculpe, não consegui processar os conselhos no momento.',
      isOfflineFallback: false,
    });
  } catch (error: any) {
    console.error('AI Advisor error:', error);
    res.status(500).json({ error: error.message || 'Erro interno ao consultar o conselheiro IA.' });
  }
}

// Handler para processamento inteligente de extratos via IA
export async function parseStatementHandler(req: Request, res: Response) {
  try {
    const { fileBase64, fileType, fileName } = req.body;

    if (!fileBase64) {
      return res.status(400).json({ error: 'Nenhum conteúdo de arquivo fornecido (base64 esperado)' });
    }

    try {
      getGeminiClient();
    } catch (err: any) {
      return res.status(503).json({ 
        error: 'Chave de API do Gemini não configurada. Configure a variável GEMINI_API_KEY em Configurações > Secrets.' 
      });
    }

    const result = await parseStatementWithGemini(fileBase64, fileType || 'application/pdf');
    res.json(result);
  } catch (error: any) {
    console.error('AI statement parsing error:', error);
    res.status(500).json({ error: error.message || 'Erro ao processar o extrato com Inteligência Artificial.' });
  }
}