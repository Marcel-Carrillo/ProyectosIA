/**
 * Step 8 curl verification for customer-order-shipment-status.
 * Run: node openspec/changes/customer-order-shipment-status/reports/run-curl-shipment-status.cjs
 */
const { spawnSync } = require('child_process');

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const ts = Date.now();
const emailA = `ship-a-${ts}@example.com`;
const emailB = `ship-b-${ts}@example.com`;
const password = 'BuyerPass1';

const results = [];
let customerIdA;
let customerIdB;
let tokenA;
let tokenB;
let orderId;
let shipmentIds = [];
let supplierId;
let supplierOrderId;

function psql(sql) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', 'ecommerce-db', 'psql', '-U', 'ecommerceUser', '-d', 'ecommerceDb', '-q', '-t', '-A'],
    { input: sql, encoding: 'utf8' }
  );
  if (result.status !== 0) throw new Error(result.stderr || `psql failed: ${result.status}`);
  return result.stdout.trim();
}

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, text };
}

function assert(name, condition, detail = '') {
  results.push({ name, ok: !!condition, detail });
  if (!condition) console.error(`FAIL: ${name}`, detail);
  else console.log(`OK: ${name}`);
}

(async () => {
  try {
    const health = await api('GET', '/health');
    assert('health ok', health.status === 200 && health.body.status === 'ok', JSON.stringify(health.body));

    const regA = await api('POST', '/api/public/auth/register', {
      body: { email: emailA, password, firstName: 'Ship', lastName: 'A' },
    });
    tokenA = regA.body.data.accessToken;
    customerIdA = regA.body.data.customer.id;
    assert('register customer A', regA.status === 201, String(regA.status));

    const regB = await api('POST', '/api/public/auth/register', {
      body: { email: emailB, password, firstName: 'Ship', lastName: 'B' },
    });
    tokenB = regB.body.data.accessToken;
    customerIdB = regB.body.data.customer.id;
    assert('register customer B', regB.status === 201, String(regB.status));

    const address = JSON.stringify({
      fullName: 'Ship A',
      streetLine1: 'Calle Test 1',
      city: 'Malaga',
      province: 'Malaga',
      postalCode: '29001',
      country: 'Spain',
    }).replace(/'/g, "''");

    orderId = psql(`
      INSERT INTO "CustomerOrder" (
        "orderNumber", "customerId", "status", "paymentStatus", "fulfillmentStatus",
        "subtotalAmount", "shippingAmount", "discountAmount", "totalAmount", "currency",
        "shippingAddressSnapshot", "billingAddressSnapshot", "createdAt", "updatedAt"
      ) VALUES (
        'SHIP-TEST-${ts}', ${customerIdA}, 'Paid', 'Paid', 'NotStarted',
        29.99, 0, 0, 29.99, 'EUR',
        '${address}'::jsonb, '${address}'::jsonb, NOW(), NOW()
      ) RETURNING id;
    `);

    // 8.2 — no shipments → Preparing
    let detail = await api('GET', `/api/public/account/orders/${orderId}`, { token: tokenA });
    assert('8.2 detail Preparing', detail.status === 200 && detail.body.data.shippingStatus === 'Preparing');
    assert('8.2 no fulfillmentStatus', !('fulfillmentStatus' in detail.body.data));
    assert('8.2 shipments empty array', Array.isArray(detail.body.data.shipments) && detail.body.data.shipments.length === 0);

    // 8.3 — insert two shipments (one with supplierOrderId)
    supplierId = psql(`INSERT INTO "Supplier" (name, "createdAt", "updatedAt") VALUES ('Ship Test Supplier ${ts}', NOW(), NOW()) RETURNING id;`);
    supplierOrderId = psql(`
      INSERT INTO "SupplierOrder" ("supplierOrderNumber", "customerOrderId", "supplierId", "createdAt", "updatedAt")
      VALUES ('SO-SHIP-${ts}', ${orderId}, ${supplierId}, NOW(), NOW()) RETURNING id;
    `);
    const s1 = psql(`
      INSERT INTO "Shipment" ("customerOrderId", status, carrier, "trackingNumber", "trackingUrl", "shippedAt", "createdAt", "updatedAt")
      VALUES (${orderId}, 'Shipped', 'Correos', 'TRACK-A-${ts}', 'https://track.example.com/a', NOW(), NOW(), NOW())
      RETURNING id;
    `);
    const s2 = psql(`
      INSERT INTO "Shipment" ("customerOrderId", "supplierOrderId", status, carrier, "trackingNumber", "trackingUrl", "shippedAt", "createdAt", "updatedAt")
      VALUES (${orderId}, ${supplierOrderId}, 'Shipped', 'DHL', 'TRACK-B-${ts}', 'https://track.example.com/b', NOW(), NOW(), NOW())
      RETURNING id;
    `);
    shipmentIds = [s1, s2];

    detail = await api('GET', `/api/public/account/orders/${orderId}`, { token: tokenA });
    const json = JSON.stringify(detail.body);
    assert('8.3 shippingStatus Shipped', detail.body.data.shippingStatus === 'Shipped');
    assert('8.3 two shipments', detail.body.data.shipments.length === 2);
    assert('8.3 whitelisted fields', detail.body.data.shipments.every((s) => 'carrier' in s && !('id' in s)));
    assert('8.3 no supplierOrderId', !json.includes('supplierOrderId') && !json.includes('supplierOrder'));

    // 8.4 — Failed → Problem
    psql(`UPDATE "Shipment" SET status = 'Failed', "updatedAt" = NOW() WHERE id = ${s1};`);
    detail = await api('GET', `/api/public/account/orders/${orderId}`, { token: tokenA });
    assert('8.4 shippingStatus Problem', detail.body.data.shippingStatus === 'Problem');

    // 8.5 — all Delivered
    psql(`UPDATE "Shipment" SET status = 'Delivered', "deliveredAt" = NOW(), "updatedAt" = NOW() WHERE "customerOrderId" = ${orderId};`);
    detail = await api('GET', `/api/public/account/orders/${orderId}`, { token: tokenA });
    assert('8.5 shippingStatus Delivered', detail.body.data.shippingStatus === 'Delivered');

    // 8.6 — list has shippingStatus, no shipments array
    const list = await api('GET', '/api/public/account/orders', { token: tokenA });
    const item = list.body.data.items.find((o) => o.id === Number(orderId));
    assert('8.6 list shippingStatus', item && item.shippingStatus === 'Delivered');
    assert('8.6 list omits shipments', item && !('shipments' in item));

    // 8.7 — ownership
    const foreign = await api('GET', `/api/public/account/orders/${orderId}`, { token: tokenB });
    assert('8.7 foreign 404', foreign.status === 404 && foreign.body.error?.code === 'CUSTOMER_ORDER_NOT_FOUND');

    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      console.error('\nFailures:', failed);
      process.exit(1);
    }
    console.log('\nAll curl assertions passed.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
  // 8.8 cleanup
    try {
      if (orderId) psql(`DELETE FROM "Shipment" WHERE "customerOrderId" = ${orderId};`);
      if (supplierOrderId) psql(`DELETE FROM "SupplierOrder" WHERE id = ${supplierOrderId};`);
      if (supplierId) psql(`DELETE FROM "Supplier" WHERE id = ${supplierId};`);
      if (orderId) psql(`DELETE FROM "CustomerOrder" WHERE id = ${orderId};`);
      if (customerIdA) {
        psql(`DELETE FROM "CustomerAccount" WHERE "customerId" = ${customerIdA};`);
        psql(`DELETE FROM "Customer" WHERE id = ${customerIdA};`);
      }
      if (customerIdB) {
        psql(`DELETE FROM "CustomerAccount" WHERE "customerId" = ${customerIdB};`);
        psql(`DELETE FROM "Customer" WHERE id = ${customerIdB};`);
      }
      console.log('Cleanup complete.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }
  }
})();
