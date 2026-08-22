import { test, expect } from '@playwright/test';

const preview = process.env.SHOPIFY_THEME_PREVIEW_URL;

test.describe('Mavile Shopify theme', () => {
  test.skip(!preview, 'SHOPIFY_THEME_PREVIEW_URL is not set');

  test('home renders Mavile chrome', async ({ page }) => {
    await page.goto(preview);
    await expect(page.locator('.storefront-header')).toBeVisible();
    await expect(page.locator('.storefront-footer')).toBeVisible();
  });

  test('collection to cart path exists', async ({ page }) => {
    await page.goto(`${preview.replace(/\/$/, '')}/collections/all`);
    const card = page.locator('.storefront-card').first();
    if (await card.count()) {
      await card.click();
      await expect(page.locator('[data-mavile-product]')).toBeVisible();
    }
  });
});
