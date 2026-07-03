import request from 'supertest';
import { app } from '../../../index';

describe('admin review routes — auth gating', () => {
  it('GET / without token returns 401', async () => {
    const res = await request(app).get('/api/admin/reviews');
    expect(res.status).toBe(401);
  });

  it('PATCH /:id/status without token returns 401', async () => {
    const res = await request(app).patch('/api/admin/reviews/1/status').send({ status: 'Approved' });
    expect(res.status).toBe(401);
  });

  it('DELETE /:id without token returns 401', async () => {
    const res = await request(app).delete('/api/admin/reviews/1');
    expect(res.status).toBe(401);
  });
});
