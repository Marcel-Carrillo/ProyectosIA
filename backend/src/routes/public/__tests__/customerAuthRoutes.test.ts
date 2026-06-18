import request from 'supertest';
import { app } from '../../../index';

describe('customerAuthRoutes', () => {
  const email = `buyer-${Date.now()}@example.com`;
  const password = 'BuyerPass1';

  it('register → login → profile → logout', async () => {
    const register = await request(app)
      .post('/api/public/auth/register')
      .send({ email, password, firstName: 'Jane', lastName: 'Buyer' });
    expect(register.status).toBe(201);
    const accessToken = register.body.data.accessToken as string;

    const profile = await request(app)
      .get('/api/public/account/profile')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.customer.email).toBe(email);

    const logout = await request(app)
      .post('/api/public/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(logout.status).toBe(200);
  });
});
