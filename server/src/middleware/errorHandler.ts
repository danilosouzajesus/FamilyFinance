import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('[FamilyFinance] Unhandled error:', err);
  res.status(500).json({ error: err?.message || 'Erro interno do servidor.' });
}