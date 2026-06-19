import { chromium, request } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

export default async function globalSetup() {
  const authDir = path.resolve('playwright/.auth');
  mkdirSync(authDir, { recursive: true });

  const tokenPath = path.join(authDir, 'token.json');

  const api = await request.newContext({ baseURL: 'http://localhost:3000' });
  const loginRes = await api.post('/api/admin/auth/login', {
    data: {
      email: process.env.ADMIN_EMAIL ?? 'admin@example.com',
      password: process.env.ADMIN_PASSWORD ?? 'AdminPass1',
    },
  });
  if (loginRes.status() === 429 && existsSync(tokenPath)) {
    await api.dispose();
    return;
  }
  if (loginRes.status() !== 200) {
    throw new Error(`Admin API login failed: ${loginRes.status()} ${await loginRes.text()}`);
  }
  const accessToken = ((await loginRes.json()) as { data: { accessToken: string } }).data.accessToken;
  writeFileSync(tokenPath, JSON.stringify({ accessToken }));
  await api.dispose();

  try {
    const browser = await chromium.launch();
    const context = await browser.newContext({ baseURL: 'http://localhost:3001' });
    const page = await context.newPage();
    await page.goto('/admin/login', { timeout: 60000 });
    await page.fill('#admin-email', process.env.ADMIN_EMAIL ?? 'admin@example.com');
    await page.fill('#admin-password', process.env.ADMIN_PASSWORD ?? 'AdminPass1');
    await page.click('button:has-text("Sign in")');
    await page.waitForURL(/\/products/, { timeout: 60000 });
    await context.storageState({ path: path.join(authDir, 'admin.json') });
    await browser.close();
  } catch {
    writeFileSync(
      path.join(authDir, 'admin.json'),
      JSON.stringify({ cookies: [], origins: [] })
    );
  }
}
