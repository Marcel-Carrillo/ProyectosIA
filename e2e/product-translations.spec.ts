import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const API = 'http://localhost:3000';
const PRODUCT_ID = 46;
const ORIGINAL_ES_NAME = 'Gafas de Sol de Acetato';
const TEMP_ES_NAME = 'Gafas E2E Test';

function getCachedToken(): string {
  const tokenFile = path.resolve('playwright/.auth/token.json');
  return JSON.parse(readFileSync(tokenFile, 'utf8')).accessToken as string;
}

async function adminLogin(page: import('@playwright/test').Page) {
  const res = await page.request.post(`${API}/api/admin/auth/login`, {
    data: {
      email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
      password: process.env.ADMIN_PASSWORD ?? 'AdminPass1',
    },
  });
  expect(res.status()).toBe(200);
  await page.goto('/products');
  await page.waitForURL(/\/products/, { timeout: 30000 });
}

async function switchToLang(page: import('@playwright/test').Page, lang: 'es' | 'en') {
  await page.evaluate(() => {
    document.querySelectorAll('iframe#webpack-dev-server-client-overlay').forEach((el) => el.remove());
  });
  const label = lang === 'es' ? 'Español' : 'English';
  const refetch = page.waitForResponse(
    (resp) => resp.url().includes('/api/public/products') && resp.status() === 200,
    { timeout: 20000 },
  );
  await page.evaluate((l) => {
    const btn = document.querySelector(`button[aria-label="${l}"]`) as HTMLButtonElement | null;
    btn?.click();
  }, label);
  await refetch.catch(() => {});
  await expect(page.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
}

test.describe('Product multilingual translations E2E', () => {
  test('17.2–17.7 storefront language toggle and admin translation edit', async ({ page }) => {
    const token = getCachedToken();

    await page.request.put(`${API}/api/admin/products/${PRODUCT_ID}/translations/es`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: ORIGINAL_ES_NAME, description: 'Descripción ES', source: 'manual' },
    });

    await page.goto('/catalog');
    await page.evaluate(() => localStorage.setItem('mavile.lang', 'en'));
    await page.reload();
    await page.waitForSelector('.storefront-card__name', { timeout: 30000 });
    await expect(page.locator('.storefront-card').filter({ hasText: 'Acetate Sunglasses' })).toBeVisible();

    await switchToLang(page, 'es');
    await expect(page.locator('.storefront-card').filter({ hasText: ORIGINAL_ES_NAME })).toBeVisible({
      timeout: 20000,
    });

    await switchToLang(page, 'en');
    await expect(page.locator('.storefront-card').filter({ hasText: 'Acetate Sunglasses' })).toBeVisible({
      timeout: 20000,
    });

    await page.goto(`/catalog/${PRODUCT_ID}`);
    await expect(page.locator('.storefront-pdp-title')).toHaveText('Acetate Sunglasses', { timeout: 15000 });
    const pdpRefetch = page.waitForResponse(
      (resp) => resp.url().includes(`/api/public/products/${PRODUCT_ID}`) && resp.status() === 200,
      { timeout: 20000 },
    );
    await page.evaluate(() => {
      (document.querySelector('button[aria-label="Español"]') as HTMLButtonElement | null)?.click();
    });
    await pdpRefetch;
    await expect(page.locator('.storefront-pdp-title')).toHaveText(ORIGINAL_ES_NAME, { timeout: 20000 });

    await adminLogin(page);
    await page.goto(`/products/${PRODUCT_ID}`);
    await expect(page.getByTestId('input-name-en')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('input-name-es')).toHaveValue(ORIGINAL_ES_NAME);

    await page.getByTestId('input-name-es').fill(TEMP_ES_NAME);
    await page.getByTestId('btn-save').click();
    await expect(page.getByText('Saved successfully.')).toBeVisible({ timeout: 15000 });

    await page.goto('/catalog');
    await switchToLang(page, 'es');
    await expect(page.locator('.storefront-card').filter({ hasText: TEMP_ES_NAME })).toBeVisible({
      timeout: 20000,
    });

    await page.request.put(`${API}/api/admin/products/${PRODUCT_ID}/translations/es`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: ORIGINAL_ES_NAME, description: 'Descripción ES', source: 'manual' },
    });
  });
});
