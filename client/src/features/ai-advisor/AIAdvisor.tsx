import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  HelpCircle, 
  Loader2, 
  TrendingUp, 
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { FinancialState } from '@ff/shared';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

interface AIAdvisorProps {
  financialState: FinancialState;
}

export default function AIAdvisor({ financialState }: AIAdvisorProps) {
  // Chat History state - initialized with a welcoming advisor message
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: `Olá! Eu sou o **Serenity AI**, o consultor de finanças inteligentes da sua família. 🌟
      
Estudei detalhadamente o seu saldo atual, suas contas de depósito, seus orçamentos definidos e o progresso das suas metas.

Como posso ajudar vocês hoje? Você pode digitar uma pergunta no campo abaixo ou clicar em uma das **sugestões de consulta** prontas para iniciarmos a análise de saúde financeira!`
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTip, setLoadingTip] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reassuring loading messages to swap during API waiting
  const loadingTips = [
    "Consultando saldos e conferindo fluxo de caixa...",
    "Revisando limites orçamentários das categorias...",
    "Analisando metas familiares e projetando prazos...",
    "Gerando conselhos financeiros personalizados para a família..."
  ];

  // Rotate loading tips when waiting
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingTip(loadingTips[0]);
      let idx = 1;
      interval = setInterval(() => {
        setLoadingTip(loadingTips[idx % loadingTips.length]);
        idx++;
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  // Auto scroll to chat bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Send message to Express API
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsgId = Date.now().toString();
    const newUserMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: textToSend
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Format history correctly for the backend endpoint
      const formattedHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemState: financialState,
          chatHistory: formattedHistory,
          userMessage: textToSend
        })
      });

      if (!response.ok) {
        throw new Error('Falha de resposta do servidor de IA.');
      }

      const data = await response.json();
      
      const aiMsgId = (Date.now() + 1).toString();
      const newAiMessage: Message = {
        id: aiMsgId,
        role: 'model',
        content: data.text || 'Desculpe, tive dificuldades para formular uma resposta.'
      };

      setMessages(prev => [...prev, newAiMessage]);

    } catch (error: any) {
      console.error('Advisor error:', error);
      const errorMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: errorMsgId,
        role: 'model',
        content: `⚠️ **Erro de Conexão**: Não foi possível contatar o serviço de IA no momento. 
        
Isso pode acontecer por instabilidades de rede. Por favor, tente novamente em alguns segundos.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Pre-configured templates click handlers
  const handleQuickPromptClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const quickPrompts = [
    { text: "Fazer análise geral da saúde financeira", icon: TrendingUp },
    { text: "Verificar orçamentos e sugerir cortes", icon: AlertTriangle },
    { text: "Como acelerar o alcance das metas de poupança?", icon: Lightbulb }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-h-[800px] bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden w-full max-w-full" id="ai-advisor-component">
      {/* Top Advisor Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/20 to-violet-50/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="text-sm font-display font-extrabold text-slate-900 flex items-center gap-1.5">
              Serenity AI Advisor
              <span className="inline-flex px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[8px] font-extrabold uppercase tracking-widest">Ativo</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Consultor de Finanças Inteligente da Família</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">Chave de Conexão</span>
          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 justify-end">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Servidor Seguro
          </span>
        </div>
      </div>

      {/* Messages Thread Canvas */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30" id="chat-messages-thread">
        {messages.map((m) => {
          const isAI = m.role === 'model';
          return (
            <div 
              key={m.id}
              className={`flex items-start gap-3.5 max-w-[85%] ${isAI ? 'mr-auto text-left' : 'ml-auto flex-row-reverse text-right'}`}
            >
              {/* Profile Icon */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow ${
                isAI ? 'bg-gradient-to-tr from-indigo-600 to-violet-600' : 'bg-slate-700'
              }`}>
                {isAI ? <Bot size={16} /> : <User size={16} />}
              </div>

              {/* Text Bubble Content */}
              <div className={`p-4 rounded-2xl text-xs space-y-1 ${
                isAI 
                  ? 'bg-white border border-slate-150 text-slate-700 shadow-sm' 
                  : 'bg-indigo-600 text-white font-medium'
              }`}>
                {isAI ? (
                  <div className="markdown-body leading-relaxed max-w-full overflow-x-auto space-y-2">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading placeholder block */}
        {isLoading && (
          <div className="flex items-start gap-3.5 max-w-[80%] mr-auto text-left">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow animate-pulse">
              <Bot size={16} />
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-100 text-slate-500 shadow-sm flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-indigo-600" />
              <span className="text-xs font-semibold animate-pulse">{loadingTip}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions triggers bar */}
      {messages.length === 1 && !isLoading && (
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/10 flex flex-wrap gap-2 items-center justify-start">
          <HelpCircle size={14} className="text-slate-400 shrink-0" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Sugestões rápidas:</span>
          {quickPrompts.map((qp, i) => {
            const Icon = qp.icon;
            return (
              <button
                key={i}
                onClick={() => handleQuickPromptClick(qp.text)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-indigo-50 border border-slate-200/80 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <Icon size={12} className="text-indigo-500 shrink-0" /> {qp.text}
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom Message Input Panel */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputValue);
          }}
          className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 focus-within:border-indigo-500 transition-colors"
        >
          <input
            type="text"
            disabled={isLoading}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Digite sua dúvida financeira (ex: Estamos gastando muito com supermercado?)..."
            className="flex-1 bg-transparent text-xs text-slate-700 placeholder-slate-400 focus:outline-none disabled:opacity-50"
            id="chat-message-input-field"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors cursor-pointer shrink-0"
            id="send-chat-msg-btn"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
