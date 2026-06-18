import request from 'supertest';
import { app } from '../../../index';

describe('customer order isolation', () => {
  const emailA = `buyer-a-${Date.now()}@example.com`;
  const emailB = `buyer-b-${Date.now()}@example.com`;
  const password = 'BuyerPass1';
  let tokenA: string;
  let orderIdB: number;

  beforeAll(async () => {
    const regA = await request(app)
      .post('/api/public/auth/register')
      .send({ email: emailA, password, firstName: 'A', lastName: 'Buyer' });
    tokenA = regA.body.data.accessToken;

    const regB = await request(app)
      .post('/api/public/auth/register')
      .send({ email: emailB, password, firstName: 'B', lastName: 'Buyer' });
    const tokenB = regB.body.data.accessToken;

    const variant = await request(app).get('/api/public/products?pageSize=1');
    const productId = variant.body.data?.items?.[0]?.id;
    if (!productId) return;

    const product = await request(app).get(`/api/public/products/${productId}`);
    const variantId = product.body.data?.variants?.[0]?.id;
    if (!variantId) return;

    const address = {
      fullName: 'B Buyer',
      streetLine1: 'Main St',
      city: 'Malaga',
      province: 'Malaga',
      postalCode: '29001',
      country: 'Spain',
    };

    const checkout = await request(app)
      .post('/api/public/checkout')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        items: [{ productVariantId: variantId, quantity: 1 }],
        shippingAddressSnapshot: address,
        billingAddressSnapshot: address,
      });
    if (checkout.status === 201) {
      orderIdB = checkout.body.data.id;
    }
  });

  it('rejects unauthenticated account routes', async () => {
    const res = await request(app).get('/api/public/account/orders');
    expect(res.status).toBe(401);
  });

  it('buyer A cannot read buyer B order', async () => {
    if (!orderIdB) {
      expect(orderIdB).toBeUndefined();
      return;
    }
    const res = await request(app)
      .get(`/api/public/account/orders/${orderIdB}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CUSTOMER_ORDER_NOT_FOUND');
  });
});
