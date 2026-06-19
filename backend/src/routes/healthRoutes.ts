// Health routes are mounted at /health in src/index.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../infrastructure/prismaClient';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});

export default router;
