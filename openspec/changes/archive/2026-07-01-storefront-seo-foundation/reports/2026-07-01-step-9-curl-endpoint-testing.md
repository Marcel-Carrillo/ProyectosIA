# Step 9 Report - Manual Endpoint Testing with curl

- Date: 2026-07-01
- Change: storefront-seo-foundation
- Agent: claude-sonnet-5

## Environment

- `docker compose up -d` — backend, db, mailpit, frontend containers running.
- Backend health: `curl http://localhost:3000/health` → `{"status":"ok","db":"up"}`.
- Pre-existing DB state (see step 8 report): 31 `Product` rows with `status='Active'` (one of which, id=1, also has `deletedAt` set — see finding below), 25 `Category` rows with `status='Active'`.

## Commands Executed and Results

### GET /api/public/sitemap.xml

```
curl -s -D - -o /tmp/sitemap.xml http://localhost:3000/api/public/sitemap.xml
```

Response headers:
```
HTTP/1.1 200 OK
Content-Type: application/xml; charset=utf-8
Content-Length: 6566
```

Body: valid XML, `<?xml version="1.0" encoding="UTF-8"?>` + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` root, 66 `<url>` entries total:
- 1 × `/catalog` (no `<lastmod>`)
- 30 × `/catalog/{id}` (each with `<lastmod>`)
- 25 × `/catalog?categoryId={id}` (each with `<lastmod>`)
- 10 × `/pages/{slug}` (no `<lastmod>`, matches all `STATIC_CONTENT_PAGE_SLUGS`)

### Verify no supplier fields

```
grep -iE "supplierId|supplierReference|supplierCost" /tmp/sitemap.xml
```
Result: no matches (as expected — the response contains only `loc`/`lastmod`, never touches supplier data).

### Finding: product count is 30, not 31 — investigated and confirmed correct

The DB has 31 rows with `status='Active'`, but the sitemap (and cross-checked against `GET /api/public/products?pageSize=100`, which also returns `total: 30` and excludes the same product) lists only 30. Root cause: product `id=1` has `deletedAt` set (`2026-06-12 12:43:24.944`) despite its `status` column still reading `Active` — a soft-deleted product whose status was never demoted (pre-existing data state, unrelated to this change). `ProductRepository.findAll` (reused by both the existing public products endpoint and the new sitemap service) correctly filters out soft-deleted rows regardless of `status`. This confirms the sitemap stays consistent with the existing public catalog listing by construction — not a bug in this change.

### Edge case: no active products

Not exercised — the seeded database always has active products (task 9.4 allows documenting this instead of forcing an artificial empty-state test). The code path is still covered by the unit test `should_include_catalog_root_entry_always` in `sitemapService.test.ts`, which asserts correct behavior with an empty items array.

### robots.txt (served by the frontend container after rebuild)

```
curl -s http://localhost:3001/robots.txt
```
Confirmed `Disallow` rules for all private routes and the `Sitemap:` directive pointing at the backend's public sitemap URL.

## Outcome

- Step 9 status: PASS
- Blocking issues: none
