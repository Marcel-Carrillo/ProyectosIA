/**
 * Manual curl-style verification for supplier-order-management (KAN-19).
 * Run: node scripts/verify-supplier-orders-api.js
 */
const { PrismaClient } = require('@prisma/client');

const BASE = process.env.API_BASE || 'http://localhost:3000';
const prisma = new PrismaClient();

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function main() {
  const baseline = {
    supplierOrders: await prisma.supplierOrder.count(),
    customerOrders: await prisma.customerOrder.count(),
  };
  console.log('Baseline:', baseline);

  const variantBefore = await prisma.productVariant.findUnique({
    where: { id: 1 },
    select: { supplierId: true, supplierCost: true, supplierReference: true },
  });

  await prisma.productVariant.update({
    where: { id: 1 },
    data: {
      supplierId: 3,
      supplierCost: '24.99',
      supplierReference: 'SUP-TEST-1',
    },
  });

  try {

  const list = await request('GET', '/api/admin/supplier-orders');
  console.log('LIST', list.status, list.body.success);

  const missing = await request('GET', '/api/admin/supplier-orders/99999');
  console.log('GET missing', missing.status, missing.body?.error?.code);

  const pub = await request('GET', '/api/public/supplier-orders');
  console.log('PUBLIC', pub.status, pub.body?.error?.code);

  const address = {
    fullName: 'Curl Test',
    streetLine1: 'St',
    city: 'Malaga',
    province: 'Malaga',
    postalCode: '29001',
    country: 'Spain',
  };

  const created = await request('POST', '/api/admin/customer-orders', {
    customerId: 6,
    items: [{ productVariantId: 1, quantity: 1 }],
    shippingAddressSnapshot: address,
    billingAddressSnapshot: address,
  });
  console.log('CREATE CO', created.status);
  const orderId = created.body.data.id;

  await request('PATCH', `/api/admin/customer-orders/${orderId}/status`, {
    status: 'Paid',
    paymentStatus: 'Paid',
  });

  const gen = await request('POST', `/api/admin/customer-orders/${orderId}/supplier-orders`);
  console.log('GENERATE', gen.status, gen.body.data?.length);
  const spoId = gen.body.data[0].id;

  const detail = await request('GET', `/api/admin/supplier-orders/${spoId}`);
  console.log('GET SPO', detail.status, detail.body.data?.supplierOrderNumber);

  const patch = await request('PATCH', `/api/admin/supplier-orders/${spoId}/status`, {
    status: 'Requested',
    trackingNumber: 'TRK123',
  });
  console.log('PATCH', patch.status, patch.body.data?.status);

  const invalid = await request('PATCH', `/api/admin/supplier-orders/${spoId}/status`, {
    status: 'Delivered',
  });
  console.log('INVALID', invalid.status, invalid.body?.error?.code);

  const coGet = await request('GET', `/api/admin/customer-orders/${orderId}`);
  const coStr = JSON.stringify(coGet.body);
  console.log('NO SUPPLIER LEAK', !/supplierCost|supplierReference/.test(coStr));

  const ineligible = await request('POST', '/api/admin/customer-orders', {
    customerId: 6,
    items: [{ productVariantId: 1, quantity: 1 }],
    shippingAddressSnapshot: address,
    billingAddressSnapshot: address,
  });
  const pendingId = ineligible.body.data.id;
  const genFail = await request('POST', `/api/admin/customer-orders/${pendingId}/supplier-orders`);
  console.log('INELIGIBLE GEN', genFail.status, genFail.body?.error?.code);

  // cleanup
  await prisma.supplierOrderItem.deleteMany({
    where: { supplierOrder: { customerOrderId: { in: [orderId, pendingId] } } },
  });
  await prisma.supplierOrder.deleteMany({
    where: { customerOrderId: { in: [orderId, pendingId] } },
  });
  await prisma.customerOrderItem.deleteMany({
    where: { customerOrderId: { in: [orderId, pendingId] } },
  });
  await prisma.customerOrder.deleteMany({ where: { id: { in: [orderId, pendingId] } } });

  const after = {
    supplierOrders: await prisma.supplierOrder.count(),
    customerOrders: await prisma.customerOrder.count(),
  };
  console.log('After:', after);
  console.log('RESTORED', JSON.stringify(after) === JSON.stringify(baseline));
  } finally {
    await prisma.productVariant.update({
      where: { id: 1 },
      data: {
        supplierId: variantBefore?.supplierId ?? null,
        supplierCost: variantBefore?.supplierCost ?? null,
        supplierReference: variantBefore?.supplierReference ?? null,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
