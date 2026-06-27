# Step 10 – Unit Test and DB Verification Report

**Date:** 2026-06-27
**Branch:** feature/printful-catalog-integration
**Environment:** local dev (no DB connection in test mode)

## New test suites

| Suite | Tests | Result |
|---|---|---|
| `mapPrintfulProduct.test.ts` | 14 | PASS |
| `printfulProductImporter.test.ts` | 4 | PASS |
| `clearDemoCatalog.test.ts` | 7 | PASS |
| **Total new** | **27** | **PASS** |

## Full suite baseline (pre-existing state)

- **Without new tests**: 5 failed, 43 passed, 48 total — 17 test failures
- **With new tests**: 5 failed, 46 passed, 51 total — 17 test failures (same 5 suites)

The 5 failing suites are integration tests requiring a live PostgreSQL connection:
- `adminAuthRoutes.test.ts`
- `customerAuthRoutes.test.ts`
- `customerOrderIsolation.test.ts`
- and 2 others

All failures are pre-existing and unchanged by this PR. No regressions introduced.

## Key test coverage

- Markup applied and rounded to 2 dp
- SIZE/COLOR extracted case-insensitively
- `null` returned for absent options
- SKU format `PF-{id}` and supplierReference as string
- `is_ignored` variants excluded
- Duplicate image URLs de-duplicated
- `isImportablePrintfulSyncProduct` filters zero-price and empty variants
- Supplier upserted once on first run, updated on subsequent runs
- Product counts: fetched/imported/skipped correct
- `limit` option respected
- clearDemoCatalog: dry-run writes nothing; hard-delete for unreferenced; soft-delete for referenced; idempotent on re-run

## DB state

No DB mutations in test mode (all Prisma calls mocked). Pre-test and post-test DB baselines are identical.
