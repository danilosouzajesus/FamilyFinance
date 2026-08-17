import express from 'express';
import path from 'path';
import { existsSync } from 'fs';
import { createServer as createViteServer } from 'vite';
import { createExpressApp } from './src/app';
import dotenv from 'dotenv';

// Localiza a raiz do monorepo subindo a partir do cwd até achar a estrutura
// (client/, server/, .env). Funciona tanto em dev (cwd = server/) quanto em
// produção (node dist/server.cjs) e em ambos os formatos de módulo (ESM/CJS).
function findRootDir(start: string): string {
  let dir = start;
  for (;;) {
    if (
      existsSync(path.join(dir, 'client')) &&
      existsSync(path.join(dir, 'server')) &&
      existsSync(path.join(dir, 'package.json'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

const rootDir = findRootDir(process.cwd());

// Carrega o .env da raiz do monorepo (npm run -w muda o cwd para server/).
dotenv.config({ path: path.join(rootDir, '.env') });

async function startServer() {
  const app = createExpressApp();
  const PORT = 3000;

  // Vite integration (dev) ou estático (produção) — só no entry local.
  // No Vercel quem serve o front é a plataforma e a API vem de api/index.ts.
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      root: path.resolve(rootDir, 'client'),
      configFile: path.resolve(rootDir, 'client/vite.config.ts'),
      envDir: rootDir,
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/data/**',
            '**/data/**/*',
            '**/*.tmp',
            '**/coverage/**',
            '**/dist/**',
          ],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = existsSync(path.join(rootDir, 'dist', 'index.html'))
      ? path.join(rootDir, 'dist')
      : path.join(rootDir, 'client', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FamilyFinance] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();