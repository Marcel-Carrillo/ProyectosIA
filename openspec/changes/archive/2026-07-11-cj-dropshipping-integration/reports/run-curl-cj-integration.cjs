/**
 * Step 11 curl verification for cj-dropshipping-integration.
 * Run: node openspec/changes/cj-dropshipping-integration/reports/run-curl-cj-integration.cjs
 */
const { spawnSync } = require('child_process');

const API = process.env.API_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPass1';
const ts = Date.now();

let token;
let supplierId;
let integrationId;
let supplierOrderId;
let customerOrderId;
let mappedVid;
let logisticName;
let externalOrderId;

const results = [];

function psql(sql) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', 'ecommerce-db', 'psql', '-U', 'ecommerceUser', '-d', 'ecommerceDb', '-q', '-t', '-A'],
    { input: sql, encoding: 'utf8' }
  );
  if (result.status !== 0) throw new Error(result.stderr || `psql failed: ${result.status}`);
  return result.stdout.trim();
}

async function api(method, path, { body, auth = true, timeoutMs = 120_000 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
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

/** CJ catalog sync can exceed Node fetch's 300s headers timeout — use curl instead. */
function apiCurl(method, path, { body, auth = true, maxTimeSec = 1200 } = {}) {
  const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const args = [
    '-sS',
    '-w',
    '\n__HTTP_STATUS__%{http_code}',
    '-X',
    method,
    '-H',
    'Content-Type: application/json',
    '--max-time',
    String(maxTimeSec),
  ];
  if (auth && token) args.push('-H', `Authorization: Bearer ${token}`);
  if (body) args.push('-d', JSON.stringify(body));
  args.push(`${API}${path}`);
  const result = spawnSync(curlBin, args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (result.error) throw result.error;
  const raw = result.stdout ?? '';
  const marker = raw.lastIndexOf('\n__HTTP_STATUS__');
  const text = marker >= 0 ? raw.slice(0, marker) : raw;
  const status = marker >= 0 ? Number(raw.slice(marker + '\n__HTTP_STATUS__'.length)) : 0;
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status, body: json, text };
}

function assert(name, condition, detail = '') {
  results.push({ name, ok: !!condition, detail });
  if (!condition) console.error('FAIL:', name, detail);
  else console.log('OK:', name);
}

(async () => {
  try {
    const health = await api('GET', '/health', { auth: false });
    assert('11.1 health ok', health.status === 200 && health.body.status === 'ok');

    const login = await api('POST', '/api/admin/auth/login', {
      auth: false,
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    token = login.body?.data?.accessToken;
    assert('11.1 admin login', login.status === 200 && !!token);

    const supplier = await api('POST', '/api/admin/suppliers', {
      body: { name: `CJ Curl Test ${ts}` },
    });
    supplierId = supplier.body?.data?.id;
    assert('setup supplier', supplier.status === 201 && supplierId);

    const missingConn = await api('GET', `/api/admin/suppliers/${supplierId}/cj/connection`);
    assert('11.8 missing connection 404', missingConn.status === 404 && missingConn.body?.error?.code === 'CJ_CONNECTION_NOT_FOUND');

    const conn = await api('POST', `/api/admin/suppliers/${supplierId}/cj/connection`, {
      body: { externalAccountRef: `cj-acc-${ts}` },
    });
    integrationId = conn.body?.data?.id;
    const connJson = JSON.stringify(conn.body);
    assert('11.2 configure connection', (conn.status === 201 || conn.status === 200) && integrationId);
    assert('11.2 no credential in response', !/apiKey|credential|CJ5588911/i.test(connJson));

    const syncBefore = await api('POST', `/api/admin/suppliers/${supplierId}/cj/sync`);
    assert('11.8 sync while disconnected 422', syncBefore.status === 422 && syncBefore.body?.error?.code === 'CJ_CONNECTION_NOT_READY');

    const verify = await api('POST', `/api/admin/suppliers/${supplierId}/cj/connection/verify`);
    assert('11.3 verify healthy', verify.status === 200 && verify.body?.data?.healthy === true, JSON.stringify(verify.body));

    const connAfter = await api('GET', `/api/admin/suppliers/${supplierId}/cj/connection`);
    assert('11.3 status Connected', connAfter.body?.data?.status === 'Connected');

    const sync = apiCurl('POST', `/api/admin/suppliers/${supplierId}/cj/sync`, { maxTimeSec: 600 });
    assert('11.4 sync ok', sync.status === 200 && typeof sync.body?.data?.itemsUpserted === 'number', JSON.stringify(sync.body?.data));

    await new Promise((r) => setTimeout(r, 3000));

    const catalog = apiCurl('GET', `/api/admin/suppliers/${supplierId}/cj/catalog?page=1&pageSize=20`);
    const items = catalog.body?.data?.items ?? [];
    assert('11.4 catalog has items', catalog.status === 200 && items.length > 0, `total=${catalog.body?.data?.total}`);
    mappedVid =
      items.find((i) => i.syncStatus === 'Synced')?.externalRef ??
      items.find((i) => i.externalRef && !String(i.externalRef).startsWith('unknown-'))?.externalRef ??
      null;
    if (!mappedVid && integrationId) {
      mappedVid = psql(
        `SELECT "externalRef" FROM "CjCatalogItem" WHERE "supplierIntegrationId" = ${integrationId} AND "syncStatus" = 'Synced' AND "externalRef" NOT LIKE 'unknown-%' LIMIT 1;`
      );
    }
    assert('11.4 mapped vid', !!mappedVid, mappedVid);

    const address = JSON.stringify({
      fullName: 'CJ Test Buyer',
      phone: '+34600000000',
      streetLine1: 'Calle Test 1',
      city: 'Malaga',
      province: 'Malaga',
      postalCode: '29001',
      country: 'Spain',
    }).replace(/'/g, "''");

    customerOrderId = psql(`
      INSERT INTO "CustomerOrder" (
        "orderNumber", "customerId", "status", "paymentStatus", "fulfillmentStatus",
        "subtotalAmount", "shippingAmount", "discountAmount", "totalAmount", "currency",
        "shippingAddressSnapshot", "billingAddressSnapshot", "createdAt", "updatedAt"
      ) VALUES (
        'CJ-CURL-${ts}', (SELECT id FROM "Customer" ORDER BY id LIMIT 1), 'Paid', 'Paid', 'NotStarted',
        29.99, 0, 0, 29.99, 'EUR',
        '${address}'::jsonb, '${address}'::jsonb, NOW(), NOW()
      ) RETURNING id;
    `);

    const customerOrderItemId = psql(`
      INSERT INTO "CustomerOrderItem" (
        "customerOrderId", "productVariantId", "productNameSnapshot", "variantSnapshot",
        "skuSnapshot", quantity, "unitPrice", "totalPrice", "createdAt", "updatedAt"
      ) VALUES (
        ${customerOrderId},
        (SELECT id FROM "ProductVariant" ORDER BY id LIMIT 1),
        'CJ Curl Item', '{}'::jsonb, 'CJ-CURL-SKU', 1, 9.99, 9.99, NOW(), NOW()
      ) RETURNING id;
    `);

    const productVariantId = psql(`SELECT "productVariantId" FROM "CustomerOrderItem" WHERE id = ${customerOrderItemId};`);

    supplierOrderId = psql(`
      INSERT INTO "SupplierOrder" (
        "supplierOrderNumber", "customerOrderId", "supplierId", "status",
        "createdAt", "updatedAt"
      ) VALUES (
        'SO-CJ-CURL-${ts}', ${customerOrderId}, ${supplierId}, 'Draft', NOW(), NOW()
      ) RETURNING id;
    `);

    psql(`
      INSERT INTO "SupplierOrderItem" (
        "supplierOrderId", "customerOrderItemId", "productVariantId",
        "supplierReferenceSnapshot", quantity, "supplierCost", "createdAt", "updatedAt"
      ) VALUES (
        ${supplierOrderId}, ${customerOrderItemId}, ${productVariantId}, '${mappedVid}', 1, 9.99, NOW(), NOW()
      );
    `);

    const freight = await api('POST', `/api/admin/supplier-orders/${supplierOrderId}/cj/freight-quote`);
    const options = freight.body?.data ?? [];
    assert('11.5 freight quote', freight.status === 200 && options.length > 0, JSON.stringify(options.slice(0, 2)));
    logisticName = options[0]?.logisticName;
    assert('11.5 logistic name', !!logisticName, logisticName);

    const unmappedOrderId = psql(`
      INSERT INTO "SupplierOrder" (
        "supplierOrderNumber", "customerOrderId", "supplierId", "status",
        "createdAt", "updatedAt"
      ) VALUES (
        'SO-CJ-UNMAP-${ts}', ${customerOrderId}, ${supplierId}, 'Draft', NOW(), NOW()
      ) RETURNING id;
    `);
    psql(`
      INSERT INTO "SupplierOrderItem" (
        "supplierOrderId", "customerOrderItemId", "productVariantId",
        "supplierReferenceSnapshot", quantity, "supplierCost", "createdAt", "updatedAt"
      ) VALUES (
        ${unmappedOrderId}, ${customerOrderItemId}, ${productVariantId}, 'UNMAPPED-VID-${ts}', 1, 9.99, NOW(), NOW()
      );
    `);
    const unmappedFreight = await api('POST', `/api/admin/supplier-orders/${unmappedOrderId}/cj/freight-quote`);
    assert('11.8 unmapped item 422', unmappedFreight.status === 422 && unmappedFreight.body?.error?.code === 'CJ_ITEM_NOT_MAPPED');

    const sandboxInject = await api('POST', `/api/admin/supplier-orders/${supplierOrderId}/cj/push`, {
      body: { logisticName, isSandbox: 0 },
    });
    assert('11.8 isSandbox injection rejected', sandboxInject.status === 400);

    const push = await api('POST', `/api/admin/supplier-orders/${supplierOrderId}/cj/push`, {
      body: { logisticName },
    });
    externalOrderId = push.body?.data?.externalOrderId;
    assert('11.6 push created', push.status === 201 && !!externalOrderId, JSON.stringify({ externalOrderId, sandbox: push.body?.data?.sandbox }));
    assert('11.6 sandbox true', push.body?.data?.sandbox === true);

    const dupPush = await api('POST', `/api/admin/supplier-orders/${supplierOrderId}/cj/push`, {
      body: { logisticName },
    });
    assert('11.6 duplicate push 409', dupPush.status === 409 && dupPush.body?.error?.code === 'CJ_ORDER_ALREADY_PUSHED');

    const status = await api('GET', `/api/admin/supplier-orders/${supplierOrderId}/cj/order`);
    assert('11.7 order status', status.status === 200 && !!status.body?.data?.externalOrderStatus, JSON.stringify(status.body?.data));

    const missingSupplier = await api('GET', '/api/admin/suppliers/999999/cj/connection');
    assert('11.8 missing supplier 404', missingSupplier.status === 404);

    const missingOrder = await api('GET', '/api/admin/supplier-orders/999999/cj/order');
    assert('11.8 missing supplier order 404', missingOrder.status === 404);

    const publicCj = await api('GET', `/api/public/suppliers/${supplierId}/cj/catalog`, { auth: false });
    assert('public cj route 404', publicCj.status === 404);

    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      console.error('\nFailures:', failed);
      process.exit(1);
    }
    console.log('\nAll curl assertions passed.');
    console.log(JSON.stringify({ supplierId, supplierOrderId, mappedVid, externalOrderId, logisticName }, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    try {
      if (supplierOrderId) {
        psql(`DELETE FROM "SupplierOrderItem" WHERE "supplierOrderId" IN (${supplierOrderId}, (SELECT id FROM "SupplierOrder" WHERE "supplierOrderNumber" = 'SO-CJ-UNMAP-${ts}'));`);
        psql(`DELETE FROM "SupplierOrder" WHERE "supplierOrderNumber" LIKE 'SO-CJ-%${ts}';`);
      }
      if (customerOrderId) {
        psql(`DELETE FROM "CustomerOrderItem" WHERE "customerOrderId" = ${customerOrderId};`);
        psql(`DELETE FROM "CustomerOrder" WHERE id = ${customerOrderId};`);
      }
      if (integrationId) psql(`DELETE FROM "CjCatalogItem" WHERE "supplierIntegrationId" = ${integrationId};`);
      if (integrationId) psql(`DELETE FROM "SupplierIntegration" WHERE id = ${integrationId};`);
      if (supplierId) psql(`DELETE FROM "Supplier" WHERE id = ${supplierId};`);
      console.log('Cleanup complete.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }
  }
})();
