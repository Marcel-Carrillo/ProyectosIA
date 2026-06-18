import request from 'supertest';
import { app } from '../../../index';
import crypto from 'crypto';
import { hashRefreshToken } from '../../../infrastructure/auth/refreshTokenUtils';
import { prisma } from '../../../infrastructure/prismaClient';

describe('customer auth extended', () => {
  const email = `ext-${Date.now()}@example.com`;
  const password = 'BuyerPass1';
  let accessToken: string;
  let accountId: number;

  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/public/auth/register')
      .send({ email, password, firstName: 'Ext', lastName: 'User' });
    accessToken = reg.body.data.accessToken;
    accountId = reg.body.data.account.id;
  });

  it('mock OAuth login in non-production', async () => {
    const res = await request(app)
      .post('/api/public/auth/oauth/mock')
      .send({
        provider: 'google',
        providerId: `gid-${Date.now()}`,
        email: `oauth-${Date.now()}@example.com`,
        firstName: 'OAuth',
        lastName: 'User',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('forgot password returns generic success', async () => {
    const res = await request(app)
      .post('/api/public/auth/forgot-password')
      .send({ email });
    expect(res.status).toBe(200);
  });

  it('reset password with valid token', async () => {
    const raw = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        customerAccountId: accountId,
        tokenHash: hashRefreshToken(raw),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const res = await request(app)
      .post('/api/public/auth/reset-password')
      .send({ token: raw, password: 'NewPass12' });
    expect(res.status).toBe(200);
  });

  it('2FA setup and confirm', async () => {
    const setup = await request(app)
      .post('/api/public/account/security/2fa/setup')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(setup.status).toBe(200);
    expect(setup.body.data.secret).toBeDefined();

    const speakeasy = await import('speakeasy');
    const code = speakeasy.totp({ secret: setup.body.data.secret, encoding: 'base32' });
    const confirm = await request(app)
      .post('/api/public/account/security/2fa/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code });
    expect(confirm.status).toBe(200);
  });
});
