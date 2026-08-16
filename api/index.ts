// Entry serverless do Vercel: exporta o app Express com todas as rotas de API.
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createExpressApp } from '../server/src/app';

// Em dev local (tsx api/index.ts) carrega o .env da raiz do monorepo.
// Em produção o Vercel injeta as variáveis de ambiente diretamente.
dotenv.config({
  path: path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), '.env'),
});

const app = createExpressApp();

export default app;