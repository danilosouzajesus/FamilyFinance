import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Helper to safely initialize GoogleGenAI client only when requested
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please configure it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "FamilyFinance backend running successfully!" });
  });

  // AI Advisor / Advisor Chat Endpoint
  app.post("/api/ai/advisor", async (req, res) => {
    try {
      const { systemState, chatHistory, userMessage } = req.body;

      if (!systemState) {
        return res.status(400).json({ error: "Missing system financial state" });
      }

      let client: GoogleGenAI;
      try {
        client = getGeminiClient();
      } catch (err: any) {
        console.warn("Gemini client initialization failed (API Key missing). Using fallback offline advisor response.");
        // Returns a helpful offline advisory guidance instructing how to configure the API key while giving a basic local summary analysis
        const offlineResponse = generateOfflineAdvisory(systemState, userMessage);
        return res.json({
          text: offlineResponse,
          isOfflineFallback: true
        });
      }

      // Format financial data into a clean text block for the AI to analyze
      const { transactions, accounts, budgets, goals, familyMembers } = systemState;

      // Summarize financial data
      const totalIncome = transactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

      const totalExpense = transactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

      const netBalance = totalIncome - totalExpense;

      const categoryTotals = transactions
        .filter((t: any) => t.type === 'expense')
        .reduce((acc: any, t: any) => {
          acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
          return acc;
        }, {});

      const activeBudgets = budgets.map((b: any) => {
        const spent = transactions
          .filter((t: any) => t.type === 'expense' && t.category === b.categoryId) // categoryId references category name or id in simplifications
          .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        return { category: b.categoryId, limit: b.limit, spent };
      });

      const activeGoals = goals.map((g: any) => ({
        name: g.name,
        target: g.targetAmount,
        current: g.currentAmount,
        deadline: g.deadline,
        pct: Math.round((g.currentAmount / g.targetAmount) * 100)
      }));

      const activeAccounts = accounts.map((a: any) => ({
        name: a.name,
        type: a.type,
        balance: a.balance
      }));

      const activeMembers = familyMembers.map((m: any) => ({
        name: m.name,
        role: m.role
      }));

      // Construction of context prompt
      const contextPrompt = `
Você é o "Serenity AI", um consultor financeiro pessoal e familiar altamente sofisticado, empático e inteligente. Seu objetivo é ajudar a família a organizar suas finanças, economizar dinheiro, bater metas e gastar de forma consciente.

Aqui está o estado financeiro atual da família:
- Membros da Família: ${JSON.stringify(activeMembers)}
- Contas e Saldos: ${JSON.stringify(activeAccounts)}
- Receitas Totais no Período: R$ ${totalIncome.toFixed(2)}
- Despesas Totais no Período: R$ ${totalExpense.toFixed(2)}
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
        model: "gemini-3.6-flash",
        contents: contextPrompt,
        config: {
          systemInstruction: "Você é o Serenity AI, um conselheiro financeiro especializado em planejamento pessoal e familiar brasileiro. Ajude as famílias a alcançarem a liberdade financeira de forma construtiva e realista.",
          temperature: 0.7,
        },
      });

      res.json({
        text: response.text || "Desculpe, não consegui processar os conselhos no momento.",
        isOfflineFallback: false
      });

    } catch (error: any) {
      console.error("AI Advisor error:", error);
      res.status(500).json({ error: error.message || "Erro interno ao consultar o conselheiro IA." });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FamilyFinance] Server listening on http://0.0.0.0:${PORT}`);
  });
}

// Generates an offline fallback response based on basic local mathematical evaluation of state
function generateOfflineAdvisory(state: any, userQuery: string): string {
  const { transactions, budgets, goals } = state;

  const totalIncome = transactions
    .filter((t: any) => t.type === 'income')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t: any) => t.type === 'expense')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const net = totalIncome - totalExpense;
  const pctSavings = totalIncome > 0 ? ((net / totalIncome) * 100).toFixed(1) : "0";

  // Encontra orçamentos estourados
  const overBudgets = budgets.map((b: any) => {
    const spent = transactions
      .filter((t: any) => t.type === 'expense' && (t.category === b.categoryId || t.category.toLowerCase() === b.categoryId.toLowerCase()))
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
    return { name: b.categoryId, limit: b.limit, spent };
  }).filter((b: any) => b.spent > b.limit);

  let advice = `### 🤖 Serenity AI — Modo Consultoria Local

*Nota: Para habilitar a análise inteligente avançada e profunda baseada em IA generativa, por favor, configure uma chave **GEMINI_API_KEY** no painel lateral de Configurações (Secrets) do seu AI Studio.*

Com base nos dados matemáticos do seu aplicativo, aqui está o seu **relatório financeiro de saúde familiar**:

#### 📊 Resumo da Balança
* **Receitas Totais:** R$ ${totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Despesas Totais:** R$ ${totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
* **Saldo Líquido:** R$ ${net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${net >= 0 ? "Saldo Positivo! 🎉" : "Atenção: Saldo Negativo! ⚠️"})
* **Taxa de Poupança:** ${net > 0 ? `${pctSavings}% das suas receitas foram poupadas.` : "Você está gastando mais do que ganha!"}

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

startServer();
