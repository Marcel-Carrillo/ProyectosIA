import request from 'supertest';
import { app } from '../../../index';
import { withAdminAuth } from '../../../test-utils/adminAuthHelper';

jest.setTimeout(30000);

describe('adminAuthRoutes', () => {
  it('rejects unauthenticated access to customers API', async () => {
    const res = await request(app).get('/api/admin/customers');
    expect(res.status).toBe(401);
  });

  it('login → me → logout flow', async () => {
    const loginRes = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'AdminPass1' });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.data.accessToken as string;
    const cookies = loginRes.headers['set-cookie'];

    const me = await request(app).get('/api/admin/auth/me').set(withAdminAuth(token));
    expect(me.status).toBe(200);
    expect(me.body.data.admin.email).toBe('admin@example.com');

    const logoutReq = request(app).post('/api/admin/auth/logout');
    if (cookies) logoutReq.set('Cookie', cookies);
    const logout = await logoutReq;
    expect(logout.status).toBe(200);

    const blocked = await request(app).get('/api/admin/customers');
    expect(blocked.status).toBe(401);
  });
});
