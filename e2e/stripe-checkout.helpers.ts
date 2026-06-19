import { createRequire } from 'node:module';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import type { APIRequestContext } from '@playwright/test';

const API = 'http://localhost:3000';
const backendRequire = createRequire(path.resolve('backend/package.json'));

export async function registerCustomerViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<void> {
  const res = await request.post(`${API}/api/public/auth/register`, {
    data: { email, password, firstName, lastName },
  });
  if (res.status() !== 201 && res.status() !== 409) {
    throw new Error(`Register failed: ${res.status()} ${await res.text()}`);
  }
}

export async function loginCustomerViaUi(
  page: import('@playwright/test').Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.locator('main input[type="email"]').fill(email);
  await page.locator('main input[type="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(account|catalog)/, { timeout: 20000 });
}

export function getAdminToken(): string {
  const tokenFile = path.resolve('playwright/.auth/token.json');
  return JSON.parse(readFileSync(tokenFile, 'utf8')).accessToken as string;
}

export async function firePaymentSucceededWebhook(
  request: APIRequestContext,
  paymentIntentId: string,
  chargeId: string,
  orderId: number
): Promise<void> {
  const Stripe = backendRequire('stripe') as typeof import('stripe').default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2026-05-27.dahlia',
  });
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_local_dev_testing';
  const eventId = `evt_e2e_${Date.now()}`;

  const payload = JSON.stringify({
    id: eventId,
    object: 'event',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: paymentIntentId,
        object: 'payment_intent',
        metadata: { customerOrderId: String(orderId) },
        latest_charge: chargeId,
      },
    },
  });

  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });

  const resp = await request.post(`${API}/api/public/payments/webhook`, {
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    data: payload,
  });
  if (resp.status() !== 200) {
    throw new Error(`Webhook failed: ${resp.status()} ${await resp.text()}`);
  }
}

export async function deleteOrderById(orderId: number): Promise<void> {
  const { PrismaClient } = backendRequire('@prisma/client') as {
    PrismaClient: new () => {
      refund: { deleteMany: (args: { where: { customerOrderId: number } }) => Promise<unknown> };
      stripeWebhookEvent: { deleteMany: (args: { where: { customerOrderId: number } }) => Promise<unknown> };
      customerOrder: { delete: (args: { where: { id: number } }) => Promise<unknown> };
      $disconnect: () => Promise<void>;
    };
  };
  const prisma = new PrismaClient();
  try {
    await prisma.refund.deleteMany({ where: { customerOrderId: orderId } });
    await prisma.stripeWebhookEvent.deleteMany({ where: { customerOrderId: orderId } });
    await prisma.customerOrder.delete({ where: { id: orderId } });
  } finally {
    await prisma.$disconnect();
  }
}

export function paymentIntentIdFromClientSecret(clientSecret: string): string {
  return clientSecret.split('_secret_')[0];
}

export async function getPaidOrderForRefund(
  request: APIRequestContext,
  token: string,
  orderId: number,
  clientSecret: string
): Promise<{ stripePaymentIntentId: string; totalAmount: string }> {
  const stripePaymentIntentId = paymentIntentIdFromClientSecret(clientSecret);
  const adminOrder = await request.get(`${API}/api/admin/customer-orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const totalAmount = (await adminOrder.json()).data.totalAmount as string;
  return { stripePaymentIntentId, totalAmount };
}

export async function getVariantId(request: APIRequestContext): Promise<number> {
  const list = await request.get(`${API}/api/public/products?pageSize=1`);
  const productId = (await list.json()).data?.items?.[0]?.id;
  if (!productId) throw new Error('No products available');
  const product = await request.get(`${API}/api/public/products/${productId}`);
  const variantId = (await product.json()).data?.variants?.[0]?.id;
  if (!variantId) throw new Error('No product variants available');
  return variantId as number;
}
