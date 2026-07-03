/**
 * Playwright E2E for product-customer-reviews (tasks 13.1–13.8).
 * Run: node openspec/changes/product-customer-reviews/reports/run-e2e-playwright-reviews.cjs
 */
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:3000';
const PRODUCT_WITH_ORDER = 105; // Classic Leather Belt
const PRODUCT_ZERO_REVIEWS = 106; // Acetate Sunglasses
const VARIANT_ID = 1122;
const BUYER_EMAIL = `e2e-buyer-${Date.now()}@example.com`;
const NONBUYER_EMAIL = `e2e-nonbuyer-${Date.now()}@example.com`;
const PASSWORD = 'E2eBuyerPass1!';
const REVIEW_TITLE = 'Great quality belt';
const REVIEW_BODY = 'E2E review body — solid leather and fast shipping.';

let buyerCustomerId = null;
let reviewId = null;
let orderId = null;
let orderItemId = null;

// SQL is passed via stdin to psql (never embedded in the shell command string).
function psql(sql) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', 'ecommerce-db', 'psql', '-U', 'ecommerceUser', '-d', 'ecommerceDb', '-q', '-t', '-A'],
    { input: sql, encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || `psql exited with code ${result.status}`);
  }
  const out = result.stdout.trim();
  const line = out.split(/\r?\n/).find((l) => l.trim().length > 0) ?? out;
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
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function registerCustomer(email) {
  const res = await api('POST', '/api/public/auth/register', {
    firstName: 'E2E',
    lastName: 'Buyer',
    email,
    password: PASSWORD,
  });
  if (res.status !== 201) {
    throw new Error(`Register failed for ${email}: ${res.status} ${JSON.stringify(res.json)}`);
  }
  return res.json.data.customer.id;
}

async function loginCustomer(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|iniciar sesión/i }).click();
  await page.waitForURL(/\/account/, { timeout: 15000 });
}

async function goToCatalog(page) {
  await page.locator('a[href="/catalog"]').first().click();
  await page.waitForURL(/\/catalog\/?$/, { timeout: 10000 });
}

async function getJsonLd(page) {
  return page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
    return scripts.map((s) => {
      try {
        return JSON.parse(s.textContent || '');
      } catch {
        return null;
      }
    }).filter(Boolean);
  });
}

function findProductLd(jsonLdList) {
  for (const node of jsonLdList) {
    if (node['@type'] === 'Product') return node;
    if (Array.isArray(node['@graph'])) {
      const p = node['@graph'].find((n) => n['@type'] === 'Product');
      if (p) return p;
    }
  }
  return null;
}

async function adminToken() {
  const res = await api('POST', '/api/admin/auth/login', {
    email: 'admin@example.com',
    password: 'AdminPass1',
  });
  if (res.status !== 200) {
    throw new Error(`Admin login failed: ${res.status}`);
  }
  return res.json.data.accessToken;
}

