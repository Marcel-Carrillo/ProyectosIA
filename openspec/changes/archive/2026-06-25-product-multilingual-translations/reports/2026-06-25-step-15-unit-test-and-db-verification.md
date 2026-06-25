# Step 15 — Unit tests and DB verification

**Date:** 2026-06-25  
**Status:** PASS

## Database baseline (15.1)

| Table | Count (pre-backfill) |
|-------|----------------------|
| `Product` | 41 |
| `ProductTranslation` | 0 |

## Backfill (9.3)

`npm run backfill:translations` against Docker Postgres (`localhost:5432`):

- **EN created:** 40
- **ES created:** 0 (LibreTranslate not available — EN seed path verified)

Post-backfill: **40** `ProductTranslation` rows.

## Unit tests

| Suite | Command | Result |
|-------|---------|--------|
| Backend (feature) | `npm test -- --testPathPattern="resolveProductLocale\|productService\|productController\|publicProduct"` | **89/89** |
| Backend (full) | `npm test` with `DATABASE_URL=...@localhost:5432` | **417/417** |
| Frontend (feature) | `npm test -- --watchAll=false --testPathPattern="productService\|CatalogPage\|ProductPage\|ProductFormModal\|adminProductService"` | **18/18** |
| Frontend ESLint | `npx eslint src --ext .ts,.tsx` | **0 errors** |

## Post-test DB state (15.5)

| Table | Count (after all verification) |
|-------|--------------------------------|
| `Product` | 42 |
| `ProductTranslation` | 43 |

Delta from backfill baseline (+2 ES rows for product 46 from curl/E2E; test product 47 deleted). No orphan test products remain.

## Docker notes

- Regenerated Prisma client in backend container: `docker exec -u root ecommerce-backend npx prisma generate`
- Rebuilt frontend image after adding `translations` to `UpdateProductInput`
