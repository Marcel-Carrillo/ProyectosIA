# Step 11 – CLI and Endpoint Testing Report

**Date:** 2026-06-27
**Branch:** feature/printful-catalog-integration
**Backend:** http://localhost:3000 (ts-node-dev)
**DB:** PostgreSQL via Docker (ecommerce-db container)

## Pre-conditions

| Check | Status |
|---|---|
| `PRINTFUL_API_KEY` set | Yes (sandbox token) |
| Backend server running | Yes — port 3000 |
| Database running | Yes — Docker ecommerce-db |

## 11.2 — Dry-run purge

```
npm run db:clear-demo:dry-run
```

Output:
```
[clear-demo] DRY RUN result: { wouldHardDelete: 24, wouldSoftDelete: 1 }
{ "hardDeleted": 0, "softDeleted": 0, "skipped": 0 }
```

**Result:** PASS — logged correct counts, zero DB writes.

## 11.3 — Real purge

```
npm run db:clear-demo
```

Output:
```
[clear-demo] result: {"hardDeleted":24,"softDeleted":1,"skipped":0}
```

**Result:** PASS — 24 EscuelaJS products hard-deleted (no FK refs), 1 soft-deleted (referenced by order/wishlist).

## 11.4 — Catalog import (5 products, markup 1.6)

> Note: `GET /sync/products` requires a connected Printful store. This API key does not have a store configured, so the catalog API (`GET /products`) was used instead via `db:import:printful:catalog`. An `importPrintfulCatalogProducts` function was added following the same pattern. SKUs use `PF-CAT-{id}` prefix.

```
PRINTFUL_IMPORT_LIMIT=5 npm run db:import:printful:catalog
```

Output:
```
[printful-catalog] import result: {"fetched":4,"imported":4,"skipped":0}
```

**Result:** PASS — 4 products fetched and imported (catalog only had 4 available for this token).

Products imported:
- `pf-cat-938-luggage-tag` — 1 variant, $13.20 base → $21.12 public
- `pf-cat-924-area-rug` — 6 variants, $24.06–$75.25 base
- `pf-cat-679-unisex-performance-crew-neck-t-shirt-a4-n3142` — 70 variants, $17.29–$23.29 base
- `pf-cat-793-acrylic-ornaments` — 2 variants, $7.65 base → $12.24 public

## 11.5 — GET /api/public/products security check

```
curl http://localhost:3000/api/public/products?limit=4
```

Variant keys returned: `['id', 'sku', 'size', 'color', 'publicPrice', 'compareAtPrice', 'status']`

| Field | Exposed? |
|---|---|
| `supplierCost` | NO — absent |
| `supplierReference` | NO — absent |
| `supplierId` | NO — absent |

`publicPrice` for Acrylic Ornaments: **12.24** = 7.65 × 1.6 ✓

**Result:** PASS

## 11.6 — GET /api/public/products/51 (detail)

```
curl http://localhost:3000/api/public/products/51
```

Product detail response:
- `name`: Acrylic Ornaments
- `slug`: pf-cat-793-acrylic-ornaments
- `mainImageUrl`: present (Printful CDN URL)
- `images`: 2 images
- Supplier fields in product body: `supplierCost` — absent, `supplierReference` — absent, `supplierId` — absent

**Result:** PASS

## 11.7 — Idempotency (re-run import)

Re-ran `db:import:printful:catalog` with same settings:
```
[printful-catalog] import result: {"fetched":4,"imported":4,"skipped":0}
```

Product count after second run: **4** (no duplicates). IDs unchanged.

**Result:** PASS

## 11.8 — DB state

DB left with 4 Printful products + fashion catalog seed (untouched by purge, no EJS- SKUs). Demo EscuelaJS data fully purged.

## Summary

| Test | Result |
|---|---|
| dry-run writes nothing | PASS |
| hard-delete unreferenced | PASS (24 products) |
| soft-delete referenced | PASS (1 product) |
| import fetches real products | PASS (4 products) |
| publicPrice = cost × markup | PASS |
| supplierCost not exposed | PASS |
| supplierReference not exposed | PASS |
| supplierId not exposed | PASS |
| idempotent re-import | PASS (no duplicates) |
