import request from 'supertest';
import { app } from '../../../index';
import {
  clearMailpitMessages,
  isMailpitAvailable,
  waitForPasswordResetEmail,
} from '../../../infrastructure/email/mailpitClient';

jest.setTimeout(30000);

describe('password reset email (Mailpit)', () => {
  let mailpitReady = false;
  const email = `reset-mail-${Date.now()}@example.com`;
  const password = 'BuyerPass1';
  const newPassword = 'ResetPass12';

  beforeAll(async () => {
    mailpitReady = await isMailpitAvailable();
    await request(app)
      .post('/api/public/auth/register')
      .send({ email, password, firstName: 'Reset', lastName: 'Mail' });
  });

  it('delivers reset link via SMTP and completes password reset', async () => {
    if (!mailpitReady) {
      return;
    }

    await clearMailpitMessages();

    const forgot = await request(app)
      .post('/api/public/auth/forgot-password')
      .send({ email });
    expect(forgot.status).toBe(200);

    const token = await waitForPasswordResetEmail(email);

    const reset = await request(app)
      .post('/api/public/auth/reset-password')
      .send({ token, password: newPassword });
    expect(reset.status).toBe(200);

    const loginOld = await request(app)
      .post('/api/public/auth/login')
      .send({ email, password });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app)
      .post('/api/public/auth/login')
      .send({ email, password: newPassword });
    expect(loginNew.status).toBe(200);
    expect(loginNew.body.data.accessToken).toBeDefined();
  });
});
