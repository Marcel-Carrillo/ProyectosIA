import request from 'supertest';
import { app } from '../../../index';

describe('OAuth providers', () => {
  it('lists provider availability from env', async () => {
    const res = await request(app).get('/api/public/auth/oauth/providers');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      google: expect.any(Boolean),
      apple: expect.any(Boolean),
      facebook: expect.any(Boolean),
    });
  });

  it('returns 501 when Google is not configured', async () => {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      return;
    }
    const res = await request(app).get('/api/public/auth/google');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('OAUTH_NOT_CONFIGURED');
  });

  it('returns 501 when Apple is not configured', async () => {
    if (
      process.env.APPLE_CLIENT_ID
      && process.env.APPLE_TEAM_ID
      && process.env.APPLE_KEY_ID
      && process.env.APPLE_PRIVATE_KEY
    ) {
      return;
    }
    const res = await request(app).get('/api/public/auth/apple');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('OAUTH_NOT_CONFIGURED');
  });

  it('returns 501 when Facebook is not configured', async () => {
    if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
      return;
    }
    const res = await request(app).get('/api/public/auth/facebook');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('OAUTH_NOT_CONFIGURED');
  });
});