async function main() {
  const results = [];
  const pass = (name, detail = 'OK') => {
    results.push({ name, status: 'PASS', detail });
    console.log(`[PASS] ${name}: ${detail}`);
  };

  console.log('[setup] Registering test customers...');
  buyerCustomerId = await registerCustomer(BUYER_EMAIL);
  await registerCustomer(NONBUYER_EMAIL);
  pass('13.1', 'Backend/frontend reachable; test customers registered');

  console.log('[setup] Creating paid order for buyer...');
  orderId = psql(
    `INSERT INTO "CustomerOrder" ("orderNumber","customerId","status","paymentStatus","fulfillmentStatus","subtotalAmount","shippingAmount","discountAmount","totalAmount","currency","shippingAddressSnapshot","billingAddressSnapshot","paidAt","createdAt","updatedAt") VALUES ('E2E-REV-${Date.now()}',${buyerCustomerId},'Paid','Paid','Fulfilled',29.99,0,0,29.99,'EUR','{}','{}',NOW(),NOW(),NOW()) RETURNING id;`
  );
  orderItemId = psql(
    `INSERT INTO "CustomerOrderItem" ("customerOrderId","productVariantId","productNameSnapshot","variantSnapshot","skuSnapshot","quantity","unitPrice","totalPrice","fulfillmentStatus","createdAt","updatedAt") VALUES (${orderId},${VARIANT_ID},'Classic Leather Belt','{}','E2E-SKU',1,29.99,29.99,'Fulfilled',NOW(),NOW()) RETURNING id;`
  );
  pass('13.2-fixture', `Paid order ${orderId} / item ${orderItemId} for product ${PRODUCT_WITH_ORDER}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 13.2 — buyer submits review
    await loginCustomer(page, BUYER_EMAIL);
    await goToCatalog(page);
    await page.locator(`a[href="/catalog/${PRODUCT_WITH_ORDER}"]`).first().click();
    await page.waitForURL(`**/catalog/${PRODUCT_WITH_ORDER}`, { timeout: 10000 });
    await page.getByTestId('review-form').waitFor({ state: 'visible', timeout: 15000 });

    await page.getByRole('button', { name: '4 stars' }).click();
    await page.getByLabel('Title (optional)').fill(REVIEW_TITLE);
    await page.getByLabel('Review (optional)').fill(REVIEW_BODY);
    await page.getByRole('button', { name: 'Submit review' }).click();
    await page.getByTestId('review-submitted').waitFor({ state: 'visible', timeout: 10000 });
    pass('13.2', 'Review submitted; pending moderation confirmation shown');

    // 13.3 — JSON-LD without ratings while Pending
    let ld = findProductLd(await getJsonLd(page));
    if (!ld) throw new Error('Product JSON-LD not found');
    if (ld.aggregateRating || ld.review) {
      throw new Error('JSON-LD must omit aggregateRating/review while Pending');
    }
    pass('13.3', 'JSON-LD omits aggregateRating/review while Pending');

    // 13.4 — admin approves
    const token = await adminToken();
    const pending = await api('GET', '/api/admin/reviews?status=Pending', null, token);
    const item = pending.json?.data?.items?.find((r) => r.productId === PRODUCT_WITH_ORDER);
    if (!item) throw new Error('Pending review not found in admin queue');
    reviewId = item.id;
    const approved = await api(
      'PATCH',
      `/api/admin/reviews/${reviewId}/status`,
      { status: 'Approved' },
      token
    );
    if (approved.status !== 200) {
      throw new Error(`Approve failed: ${approved.status}`);
    }
    pass('13.4', `Review ${reviewId} approved via admin API`);

    // 13.5 — reload PDP, review visible + JSON-LD
    await page.goto(`${BASE}/catalog/${PRODUCT_WITH_ORDER}`, { waitUntil: 'networkidle' });
    await page.getByText(REVIEW_TITLE).waitFor({ state: 'visible', timeout: 10000 });
    ld = findProductLd(await getJsonLd(page));
    if (!ld?.aggregateRating || !ld?.review?.length) {
      throw new Error('JSON-LD missing aggregateRating/review after approval');
    }
    if (ld.aggregateRating.ratingValue !== 4 || ld.aggregateRating.reviewCount !== 1) {
      throw new Error(`Unexpected aggregateRating: ${JSON.stringify(ld.aggregateRating)}`);
    }
    pass('13.5', 'Approved review visible; JSON-LD aggregateRating + review present');

    // 13.6 — non-buyer sees purchase required
    const page2 = await browser.newPage();
    await loginCustomer(page2, NONBUYER_EMAIL);
    await goToCatalog(page2);
    await page2.locator(`a[href="/catalog/${PRODUCT_WITH_ORDER}"]`).first().click();
    await page2.getByTestId('review-purchase-required').waitFor({ state: 'visible', timeout: 15000 });
    pass('13.6', 'Non-buyer sees purchase-required state');
    await page2.close();

    // 13.7 — zero-review product
    const page3 = await browser.newPage();
    await page3.goto(`${BASE}/catalog/${PRODUCT_ZERO_REVIEWS}`, { waitUntil: 'networkidle' });
    await page3.getByTestId('reviews-empty-state').waitFor({ state: 'visible', timeout: 15000 });
    ld = findProductLd(await getJsonLd(page3));
    if (ld?.aggregateRating || ld?.review) {
      throw new Error('Zero-review product must not emit rating JSON-LD');
    }
    pass('13.7', 'Zero-review product: empty state, no rating JSON-LD');
    await page3.close();
  } finally {
    await browser.close();
  }

  // 13.8 — cleanup
  if (reviewId) {
    const token = await adminToken().catch(() => null);
    if (token) {
      await api('DELETE', `/api/admin/reviews/${reviewId}`, null, token);
    }
  }
  if (orderItemId) psql(`DELETE FROM "CustomerOrderItem" WHERE id = ${orderItemId};`);
  if (orderId) psql(`DELETE FROM "CustomerOrder" WHERE id = ${orderId};`);
  for (const email of [BUYER_EMAIL, NONBUYER_EMAIL]) {
    psql(`DELETE FROM "CustomerAccount" WHERE email = '${email}';`);
    psql(`DELETE FROM "Customer" WHERE email = '${email}';`);
  }
  const reviewCount = psql('SELECT COUNT(*) FROM "Review";');
  pass('13.8', `Cleanup done; Review rows = ${reviewCount}`);

  console.log(`\nAll E2E checks passed: ${results.length}`);
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exit(1);
});
