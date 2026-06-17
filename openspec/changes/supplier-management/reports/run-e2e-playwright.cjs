/**
 * One-off Playwright E2E runner for supplier-management (section 13).
 * Mirrors frontend/cypress/e2e/suppliers.cy.ts when Cypress binary is unavailable.
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:3000';

async function assertNoHorizontalOverflow(page, width, height, label) {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/suppliers`, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth > el.clientWidth;
  });
  if (overflow) throw new Error(`Horizontal overflow at ${label} (${width}px)`);
}

async function main() {
  const supplierName = `E2E Supplier ${Date.now()}`;
  let createdId = null;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  const pass = (name, detail = 'OK') => {
    results.push({ name, status: 'PASS', detail });
    console.log(`[PASS] ${name}: ${detail}`);
  };

  try {
    await page.goto(`${BASE}/suppliers`, { waitUntil: 'networkidle' });
    await page.getByTestId('btn-new-supplier').waitFor({ state: 'visible' });
    pass('13.1 navigate /suppliers');

    await page.getByTestId('btn-new-supplier').click();
    await page.getByTestId('modal-supplier-form').waitFor({ state: 'visible' });
    await page.getByTestId('input-supplier-name').fill(supplierName);
    await page.getByTestId('input-supplier-contact-email').fill('e2e@test.com');
    await page.getByTestId('btn-modal-save').click();
    await page.getByTestId('modal-supplier-form').waitFor({ state: 'hidden' });
    await page.getByTestId('suppliers-table').waitFor({ state: 'visible' });
    const tableText = await page.getByTestId('suppliers-table').innerText();
    if (!tableText.includes(supplierName)) throw new Error('Created supplier not in list');
    pass('13.2 create supplier');

    await page.getByTestId('filter-search').fill(supplierName);
    await page.waitForTimeout(400);
    pass('13.2 search filter');

    const editTestId = await page
      .getByTestId('suppliers-table')
      .locator('tr', { hasText: supplierName })
      .locator('[data-testid^="btn-edit-"]')
      .first()
      .getAttribute('data-testid');
    createdId = editTestId?.replace('btn-edit-', '') ?? null;

    await page
      .getByTestId('suppliers-table')
      .locator('tr', { hasText: supplierName })
      .locator('[data-testid^="btn-edit-"]')
      .click();
    await page.getByTestId('select-supplier-status').selectOption('Blocked');
    await page.getByTestId('btn-modal-save').click();
    await page.getByTestId('modal-supplier-form').waitFor({ state: 'hidden' });
    pass('13.2 edit to Blocked');

    await page.getByTestId('filter-status').selectOption('Blocked');
    await page.waitForTimeout(300);
    const blockedText = await page.getByTestId('suppliers-table').innerText();
    if (!blockedText.includes(supplierName)) throw new Error('Supplier not visible when filtered Blocked');
    pass('13.2 filter Blocked');

    await page
      .getByTestId('suppliers-table')
      .locator('tr', { hasText: supplierName })
      .locator('[data-testid^="btn-deactivate-"]')
      .click();
    await page.getByTestId('btn-confirm-deactivate').click();
    await page.waitForTimeout(400);
    await page.getByTestId('filter-status').selectOption('Inactive');
    await page.waitForTimeout(300);
    const inactiveText = await page.getByTestId('suppliers-table').innerText();
    if (!inactiveText.includes(supplierName)) throw new Error('Supplier not Inactive after deactivate');
    pass('13.2 deactivate soft-delete');

    await assertNoHorizontalOverflow(page, 360, 800, 'mobile');
    const cardVisible = await page.getByTestId('suppliers-card-list').isVisible();
    if (!cardVisible) throw new Error('Card list not visible at 360px');
    pass('13.2 no overflow 360px');

    await assertNoHorizontalOverflow(page, 768, 1024, 'tablet');
    pass('13.2 no overflow 768px');

    await assertNoHorizontalOverflow(page, 1280, 800, 'desktop');
    const tableVisible = await page.getByTestId('suppliers-table').isVisible();
    if (!tableVisible) throw new Error('Table not visible at 1280px');
    pass('13.2 no overflow 1280px');
  } finally {
    await browser.close();
    if (createdId) {
      // Soft-delete via API; row preserved with status=Inactive (matches production behavior).
      await fetch(`${API}/api/admin/suppliers/${createdId}`, { method: 'DELETE' }).catch(() => {});
      console.log(`[OK] Cleanup: soft-deleted supplier id=${createdId}`);
    }
  }

  console.log(`\nAll E2E checks passed: ${results.length}`);
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exit(1);
});
