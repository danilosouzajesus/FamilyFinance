import express from 'express';
import { errorHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health';
import aiRoutes from './routes/ai';
import pluggyRoutes from './routes/pluggy';

// Monta o app Express com todas as rotas de API.
// O entry local (server/server.ts) adiciona o middleware do Vite/estático e o listen;
// a função serverless do Vercel (api/index.ts) exporta o resultado diretamente.
export function createExpressApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/health', healthRoutes);
  app.use('/health', healthRoutes);

  app.use('/api/ai', aiRoutes);
  app.use('/ai', aiRoutes);

  app.use('/api/pluggy', pluggyRoutes);
  app.use('/pluggy', pluggyRoutes);

  app.use(errorHandler);

  return app;
}