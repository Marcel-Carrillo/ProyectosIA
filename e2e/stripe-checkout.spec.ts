import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  deleteOrderById,
  firePaymentSucceededWebhook,
  getAdminToken,
  getPaidOrderForRefund,
  getVariantId,
  loginCustomerViaUi,
  paymentIntentIdFromClientSecret,
  registerCustomerViaApi,
} from './stripe-checkout.helpers';

const API = 'http://localhost:3000';
const backendRequire = createRequire(path.resolve('backend/package.json'));

const address = {
  fullName: 'Stripe E2E User',
  streetLine1: 'Test St 1',
  city: 'Malaga',
  province: 'Malaga',
  postalCode: '29001',
  country: 'Spain',
};

async function fillCheckoutDetails(page: import('@playwright/test').Page, email: string, firstName: string, lastName: string) {
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('First name').fill(firstName);
  await page.getByPlaceholder('Last name').fill(lastName);
  for (const [key, value] of Object.entries(address)) {
    await page.getByPlaceholder(key).first().fill(value);
    await page.getByPlaceholder(key).nth(1).fill(value);
  }
}

async function fillStripePaymentElement(page: import('@playwright/test').Page, cardNumber: string) {
  await page.getByTestId('btn-pay').waitFor({ state: 'visible', timeout: 30000 });
  const paymentRoot = page.frameLocator('main iframe').first();
  await paymentRoot.getByRole('button', { name: /^Card$/i }).click();
  await paymentRoot.getByRole('textbox', { name: /card number/i }).fill(cardNumber, { timeout: 30000 });
  await paymentRoot.getByRole('textbox', { name: /expiration date/i }).fill('12 / 34', { timeout: 10000 });
  await paymentRoot.getByRole('textbox', { name: /security code/i }).fill('123', { timeout: 10000 });
}

async function goToPaymentStep(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  email: string,
  firstName: string,
  lastName: string,
  authenticated = false
) {
  if (authenticated) {
    await registerCustomerViaApi(request, email, 'BuyerPass1', firstName, lastName);
    await loginCustomerViaUi(page, email, 'BuyerPass1');
  }

  await page.goto('/catalog');
  await page.locator('main a[href^="/catalog/"]').first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();
  await page.getByRole('link', { name: /cart/i }).click();
  await page.getByRole('button', { name: /^checkout$/i }).click();

  if (!authenticated) {
    await fillCheckoutDetails(page, email, firstName, lastName);
  } else {
    for (const [key, value] of Object.entries(address)) {
      await page.getByPlaceholder(key).first().fill(value);
      await page.getByPlaceholder(key).nth(1).fill(value);
    }
  }

  const checkoutPath = authenticated ? '/api/public/checkout' : '/api/public/checkout/guest';
  const checkoutPromise = page.waitForResponse(
    (r) => r.url().includes(checkoutPath) && r.status() === 201,
    { timeout: 30000 }
  );
  await page.getByTestId('btn-continue-to-payment').click();
  const checkoutResp = await checkoutPromise;
  const body = await checkoutResp.json();
  await page.waitForSelector('main iframe', { timeout: 30000 });
  return body.data as {
    id: number;
    orderNumber: string;
    clientSecret: string;
    totalAmount: string;
  };
}

test.describe('Stripe checkout E2E', () => {
  test.describe.configure({ mode: 'serial' });

  let cleanupOrderId: number | null = null;

  test.afterEach(async () => {
    if (cleanupOrderId) {
      await deleteOrderById(cleanupOrderId);
      cleanupOrderId = null;
    }
  });

  test('13.4–13.6 success flow with test card 4242', async ({ page, request }) => {
    const email = `stripe-e2e-${Date.now()}@example.com`;
    const order = await goToPaymentStep(page, request, email, 'Stripe', 'E2E');
    cleanupOrderId = order.id;

    await fillStripePaymentElement(page, '4242424242424242');
    await page.getByTestId('btn-pay').click();

    await page.waitForURL(new RegExp(`/order-confirmation/${order.orderNumber}`), { timeout: 60000 });
    await expect(page.getByTestId('payment-polling')).toBeVisible();

    const Stripe = backendRequire('stripe') as typeof import('stripe').default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-05-27.dahlia' });
    const paymentIntentId = paymentIntentIdFromClientSecret(order.clientSecret);
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
    if (!chargeId) throw new Error('No charge on PaymentIntent after confirm');

    await firePaymentSucceededWebhook(request, paymentIntentId, chargeId, order.id);
    await expect(page.getByTestId('payment-success')).toBeVisible({ timeout: 15000 });
  });

  test('13.7 declined card 4000 0000 0000 9995 shows error', async ({ page, request }) => {
    const email = `stripe-decline-${Date.now()}@example.com`;
    const order = await goToPaymentStep(page, request, email, 'Decline', 'Test');
    cleanupOrderId = order.id;

    await fillStripePaymentElement(page, '4000000000009995');
    await page.getByTestId('btn-pay').click();

    await expect(page.getByTestId('payment-error')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('btn-pay')).toBeEnabled();
  });

  test('12.7 admin refund Processing stores Stripe refund id', async ({ request }) => {
    const variantId = await getVariantId(request);
    const email = `refund-e2e-${Date.now()}@example.com`;
    const adminToken = getAdminToken();

    const checkout = await request.post(`${API}/api/public/checkout/guest`, {
      data: {
        email,
        firstName: 'Refund',
        lastName: 'Test',
        items: [{ productVariantId: variantId, quantity: 1 }],
        shippingAddressSnapshot: address,
        billingAddressSnapshot: address,
      },
    });
    expect(checkout.status()).toBe(201);
    const checkoutBody = await checkout.json();
    const order = checkoutBody.data;
    cleanupOrderId = order.id;
    const { stripePaymentIntentId, totalAmount } = await getPaidOrderForRefund(
      request,
      adminToken,
      order.id,
      order.clientSecret
    );

    const Stripe = backendRequire('stripe') as typeof import('stripe').default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-05-27.dahlia' });
    const confirmed = await stripe.paymentIntents.confirm(stripePaymentIntentId, {
      payment_method: 'pm_card_visa',
      return_url: 'http://localhost:3001/order-confirmation/test',
    });
    const chargeId = typeof confirmed.latest_charge === 'string'
      ? confirmed.latest_charge
      : confirmed.latest_charge?.id;
    if (!chargeId) throw new Error('Missing charge after PI confirm');

    await firePaymentSucceededWebhook(request, stripePaymentIntentId, chargeId, order.id);

    const createRefund = await request.post(`${API}/api/admin/refunds`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { customerOrderId: order.id, amount: totalAmount, reason: 'E2E refund test' },
    });
    expect(createRefund.status()).toBe(201);
    const refund = (await createRefund.json()).data;

    const patch = await request.patch(`${API}/api/admin/refunds/${refund.id}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: 'Processing' },
    });
    expect(patch.status()).toBe(200);
    const updated = (await patch.json()).data;
    expect(updated.paymentProviderReference).toMatch(/^re_/);
    expect(updated.status).toBe('Processing');
  });
});
