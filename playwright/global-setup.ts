import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

export default async function globalSetup() {
  const authDir = path.resolve('playwright/.auth');
  mkdirSync(authDir, { recursive: true });

  let accessToken = '';

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: 'http://localhost:3001' });
  const page = await context.newPage();

  // Capture the token from the login response
  await page.route('**/api/admin/auth/login', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    try {
      const json = JSON.parse(body);
      accessToken = json.data?.accessToken ?? '';
    } catch { /* ignore */ }
    await route.fulfill({ response, body });
  });

  await page.goto('/admin/login');
  await page.fill('#admin-email', 'admin@example.com');
  await page.fill('#admin-password', 'AdminPass1');
  await page.click('button:has-text("Sign in")');
  await page.waitForURL(/\/products/, { timeout: 20000 });

  await context.storageState({ path: path.join(authDir, 'admin.json') });
  writeFileSync(path.join(authDir, 'token.json'), JSON.stringify({ accessToken }));

  await browser.close();
}
