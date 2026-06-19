/**
 * KAN-30 integration curl verification script.
 * Run: node scripts/kan30-curl-verify.js
 */
const BASE = process.env.API_URL || 'http://localhost:3000';

async function request(method, path, { token, body, expectStatus } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`${method} ${path} expected ${expectStatus}, got ${res.status}: ${text.slice(0, 300)}`);
  }
  return { status: res.status, json, text };
}

function assertNoSupplierFields(obj, label) {
  const s = JSON.stringify(obj);
  for (const field of ['supplierId', 'supplierReference', 'supplierCost']) {
    if (s.includes(`"${field}"`)) {
      throw new Error(`Supplier field ${field} found in ${label}`);
    }
  }
}

async function main() {
  const results = [];

  const login = await request('POST', '/api/admin/auth/login', {
    body: { email: 'admin@example.com', password: 'AdminPass1' },
    expectStatus: 200,
  });
  const token = login.json.data.accessToken;
  results.push('C1 login 200');

  const list = await request('GET', '/api/admin/customer-orders?page=1&pageSize=5', { token, expectStatus: 200 });
  assertNoSupplierFields(list.json, 'list');
  results.push('C2 list 200');

  await request('GET', '/api/admin/customer-orders?status=Paid&paymentStatus=Paid&fulfillmentStatus=NotStarted&search=ORD&createdFrom=2020-01-01&createdTo=2030-12-31&sort=createdAt&order=desc&pageSize=200', {
    token,
    expectStatus: 200,
  });
  results.push('C3 filters 200');

  const clamp = await request('GET', '/api/admin/customer-orders?pageSize=500', { token, expectStatus: 200 });
  if (clamp.json.data.pageSize !== 100) throw new Error('pageSize not clamped to 100');
  results.push('C4 pageSize clamp 100');

  const firstId = list.json.data.items[0]?.id;
  if (!firstId) throw new Error('No orders in list for GET :id test');

  const detail = await request('GET', `/api/admin/customer-orders/${firstId}`, { token, expectStatus: 200 });
  assertNoSupplierFields(detail.json, 'detail');
  results.push('C5 GET :id 200');

  await request('GET', '/api/admin/customer-orders/999999999', { token, expectStatus: 404 });
  results.push('C6 GET missing 404');

  const address = {
    fullName: 'KAN30 Curl',
    streetLine1: 'Test St',
    city: 'Malaga',
    province: 'Malaga',
    postalCode: '29001',
    country: 'Spain',
  };
  const created = await request('POST', '/api/admin/customer-orders', {
    token,
    body: {
      customerId: 6,
      items: [{ productVariantId: 1, quantity: 1 }],
      shippingAddressSnapshot: address,
      billingAddressSnapshot: address,
    },
    expectStatus: 201,
  });
  assertNoSupplierFields(created.json, 'create');
  const orderId = created.json.data.id;
  results.push('C7 POST create 201');

  await request('PATCH', `/api/admin/customer-orders/${orderId}/status`, {
    token,
    body: { status: 'Paid', paymentStatus: 'Paid' },
    expectStatus: 200,
  });
  results.push('C8 PATCH status+payment Paid 200');

  await request('PATCH', `/api/admin/customer-orders/${orderId}/status`, {
    token,
    body: { status: 'PendingPayment' },
    expectStatus: 422,
  });
  results.push('C9 PATCH paid→PendingPayment 422');

  await request('PATCH', `/api/admin/customer-orders/${orderId}/status`, {
    token,
    body: { status: 'Cancelled' },
    expectStatus: 200,
  });
  await request('PATCH', `/api/admin/customer-orders/${orderId}/status`, {
    token,
    body: { fulfillmentStatus: 'Fulfilled' },
    expectStatus: 422,
  });
  results.push('C10 PATCH cancelled fulfillment 422');

  await request('POST', '/api/admin/customer-orders', {
    token,
    body: {
      customerId: 999999999,
      items: [{ productVariantId: 1, quantity: 1 }],
      shippingAddressSnapshot: address,
      billingAddressSnapshot: address,
    },
    expectStatus: 404,
  });
  results.push('C11 missing customer 404');

  await request('POST', '/api/admin/customer-orders', {
    token,
    body: {
      customerId: 6,
      items: [{ productVariantId: 999999999, quantity: 1 }],
      shippingAddressSnapshot: address,
      billingAddressSnapshot: address,
    },
    expectStatus: 404,
  });
  results.push('C12 invalid variant 404');

  await request('POST', '/api/admin/customer-orders', {
    token,
    body: {
      customerId: 6,
      items: [{ productVariantId: 1, quantity: 0 }],
      shippingAddressSnapshot: address,
      billingAddressSnapshot: address,
    },
    expectStatus: 400,
  });
  results.push('C13 invalid quantity 400');

  const pub = await request('GET', '/api/public/customer-orders');
  if (pub.status !== 404) throw new Error(`Public route should 404, got ${pub.status}`);
  results.push('C14 public route 404');

  // cleanup
  const { PrismaClient } = require(require('path').join(__dirname, '../backend/node_modules/@prisma/client'));
  const prisma = new PrismaClient();
  await prisma.customerOrder.delete({ where: { id: orderId } });
  await prisma.$disconnect();
  results.push('C15 cleanup delete');

  console.log(JSON.stringify({ pass: true, results }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ pass: false, error: err.message }, null, 2));
  process.exit(1);
});
