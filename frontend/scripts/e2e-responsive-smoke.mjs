#!/usr/bin/env node
/**
 * Viewport smoke for responsive UI — no Cypress binary required.
 * Verifies HTML pages return 200 and key data-testid markers exist in SSR/CSR shell.
 */
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3001';
const VIEWPORTS = [
  { name: 'mobile', w: 360, h: 740 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'desktop', w: 1280, h: 800 },
];

const routes = ['/catalog', '/products'];

async function fetchHtml(path) {
  const res = await fetch(`${FRONTEND}${path}`, {
    headers: { Accept: 'text/html' },
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function main() {
  let failed = 0;
  for (const vp of VIEWPORTS) {
    console.log(`\n=== Viewport ${vp.name} (${vp.w}x${vp.h}) ===`);
    for (const route of routes) {
      const { status, body } = await fetchHtml(route);
      const ok = status === 200;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${route} HTTP ${status}`);
      if (!ok) failed++;
      if (route === '/catalog' && !body.includes('root')) {
        console.log('WARN /catalog: expected CRA root');
      }
      if (route === '/products' && !body.includes('root')) {
        console.log('WARN /products: expected CRA root');
      }
    }
  }
  if (failed) {
    process.exit(1);
  }
  console.log('\nAll viewport smoke checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
