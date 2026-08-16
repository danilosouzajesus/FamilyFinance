import { GoogleGenAI } from '@google/genai';

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