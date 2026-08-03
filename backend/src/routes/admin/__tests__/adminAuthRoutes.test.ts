import request from 'supertest';
import { app } from '../../../index';
import { getAdminAccessToken, withAdminAuth } from '../../../test-utils/adminAuthHelper';
import { getLastAdminOtpForTests } from '../../../infrastructure/email/adminOtpTestCapture';

jest.setTimeout(30000);

describe('adminAuthRoutes', () => {
  it('rejects unauthenticated access to customers API', async () => {
    const res = await request(app).get('/api/admin/customers');
    expect(res.status).toBe(401);
  });

  it('login → verify-2fa → me → logout flow', async () => {
    const loginRes = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'AdminPass1' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.mfaRequired).toBe(true);
    expect(loginRes.body.data.mfaToken).toBeTruthy();
    expect(loginRes.body.data.accessToken).toBeUndefined();

    const code = getLastAdminOtpForTests();
    expect(code).toMatch(/^\d{6}$/);

    const verifyRes = await request(app)
      .post('/api/admin/auth/verify-2fa')
      .send({ mfaToken: loginRes.body.data.mfaToken, code });
    expect(verifyRes.status).toBe(200);
    const token = verifyRes.body.data.accessToken as string;
    const cookies = verifyRes.headers['set-cookie'];

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

  it('rejects an invalid OTP code', async () => {
    const loginRes = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'admin@example.com', password: 'AdminPass1' });
    expect(loginRes.status).toBe(200);

    const verifyRes = await request(app)
      .post('/api/admin/auth/verify-2fa')
      .send({ mfaToken: loginRes.body.data.mfaToken, code: '000000' });
    expect(verifyRes.status).toBe(401);
    expect(verifyRes.body.error.code).toBe('INVALID_OTP');
  });

  it('getAdminAccessToken helper completes MFA', async () => {
    const token = await getAdminAccessToken(app);
    const me = await request(app).get('/api/admin/auth/me').set(withAdminAuth(token));
    expect(me.status).toBe(200);
  });
});
