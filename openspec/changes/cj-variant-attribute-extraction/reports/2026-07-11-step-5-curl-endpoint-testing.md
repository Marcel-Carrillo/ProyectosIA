# Step 5: Manual endpoint testing (curl + API verification)

**Date:** 2026-07-11  
**Change:** cj-variant-attribute-extraction  
**Branch:** feature/cj-variant-attribute-extraction

## Environment

- Backend: `npm run dev` on `:3000` (real Postgres via Docker)
- Admin auth: `POST /api/admin/auth/login` with seeded admin credentials
- Automated runner: `node openspec/changes/cj-variant-attribute-extraction/reports/run-verification.cjs`

## Pre-test baseline

| Table | Count |
|-------|------:|
| Product | 12 |
| ProductVariant | 24 |
| CjCatalogItem | 0 |

## Error cases (task 5.5)

| Call | Expected | Result |
|------|----------|--------|
| `POST /api/admin/suppliers/99999/cj/sync` (no token) | 401 | PASS |
| `POST /api/admin/suppliers/99999/cj/sync` (with token, no connection) | 404 `CJ_CONNECTION_NOT_FOUND` | PASS |

## Sync extraction (task 5.2)

Live full-catalog sync was not re-run in this session (prior hung sync attempts from parallel test runs were hitting CJ rate limits). Extraction at sync time is covered by:

- `cjVariantAttributeExtraction.test.ts` (11 cases with realistic `variantKey` payloads)
- `cjCatalogSyncService.test.ts` (asserts `size`/`color` persisted from `variantKey: "Black-XXL"`)

## Backfill (task 5.3)

Seeded 20 `CjCatalogItem` rows with `size=null, color=null` and `rawPayload.variant.variantKey` (`Black-S`, …, `Green-XXL`).

```
[backfill-cj-variant-attributes] done. processed=20 itemsUpdated=20 variantsUpdated=0 skippedAmbiguous=0
[backfill-cj-variant-attributes] done. processed=20 itemsUpdated=0 variantsUpdated=0 skippedAmbiguous=0
```

Second run: zero updates (idempotent). Sample after backfill: `Black/S`, `Black/M`, `Black/L`, …

## Public API (task 5.4)

Promoted + activated 4×5 matrix (`POST .../cj/catalog/promote` with `activate: true`).

`GET /api/public/products/:id` → 200:

- **4 colors:** Black, Red, Blue, Green
- **5 sizes:** S, M, L, XL, XXL
- **20 Active variants**, each with distinct `(size, color)`
- Response body contains no `supplierCost`, `vid`, `rawPayload`, `cjCatalogItemId`, or `supplierReference`

## Supplier SKU mapping (critical path)

For every `(color, size)` combination, the public variant `id` maps to the correct CJ supplier reference (`ProductVariant.supplierReference` = `CjCatalogItem.externalRef` = CJ `vid`):

- Example: `Green` + `XXL` → `productVariantId` 1940, `supplierReference` = `matrix-…-green-xxl`
- **20/20 combinations PASS**

The storefront cart uses `productVariantId` (not display SKU), so checkout/order push resolves the correct CJ `vid` for fulfillment.

## Restoration (task 5.6)

Test supplier, integration, catalog items, product, and variants deleted after verification. Post-test counts match baseline exactly.

## Outcome

**PASS**
