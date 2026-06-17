/**
 * E2E flow verification for admin-product-panel (API orchestration + page smoke).
 * Mirrors frontend/cypress/e2e/products.cy.ts when Cypress binary is unavailable.
 */
const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://localhost:3001';

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  const name = `E2E Admin Product ${Date.now()}`;
  const sku = `E2E-SKU-${Date.now()}`;
  let productId;

  // Page smoke
  const page = await fetch(`${WEB}/products`, { headers: { Accept: 'text/html' } });
  if (!page.ok) throw new Error(`/products page HTTP ${page.status}`);
  const html = await page.text();
  if (!html.includes('root')) throw new Error('/products HTML missing React root');

  const create = await api('POST', '/api/admin/products', { name, description: 'E2E flow' });
  if (create.status !== 201) throw new Error(`create failed ${create.status}`);
  productId = create.json.data.id;

  let activate = await api('PATCH', `/api/admin/products/${productId}`, { status: 'Active' });
  if (activate.status !== 422) throw new Error('expected 422 activate without variant');

  const variant = await api('POST', `/api/admin/products/${productId}/variants`, {
    sku,
    publicPrice: 59.99,
    status: 'Active',
    stockPolicy: 'SupplierManaged',
  });
  if (variant.status !== 201) throw new Error('variant create failed');

  activate = await api('PATCH', `/api/admin/products/${productId}`, { status: 'Active' });
  if (activate.status !== 200) throw new Error('activate failed');

  const image = await api('POST', `/api/admin/products/${productId}/images`, {
    url: 'https://i.imgur.com/1twoaDy.jpeg',
    altText: 'E2E image',
    sortOrder: 0,
  });
  if (image.status !== 201) throw new Error('image create failed');

  const list = await api('GET', `/api/admin/products?search=${encodeURIComponent(name)}`);
  if (!list.json?.data?.items?.some((p) => p.id === productId)) {
    throw new Error('product not found in search list');
  }

  const del = await api('DELETE', `/api/admin/products/${productId}`);
  if (del.status !== 200 && del.status !== 204) throw new Error('delete failed');

  console.log(JSON.stringify({ pass: true, productId, name, sku }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
