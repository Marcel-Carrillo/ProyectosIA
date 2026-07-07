/**
 * Playwright E2E for customer-order-shipment-status (tasks 9.1–9.7).
 * Run: node openspec/changes/customer-order-shipment-status/reports/run-e2e-playwright-shipment-status.cjs
 */
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:3000';
const PASSWORD = 'BuyerPass1';
const ts = Date.now();
const EMAIL = `e2e-ship-${ts}@example.com`;

let customerId;
let orderShippedId;
let orderPendingId;
let orderProblemId;
let supplierId;
let supplierOrderId;

function psql(sql) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', 'ecommerce-db', 'psql', '-U', 'ecommerceUser', '-d', 'ecommerceDb', '-q', '-t', '-A'],
    { input: sql, encoding: 'utf8' }
  );
  if (result.status !== 0) throw new Error(result.stderr || `psql failed: ${result.status}`);
  const line = result.stdout.trim().split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  return line.trim();
}

async function api(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, json };
}

function storefrontUrl(pathname) {
  if (!pathname.startsWith('/')) throw new Error('pathname must start with /');
  return new URL(pathname, BASE).toString();
}

function orderDetailPath(orderId) {
  const id = Number(String(orderId).trim());
  if (!Number.isInteger(id) || id < 1) throw new Error('Invalid order id');
  return `/account/orders/${id}`;
}

async function gotoStorefront(page, pathname) {
  // E2E harness: pathname comes from fixed routes or numeric order ids validated in orderDetailPath.
  // nosemgrep: javascript.playwright.security.audit.playwright-goto-injection.playwright-goto-injection
  await page.goto(storefrontUrl(pathname), { waitUntil: 'networkidle' });
}

async function loginCustomer(page, email) {
  await gotoStorefront(page, '/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|iniciar sesión/i }).click();
  await page.waitForURL(/\/account/, { timeout: 15000 });
}

function insertOrder(customerId, orderNumber, status) {
  return psql(`
    INSERT INTO "CustomerOrder" (
      "orderNumber", "customerId", "status", "paymentStatus", "fulfillmentStatus",
      "subtotalAmount", "shippingAmount", "discountAmount", "totalAmount", "currency",
      "shippingAddressSnapshot", "billingAddressSnapshot", "createdAt", "updatedAt"
    ) VALUES (
      '${orderNumber}', ${customerId}, '${status}', '${status === 'PendingPayment' ? 'Pending' : 'Paid'}', 'NotStarted',
      29.99, 0, 0, 29.99, 'EUR', '{}', '{}', NOW(), NOW()
    ) RETURNING id;
  `);
}

async function main() {
  const results = [];
  const pass = (name, detail = 'OK') => {
    results.push({ name, status: 'PASS', detail });
    console.log(`[PASS] ${name}: ${detail}`);
  };

  const health = await fetch(`${API}/health`);
  if (!health.ok) throw new Error('Backend not reachable');
  const fe = await fetch(BASE);
  if (!fe.ok) throw new Error('Frontend not reachable');

  const reg = await api('POST', '/api/public/auth/register', {
    firstName: 'E2E',
    lastName: 'Ship',
    email: EMAIL,
    password: PASSWORD,
  });
  if (reg.status !== 201) throw new Error(`Register failed: ${reg.status}`);
  customerId = reg.json.data.customer.id;
  pass('9.1', `Customer ${customerId} registered; servers up`);

  orderShippedId = insertOrder(customerId, `E2E-SHIP-OK-${ts}`, 'Paid');
  orderPendingId = insertOrder(customerId, `E2E-SHIP-PEND-${ts}`, 'PendingPayment');
  orderProblemId = insertOrder(customerId, `E2E-SHIP-PROB-${ts}`, 'Paid');

  psql(`
    INSERT INTO "Shipment" ("customerOrderId", status, carrier, "trackingNumber", "trackingUrl", "shippedAt", "createdAt", "updatedAt")
    VALUES (${orderShippedId}, 'Shipped', 'Correos', 'E2E-TRACK-${ts}', 'https://track.example.com/e2e', NOW(), NOW(), NOW());
  `);

  psql(`
    INSERT INTO "Shipment" ("customerOrderId", status, carrier, "createdAt", "updatedAt")
    VALUES (${orderProblemId}, 'Failed', 'DHL', NOW(), NOW());
  `);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await loginCustomer(page, EMAIL);

    // 9.2 / 9.3 — shipped order detail
    await gotoStorefront(page, orderDetailPath(orderShippedId));
    await page.getByTestId('shipping-section').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('shipping-status-badge').waitFor({ state: 'visible' });
    const badgeText = await page.getByTestId('shipping-status-badge').textContent();
    if (!/enviad|shipped/i.test(badgeText || '')) {
      throw new Error(`Expected Shipped badge, got: ${badgeText}`);
    }
    await page.getByTestId('tracking-link-0').waitFor({ state: 'visible' });
    pass('9.2-9.3', `Detail shows shipping section, badge "${badgeText?.trim()}", tracking link`);

    // 9.4 — list badge
    await gotoStorefront(page, '/account/orders');
    const shippedRow = page.locator(`a[href="${orderDetailPath(orderShippedId)}"]`).locator('..');
    await shippedRow.getByText(/enviad|shipped/i).first().waitFor({ state: 'visible', timeout: 10000 });
    pass('9.4', 'Orders list shows shipping badge for paid/shipped order');

    // 9.5 — pending payment: no shipping, actions present
    await gotoStorefront(page, orderDetailPath(orderPendingId));
    await page.getByTestId('pending-order-actions').waitFor({ state: 'visible', timeout: 10000 });
    if (await page.getByTestId('shipping-section').count()) {
      throw new Error('Shipping section should be hidden for PendingPayment');
    }
    await gotoStorefront(page, '/account/orders');
    await page.getByTestId(`resume-cta-${orderPendingId}`).waitFor({ state: 'visible' });
    const pendingRow = page.locator('.storefront-account__list-item').filter({ has: page.getByTestId(`resume-cta-${orderPendingId}`) });
    if (await pendingRow.getByText(/enviad|shipped|preparando|preparing/i).count()) {
      throw new Error('List should not show shipping badge for PendingPayment');
    }
    pass('9.5', 'PendingPayment hides shipping; resume/cancel actions still render');

    // 9.6 — problem status
    await gotoStorefront(page, orderDetailPath(orderProblemId));
    await page.getByTestId('shipping-section').waitFor({ state: 'visible' });
    const problemBadge = await page.getByTestId('shipping-status-badge').textContent();
    if (!/incidencia|problem/i.test(problemBadge || '')) {
      throw new Error(`Expected Problem badge, got: ${problemBadge}`);
    }
    pass('9.6', `Problem order shows "${problemBadge?.trim()}"`);

    console.log('\nAll E2E assertions passed.');
  } finally {
    await browser.close();
    psql(`DELETE FROM "Shipment" WHERE "customerOrderId" IN (${orderShippedId}, ${orderProblemId});`);
    psql(`DELETE FROM "CustomerOrder" WHERE id IN (${orderShippedId}, ${orderPendingId}, ${orderProblemId});`);
    psql(`DELETE FROM "CustomerAccount" WHERE "customerId" = ${customerId};`);
    psql(`DELETE FROM "Customer" WHERE id = ${customerId};`);
    console.log('E2E cleanup complete.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
