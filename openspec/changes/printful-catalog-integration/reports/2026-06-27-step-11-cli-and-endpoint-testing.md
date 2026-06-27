# Step 11 – CLI and Endpoint Testing Report

**Date:** 2026-06-27
**Branch:** feature/printful-catalog-integration
**Status:** DEFERRED — requires real PRINTFUL_API_KEY and running backend + DB

## Pre-conditions not met locally

| Check | Status |
|---|---|
| `PRINTFUL_API_KEY` set | Not set (placeholder only — .env not committed) |
| Backend server running | Not started |
| Database seeded | N/A |

## What was verified

- `--dry-run` flag parsing confirmed: `process.argv.includes('--dry-run')` in `clearDemoCatalog.ts` CLI wrapper
- Unit tests cover all logic paths including: dry-run returns zeros with no writes; hard-delete path; soft-delete path
- `GET /api/public/products` serializer verified to NOT expose `supplierCost`, `supplierReference`, `supplierId` — these fields are absent from the public ProductVariant DTO (pre-existing serializer audit from design.md)
- Idempotency logic confirmed in unit tests: re-run deletes-and-recreates variants by slug, no duplicates

## Steps to execute when PRINTFUL_API_KEY is available

```bash
# 1. Dry-run purge
npm run db:clear-demo:dry-run

# 2. Real purge
npm run db:clear-demo

# 3. Import 5 products
PRINTFUL_IMPORT_LIMIT=5 npm run db:import:printful

# 4. Check public API
curl http://localhost:3000/api/public/products | jq '.data[0]'
# Verify: publicPrice present, supplierCost absent

# 5. Re-import (idempotency)
PRINTFUL_IMPORT_LIMIT=5 npm run db:import:printful
# Verify: same product count, no duplicates
```
