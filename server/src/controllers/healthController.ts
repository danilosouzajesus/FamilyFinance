import type { Request, Response } from 'express';

export function healthHandler(_req: Request, res: Response) {
  res.json({ status: 'ok', message: 'FamilyFinance backend running successfully!' });
}