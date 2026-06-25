#!/usr/bin/env node
/**
 * Step 16 curl verification — product multilingual translations
 */
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:3000';
const PRODUCT_ID = 46;
const results = [];

async function req(method, url, { headers = {}, body } = {}) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), json };
}

function log(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}: ${detail}`);
}

async function main() {
  const login = await req('POST', '/api/admin/auth/login', {
    body: { email: 'admin@example.com', password: 'AdminPass1' },
  });
  const token = login.json?.data?.accessToken;
  if (!token) throw new Error('Admin login failed');
  log('16.1', true, `Backend reachable, admin login ${login.status}`);

  const auth = { Authorization: `Bearer ${token}` };

  // Upsert ES for meaningful locale test
  const esName = 'Gafas de Sol de Acetato';
  const esDesc = 'Gafas de sol de acetato italiano con lentes minerales degradados.';
  const upsertEs = await req('PUT', `/api/admin/products/${PRODUCT_ID}/translations/es`, {
    headers: auth,
    body: { name: esName, description: esDesc, source: 'manual' },
  });
  log('16.8-prep', upsertEs.status === 200, `PUT translations/es → ${upsertEs.status}`);

  const listEs = await req('GET', '/api/public/products?page=1&pageSize=5', {
    headers: { 'Accept-Language': 'es' },
  });
  const esItem = listEs.json?.data?.items?.find((p) => p.id === PRODUCT_ID);
  log(
    '16.2',
    listEs.status === 200 && listEs.headers.vary?.includes('Accept-Language') && esItem?.name === esName,
    `GET public list ES → ${listEs.status}, Vary=${listEs.headers.vary}, name=${esItem?.name}`,
  );

  const listEn = await req('GET', '/api/public/products?page=1&pageSize=5', {
    headers: { 'Accept-Language': 'en' },
  });
  const enItem = listEn.json?.data?.items?.find((p) => p.id === PRODUCT_ID);
  log(
    '16.3',
    listEn.status === 200 && enItem?.name === 'Acetate Sunglasses',
    `GET public list EN → name=${enItem?.name}`,
  );

  const detailEs = await req('GET', `/api/public/products/${PRODUCT_ID}`, {
    headers: { 'Accept-Language': 'es' },
  });
  log(
    '16.4',
    detailEs.status === 200 && detailEs.json?.data?.name === esName,
    `GET public detail ES → name=${detailEs.json?.data?.name}`,
  );

  const detailFr = await req('GET', `/api/public/products/${PRODUCT_ID}`, {
    headers: { 'Accept-Language': 'fr' },
  });
  log(
    '16.5',
    detailFr.status === 200 && detailFr.json?.data?.name === 'Acetate Sunglasses',
    `GET public detail fr fallback → name=${detailFr.json?.data?.name}`,
  );

  const adminDetail = await req('GET', `/api/admin/products/${PRODUCT_ID}`, { headers: auth });
  const hasTranslations = Array.isArray(adminDetail.json?.data?.translations);
  log('16.6', adminDetail.status === 200 && hasTranslations, `GET admin product translations array=${hasTranslations}`);

  const listTr = await req('GET', `/api/admin/products/${PRODUCT_ID}/translations`, { headers: auth });
  log(
    '16.7',
    listTr.status === 200 && Array.isArray(listTr.json?.data) && listTr.json.data.length >= 2,
    `GET translations → count=${listTr.json?.data?.length}`,
  );

  log('16.8', upsertEs.status === 200, `PUT translations/es → ${upsertEs.status}`);

  const invalidLocale = await req('PUT', `/api/admin/products/${PRODUCT_ID}/translations/fr`, {
    headers: auth,
    body: { name: 'X' },
  });
  log(
    '16.9',
    invalidLocale.status === 422 && invalidLocale.json?.error?.code === 'TRANSLATION_LOCALE_INVALID',
    `PUT fr → ${invalidLocale.status} code=${invalidLocale.json?.error?.code}`,
  );

  const delEs = await req('DELETE', `/api/admin/products/${PRODUCT_ID}/translations/es`, { headers: auth });
  log('16.10', delEs.status === 204, `DELETE es → ${delEs.status}`);

  const delMissing = await req('DELETE', `/api/admin/products/${PRODUCT_ID}/translations/xx`, { headers: auth });
  log(
    '16.11',
    delMissing.status === 404,
    `DELETE xx → ${delMissing.status} code=${delMissing.json?.error?.code}`,
  );

  // Restore ES row
  await req('PUT', `/api/admin/products/${PRODUCT_ID}/translations/es`, {
    headers: auth,
    body: { name: esName, description: esDesc, source: 'manual' },
  });

  const create = await req('POST', '/api/admin/products', {
    headers: auth,
    body: {
      name: 'Translation Test Product',
      translations: [
        { locale: 'en', name: 'Translation Test Product' },
        { locale: 'es', name: 'Producto de Prueba Traducción' },
      ],
    },
  });
  const createdId = create.json?.data?.id;
  const createdHasTr =
    create.status === 201 &&
    Array.isArray(create.json?.data?.translations) &&
    create.json.data.translations.length >= 2;
  log('16.12', createdHasTr, `POST with translations → ${create.status} id=${createdId}`);

  if (createdId) {
    await req('DELETE', `/api/admin/products/${createdId}`, { headers: auth });
  }

  const pubBody = JSON.stringify(detailEs.json?.data ?? {});
  const noSupplier =
    !pubBody.includes('supplierId') &&
    !pubBody.includes('supplierCost') &&
    !pubBody.includes('supplierReference');
  log('16.13', noSupplier, 'Public response has no supplier fields');

  const reportPath = path.join(__dirname, '2026-06-25-step-16-curl-endpoint-testing.md');
  const md = `# Step 16 — curl endpoint testing

**Date:** 2026-06-25  
**Status:** ${results.every((r) => r.pass) ? 'PASS' : 'PARTIAL'}  
**Product ID used:** ${PRODUCT_ID}

| Step | Result | Detail |
|------|--------|--------|
${results.map((r) => `| ${r.id} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.detail.replace(/\|/g, '\\|')} |`).join('\n')}

All checks executed against \`http://localhost:3000\` with Docker stack running.
`;
  fs.writeFileSync(reportPath, md);
  console.log(`\nReport written: ${reportPath}`);
  if (!results.every((r) => r.pass)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
