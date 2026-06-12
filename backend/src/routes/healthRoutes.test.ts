import request from 'supertest';
import express from 'express';
import healthRoutes from './healthRoutes';

const app = express();
app.use('/health', healthRoutes);

describe('GET /health', () => {
  it('returns 200 with { status: "ok" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
