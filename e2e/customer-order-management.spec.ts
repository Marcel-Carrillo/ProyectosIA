import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const API = 'http://localhost:3000';
const backendRequire = createRequire(path.resolve('backend/package.json'));

function getCachedToken(): string {
  const tokenFile = path.resolve('playwright/.auth/token.json');
  return JSON.parse(readFileSync(tokenFile, 'utf8')).accessToken as string;
}

async function createTestOrder(page: Page): Promise<{ id: number; orderNumber: string }> {
  const token = getCachedToken();
  const address = {
    fullName: 'E2E User',
    streetLine1: 'Test St',
    city: 'Malaga',
    province: 'Malaga',
    postalCode: '29001',
    country: 'Spain',
  };
  const resp = await page.request.post(`${API}/api/admin/customer-orders`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      customerId: 6,
      items: [{ productVariantId: 1, quantity: 1 }],
      shippingAddressSnapshot: address,
      billingAddressSnapshot: address,
    },
  });
  expect(resp.status()).toBe(201);
  const json = (await resp.json()) as { data: { id: number; orderNumber: string } };
  return json.data;
}

async function deleteOrder(_page: Page, id: number): Promise<void> {
  const { PrismaClient } = backendRequire('@prisma/client') as {
    PrismaClient: new () => {
      customerOrder: { delete: (args: { where: { id: number } }) => Promise<unknown> };
      $disconnect: () => Promise<void>;
    };
  };
  const prisma = new PrismaClient();
  try {
    await prisma.customerOrder.delete({ where: { id } });
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeEach(async ({ page }) => {
  const token = getCachedToken();
  await page.route('**/api/admin/auth/refresh', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { accessToken: token } }),
    });
  });
  await page.route('**/api/admin/auth/me', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { admin: { id: 1, email: 'admin@example.com', status: 'Active' } },
      }),
    });
  });
});

test.describe('Customer Order Management E2E', () => {
  test('list → detail → three status dimensions → no supplier fields', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const order = await createTestOrder(page);

    try {
      await page.goto('/customer-orders');
      await expect(page.getByTestId('order-search')).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('order-date-from')).toBeVisible();
      await expect(page.getByTestId('order-date-to')).toBeVisible();

      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/supplierCost/i);
      expect(bodyText).not.toMatch(/supplierReference/i);
      expect(bodyText).not.toMatch(/supplierId/i);

      await page.getByTestId(`order-link-${order.id}`).click();
      await expect(page.getByTestId('order-status-timeline')).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('order-status-control')).toBeVisible();

      await page.getByTestId('select-order-status').selectOption('Paid');
      await page.getByTestId('select-payment-status').selectOption('Paid');
      await page.getByTestId('select-fulfillment-status').selectOption('PendingSupplierOrder');
      await page.getByTestId('btn-save-status').click();

      await expect(page.getByTestId('detail-badge-order')).toContainText('Paid', { timeout: 10000 });
      await expect(page.getByTestId('detail-badge-payment')).toContainText('Paid');
      await expect(page.getByTestId('detail-badge-fulfillment')).toContainText('PendingSupplierOrder');
    } finally {
      await deleteOrder(page, order.id);
    }
  });

  for (const [width, height, label] of [
    [360, 640, 'mobile'],
    [768, 1024, 'tablet'],
    [1280, 800, 'desktop'],
  ] as const) {
    test(`no horizontal overflow at ${label} (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/customer-orders');
      await expect(page.getByTestId('order-search')).toBeVisible({ timeout: 10000 });
      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth > el.clientWidth + 1;
      });
      expect(overflow).toBe(false);
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/supplierCost/i);
    });
  }
});
