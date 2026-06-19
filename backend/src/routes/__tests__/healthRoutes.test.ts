import express from 'express';
import request from 'supertest';
import healthRouter from '../healthRoutes';
import { prisma } from '../../infrastructure/prismaClient';

jest.mock('../../infrastructure/prismaClient', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

const app = express();
app.use('/health', healthRouter);

const mockQueryRaw = prisma.$queryRaw as jest.MockedFunction<typeof prisma.$queryRaw>;

describe('healthRoutes - GET /health', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('should return 200 with {status: ok, db: up} when DB is reachable', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('should return 503 with {status: error, db: down} when DB is unreachable', async () => {
    mockQueryRaw.mockRejectedValue(new Error('Connection refused'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error', db: 'down' });
  });

  it('should return response body with only status and db fields', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const res = await request(app).get('/health');

    const keys = Object.keys(res.body);
    expect(keys).toHaveLength(2);
    expect(keys).toContain('status');
    expect(keys).toContain('db');
  });
});
