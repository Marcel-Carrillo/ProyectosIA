import request from 'supertest';
import express from 'express';
import healthRoutes from './healthRoutes';
import { prisma } from '../infrastructure/prismaClient';

jest.mock('../infrastructure/prismaClient', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

const app = express();
app.use('/health', healthRoutes);

const mockQueryRaw = prisma.$queryRaw as jest.MockedFunction<typeof prisma.$queryRaw>;

describe('GET /health', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('returns 200 with { status: "ok", db: "up" } when DB is reachable', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });
});
