# FamilyFinance

Sistema financeiro pessoal e familiar com controle de despesas, receitas, orçamentos, metas, integração bancária (Pluggy) e conselheiro financeiro com IA (Gemini).

## Estrutura (npm workspaces monorepo)

```
├── client/                # Frontend React + Vite + Tailwind
│   ├── src/
│   │   ├── app/           # App.tsx (composição raiz), main.tsx
│   │   ├── components/    # Componentes compartilhados (Sidebar, UserMenu, PeriodSelector...)
│   │   ├── features/      # Features por domínio (dashboard, transactions, budgets, goals...)
│   │   ├── lib/           # Supabase client, estado inicial (localStorage)
│   │   └── test/          # setup vitest + re-export de fixtures
│   └── vite.config.ts     # Aliases: @/* → src, @ff/shared → ../shared/src
├── server/                # Backend Express
│   ├── src/
│   │   ├── app.ts         # createExpressApp() — todas as rotas /api
│   │   ├── config/        # env (dotenv)
│   │   ├── controllers/   # ai, health, pluggy
│   │   ├── middleware/    # errorHandler
│   │   ├── repositories/  # pluggyStore (Supabase + fallback JSON local)
│   │   ├── routes/        # ai.ts, health.ts, pluggy.ts
│   │   └── services/      # geminiService, pluggyService (único lugar com @google/genai e pluggy-sdk)
│   └── server.ts          # Entry dev/prod local (Vite middleware + listen)
├── shared/                # @ff/shared — código compartilhado client+server
│   ├── src/
│   │   ├── domain/        # transaction, invoice, category, entities, period, financial-state
│   │   ├── engines/       # invoiceEngine, ruleEngine, pluggyEngine (regras puras)
│   │   ├── integration/   # pluggy.ts (normalização/samples) e pluggy-types.ts
│   │   ├── test/          # fixtures de teste
│   │   └── utils/         # format (dinheiro, meses)
│   └── index.ts           # Barrel público do pacote
├── api/index.ts           # Entry serverless do Vercel (exporta createExpressApp)
├── dist/                  # server.cjs (build do servidor)
└── vercel.json            # Deploy Vercel
```

**Regras de fronteira:**
- `@ff/shared` é o único pacote importado tanto por `client/` quanto por `server/`. Tudo que for compartilhado deve ser exportado pelo barrel `shared/src/index.ts`.
- SDKs externos de integração ficam isolados no server: `@google/genai` só existe em `server/src/services/geminiService.ts` e `pluggy-sdk` só em `server/src/services/pluggyService.ts`.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Sobe o servidor Express + Vite middleware em `http://0.0.0.0:3000` |
| `npm run build` | Build do client (Vite) + server (esbuild → `dist/server.cjs`) |
| `npm run start` | Roda o build do server |
| `npm test` | Rodas todos os testes (client + shared) via Vitest |
| `npm run lint` | Typecheck `tsc --noEmit` |

## Rotas da API

Base: `/api`

### Health
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/health` | Status do backend |

### AI Advisor
| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/ai/advisor` | Consulta o conselheiro IA (Gemini). Body: `{ systemState, chatHistory?, userMessage? }`. Sem chave, usa fallback offline. |

### Pluggy (integração bancária)
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/pluggy/config` | Chaves Pluggy configuradas? + URL do webhook |
| GET | `/pluggy/connect-token` | Token para abrir o widget de conexão |
| POST | `/pluggy/webhook` | Recebe eventos `transactions/created` / `transactions/updated` |
| POST | `/pluggy/sync` | Sincronização manual (pull). Query: `userId`, `wait`, `accountId`, `from` |
| GET | `/pluggy/pending` | Caixa de entrada (pendências) |
| GET | `/pluggy/investments` | Investimentos das conexões |
| POST | `/pluggy/pending/:id/approve` | Aprova pendência (body: `overrides`) |
| POST | `/pluggy/pending/:id/reconcile` | Concilia pendência (body: `targetTransactionId`) |
| POST | `/pluggy/pending/:id/ignore` | Ignora pendência |
| GET | `/pluggy/connections` | Lista conexões bancárias |
| POST | `/pluggy/connections` | Cria conexão (body: `userId`, `itemId`, `connectorName`) |
| DELETE | `/pluggy/connections/:itemId` | Remove conexão |
| GET | `/pluggy/accounts` | Contas/cartões detectados + mapeamento |
| POST | `/pluggy/accounts/map` | Mapeia conta Pluggy → conta do app |
| POST | `/pluggy/demo/generate` | Gera pendências de exemplo |
| GET | `/pluggy/status` | Diagnóstico interno |

## Variáveis de ambiente

`.env` (na raiz, veja `.env.example`):

- `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` — credenciais Pluggy
- `PLUGGY_WEBHOOK_URL` — URL do webhook (opcional)
- `GEMINI_API_KEY` — chave da API Gemini (para o advisor)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — opcionais; sem eles o repositório usa JSON local (`data/`)

## Deploy (Vercel)

`api/index.ts` exporta o app Express serverless; o front buildado em `client/dist` é servido como estático (ver `vercel.json`).