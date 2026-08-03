import request from 'supertest';
import { Express } from 'express';
import { getLastAdminOtpForTests } from '../infrastructure/email/adminOtpTestCapture';

export async function getAdminAccessToken(
  app: Express,
  email = process.env.ADMIN_EMAIL ?? 'admin@example.com',
  password = process.env.ADMIN_PASSWORD ?? 'AdminPass1'
): Promise<string> {
  const loginRes = await request(app)
    .post('/api/admin/auth/login')
    .send({ email, password });
  if (loginRes.status !== 200) {
    throw new Error(`Admin login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }

  const mfaToken = loginRes.body.data?.mfaToken as string | undefined;
  if (!mfaToken) {
    throw new Error(`Admin login did not return mfaToken: ${JSON.stringify(loginRes.body)}`);
  }

  const code = getLastAdminOtpForTests();
  if (!code) {
    throw new Error('Admin OTP was not captured for tests');
  }

  const verifyRes = await request(app)
    .post('/api/admin/auth/verify-2fa')
    .send({ mfaToken, code });
  if (verifyRes.status !== 200) {
    throw new Error(`Admin verify-2fa failed: ${verifyRes.status} ${JSON.stringify(verifyRes.body)}`);
  }

  return verifyRes.body.data.accessToken as string;
}

export function withAdminAuth(token: string) {
  return { Authorization: `Bearer ${token}` };
}
