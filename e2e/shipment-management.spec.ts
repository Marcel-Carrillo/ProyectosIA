import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

const API = 'http://localhost:3000';

function getCachedToken(): string {
  const tokenFile = path.resolve('playwright/.auth/token.json');
  return JSON.parse(readFileSync(tokenFile, 'utf8')).accessToken as string;
}

async function apiRequest(
  page: Page,
  method: 'GET' | 'POST',
  url: string,
  data?: unknown
): Promise<Record<string, unknown>> {
  const token = getCachedToken();
  const options: Parameters<typeof page.request.get>[1] = {
    headers: { Authorization: `Bearer ${token}` },
  };
  if (data) (options as Record<string, unknown>).data = data;
  const resp = method === 'GET' ? await page.request.get(url, options) : await page.request.post(url, options);
  return resp.json() as Promise<Record<string, unknown>>;
}

async function getOrCreatePendingShipment(page: Page): Promise<number> {
  const token = getCachedToken();

  const listJson = await page.request.get(`${API}/api/admin/shipments?status=Pending&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json()) as Record<string, unknown>;
  const listData = listJson.data as Record<string, unknown>;
  if ((listData.total as number) > 0) return (listData.items as Array<{ id: number }>)[0].id;

  const ordersJson = await page.request.get(`${API}/api/admin/customer-orders?pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json()) as Record<string, unknown>;
  const orderId = ((ordersJson.data as Record<string, unknown>).items as Array<{ id: number }>)[0].id;

  const createJson = await page.request.post(`${API}/api/admin/shipments`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { customerOrderId: orderId, carrier: 'E2E-Carrier' },
  }).then((r) => r.json()) as Record<string, unknown>;
  return (createJson.data as { id: number }).id;
}

test.beforeEach(async ({ page }) => {
  const token = getCachedToken();
  // Intercept the refresh endpoint so AdminAuthContext authenticates from the cached token
  await page.route('**/api/admin/auth/refresh', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { accessToken: token } }),
    });
  });
  // Intercept /me to return the admin profile without needing a real token
  await page.route('**/api/admin/auth/me', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { admin: { id: 1, email: 'admin@example.com', status: 'Active' } } }),
    });
  });
});

test.describe('Shipment Management E2E', () => {
  test('shipments list page loads with heading and create button', async ({ page }) => {
    await page.goto('/shipments');
    await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('+ New Shipment')).toBeVisible();
  });

  test('status filter select contains expected options', async ({ page }) => {
    await page.goto('/shipments');
    await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('select option').filter({ hasText: 'All Statuses' })).toHaveCount(1);
    await expect(page.locator('select option').filter({ hasText: 'Pending' })).toHaveCount(1);
    await expect(page.locator('select option').filter({ hasText: 'Shipped' })).toHaveCount(1);
  });

  test('create shipment modal opens and has required fields', async ({ page }) => {
    await page.goto('/shipments');
    await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible({ timeout: 10000 });
    await page.click('text=+ New Shipment');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Create Shipment')).toBeVisible();
    // Form.Group without controlId has no ARIA label association — check via text/input count
    await expect(dialog.getByText('Customer Order ID *')).toBeVisible();
    await expect(dialog.getByText('Carrier')).toBeVisible();
    await expect(dialog.getByText('Tracking Number')).toBeVisible();
    await expect(dialog.locator('.form-control')).toHaveCount(5);
  });

  test('create shipment with valid data appears in list', async ({ page }) => {
    const token = getCachedToken();
    const ordersJson = await page.request.get(`${API}/api/admin/customer-orders?pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()) as Record<string, unknown>;
    const orderId = ((ordersJson.data as Record<string, unknown>).items as Array<{ id: number }>)[0].id;

    await page.goto('/shipments');
    await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible({ timeout: 10000 });
    await page.click('text=+ New Shipment');

    const dialog = page.getByRole('dialog');
    // Fill by position since Form.Group has no controlId (no ARIA label association)
    await dialog.locator('.form-control').first().fill(String(orderId));
    await dialog.locator('.form-control').nth(2).fill('PlaywrightCarrier');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText('PlaywrightCarrier').first()).toBeVisible({ timeout: 5000 });
  });

  test('shipment detail page shows fields and transition buttons', async ({ page }) => {
    const shipmentId = await getOrCreatePendingShipment(page);
    await page.goto(`/shipments/${shipmentId}`);
    await expect(page.getByRole('heading', { name: `Shipment #${shipmentId}` })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Shipment Details')).toBeVisible();
    await expect(page.getByText('Status Transitions')).toBeVisible();
    await expect(page.getByText('→ Shipped')).toBeVisible();
  });

  test('status transition Pending → Shipped updates the badge', async ({ page }) => {
    const shipmentId = await getOrCreatePendingShipment(page);
    await page.goto(`/shipments/${shipmentId}`);
    await expect(page.getByText('→ Shipped')).toBeVisible({ timeout: 10000 });
    await page.click('text=→ Shipped');
    await expect(page.locator('.badge').filter({ hasText: 'Shipped' }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('→ InTransit')).toBeVisible({ timeout: 5000 });
  });

  test('terminal state shows no transition buttons', async ({ page }) => {
    const token = getCachedToken();
    const listJson = await page.request.get(`${API}/api/admin/shipments?status=Delivered&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()) as Record<string, unknown>;
    const listData = listJson.data as Record<string, unknown>;
    if ((listData.total as number) === 0) {
      test.skip();
      return;
    }
    const shipmentId = (listData.items as Array<{ id: number }>)[0].id;
    await page.goto(`/shipments/${shipmentId}`);
    await expect(page.getByText(/terminal state/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('→ Shipped')).not.toBeVisible();
  });

  test('← Back button navigates to shipments list', async ({ page }) => {
    const shipmentId = await getOrCreatePendingShipment(page);
    // Visit /shipments first so navigate(-1) has a valid history entry to return to
    await page.goto('/shipments');
    await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible({ timeout: 10000 });
    await page.goto(`/shipments/${shipmentId}`);
    await expect(page.getByText('← Back')).toBeVisible({ timeout: 10000 });
    await page.click('text=← Back');
    await expect(page.getByRole('heading', { name: 'Shipments' })).toBeVisible({ timeout: 5000 });
  });
});
