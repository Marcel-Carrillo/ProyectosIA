import request from 'supertest';

jest.mock('../../../infrastructure/stripe/stripeClient', () => ({
  stripe: {
    paymentIntents: {
      create: jest.fn().mockImplementation(() => {
        const id = `pi_test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        return Promise.resolve({ id, client_secret: `${id}_secret` });
      }),
    },
    webhooks: { constructEvent: jest.fn() },
    refunds: { create: jest.fn() },
  },
}));

import { app } from '../../../index';
import { getAdminAccessToken, withAdminAuth } from '../../../test-utils/adminAuthHelper';
import { prisma } from '../../../infrastructure/prismaClient';

const address = {
  fullName: 'Guest User',
  streetLine1: 'Main St',
  city: 'Malaga',
  province: 'Malaga',
  postalCode: '29001',
  country: 'Spain',
};

beforeAll(async () => {
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: { usedCount: 0, active: true },
    create: {
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      minOrderAmount: 0,
      maxUses: 1000,
      active: true,
    },
  });
});

async function getVariantId(): Promise<number | null> {
  const list = await request(app).get('/api/public/products?pageSize=1');
  const productId = list.body.data?.items?.[0]?.id;
  if (!productId) return null;
  const product = await request(app).get(`/api/public/products/${productId}`);
  return product.body.data?.variants?.[0]?.id ?? null;
}

describe('checkout routes', () => {
  it('guest checkout creates order', async () => {
    const variantId = await getVariantId();
    if (!variantId) return;

    const email = `guest-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/public/checkout/guest')
      .send({
        email,
        firstName: 'Guest',
        lastName: 'Checkout',
        items: [{ productVariantId: variantId, quantity: 1 }],
        shippingAddressSnapshot: address,
        billingAddressSnapshot: address,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.orderNumber).toBeDefined();
    expect(res.body.data.items[0].unitPrice).toBeDefined();
  });

  it('rejects invalid variant', async () => {
    const res = await request(app)
      .post('/api/public/checkout/guest')
      .send({
        email: `bad-${Date.now()}@example.com`,
        firstName: 'Bad',
        lastName: 'Variant',
        items: [{ productVariantId: 999999999, quantity: 1 }],
        shippingAddressSnapshot: address,
        billingAddressSnapshot: address,
      });
    expect(res.status).toBe(404);
  });

  it('authenticated checkout with coupon', async () => {
    const variantId = await getVariantId();
    if (!variantId) return;

    const email = `auth-co-${Date.now()}@example.com`;
    const reg = await request(app)
      .post('/api/public/auth/register')
      .send({ email, password: 'BuyerPass1', firstName: 'Auth', lastName: 'Buyer' });
    const token = reg.body.data.accessToken;

    const res = await request(app)
      .post('/api/public/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productVariantId: variantId, quantity: 1 }],
        shippingAddressSnapshot: address,
        billingAddressSnapshot: address,
        couponCode: 'WELCOME10',
      });
    expect(res.status).toBe(201);
    expect(parseFloat(res.body.data.discountAmount)).toBeGreaterThan(0);
  });
});

describe('unified integration smoke', () => {
  it('D.2 customer token rejected on admin API', async () => {
    const reg = await request(app)
      .post('/api/public/auth/register')
      .send({
        email: `cust-admin-${Date.now()}@example.com`,
        password: 'BuyerPass1',
        firstName: 'C',
        lastName: 'User',
      });
    const customerToken = reg.body.data.accessToken;
    const res = await request(app)
      .get('/api/admin/customers')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(401);
  });

  it('D.3 admin panel API requires admin token', async () => {
    const res = await request(app).get('/api/admin/customers');
    expect(res.status).toBe(401);
  });

  it('D.1 guest checkout then register links order', async () => {
    const variantId = await getVariantId();
    if (!variantId) return;

    const email = `link-${Date.now()}@example.com`;
    const guest = await request(app)
      .post('/api/public/checkout/guest')
      .send({
        email,
        firstName: 'Link',
        lastName: 'User',
        items: [{ productVariantId: variantId, quantity: 1 }],
        shippingAddressSnapshot: address,
        billingAddressSnapshot: address,
      });
    expect(guest.status).toBe(201);
    const orderNumber = guest.body.data.orderNumber;

    const reg = await request(app)
      .post('/api/public/auth/register')
      .send({ email, password: 'BuyerPass1', firstName: 'Link', lastName: 'User' });
    expect(reg.status).toBe(201);
    const token = reg.body.data.accessToken;

    const orders = await request(app)
      .get('/api/public/account/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(orders.status).toBe(200);
    const found = orders.body.data.items.some(
      (o: { orderNumber: string }) => o.orderNumber === orderNumber
    );
    expect(found).toBe(true);
  });

  it('B5.1 register login profile wishlist logout', async () => {
    const variantId = await getVariantId();
    const email = `wish-${Date.now()}@example.com`;
    const password = 'BuyerPass1';

    const reg = await request(app)
      .post('/api/public/auth/register')
      .send({ email, password, firstName: 'W', lastName: 'User' });
    const token = reg.body.data.accessToken;

    const profile = await request(app)
      .get('/api/public/account/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(profile.status).toBe(200);

    if (variantId) {
      const wish = await request(app)
        .post('/api/public/account/wishlist')
        .set('Authorization', `Bearer ${token}`)
        .send({ productVariantId: variantId });
      expect([200, 201]).toContain(wish.status);
    }

    const logout = await request(app)
      .post('/api/public/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(200);
  });

  it('C3.2 logged-in checkout with coupon appears in my orders', async () => {
    const variantId = await getVariantId();
    if (!variantId) return;

    const email = `c3-2-${Date.now()}@example.com`;
    const reg = await request(app)
      .post('/api/public/auth/register')
      .send({ email, password: 'BuyerPass1', firstName: 'C3', lastName: 'Two' });
    const token = reg.body.data.accessToken;

    const checkout = await request(app)
      .post('/api/public/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productVariantId: variantId, quantity: 1 }],
        shippingAddressSnapshot: address,
        billingAddressSnapshot: address,
        couponCode: 'WELCOME10',
      });
    expect(checkout.status).toBe(201);
    const orderNumber = checkout.body.data.orderNumber;

    const orders = await request(app)
      .get('/api/public/account/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(orders.body.data.items.some((o: { orderNumber: string }) => o.orderNumber === orderNumber)).toBe(true);
  });

  it('C3.1 guest order visible to admin', async () => {
    const variantId = await getVariantId();
    if (!variantId) return;

    const email = `admin-see-${Date.now()}@example.com`;
    const guest = await request(app)
      .post('/api/public/checkout/guest')
      .send({
        email,
        firstName: 'Admin',
        lastName: 'See',
        items: [{ productVariantId: variantId, quantity: 1 }],
        shippingAddressSnapshot: address,
        billingAddressSnapshot: address,
      });
    const orderNumber = guest.body.data.orderNumber;

    const adminToken = await getAdminAccessToken(app);
    const orders = await request(app)
      .get('/api/admin/customer-orders')
      .set(withAdminAuth(adminToken));
    expect(orders.status).toBe(200);
    const found = orders.body.data.items.some(
      (o: { orderNumber: string }) => o.orderNumber === orderNumber
    );
    expect(found).toBe(true);
  });
});