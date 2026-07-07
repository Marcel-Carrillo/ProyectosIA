# Adversarial Review Report — spocket-integration

- Date: 2026-07-07
- Change: spocket-integration
- Reviewer: independent subagent (fresh context, per `ai-specs/skills/adversarial-review/SKILL.md`)
- Verdict at review time: **FAIL** (1 blocker, 2 majors, 4 minors, 2 nits)

## Findings and Resolutions

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | BLOCKER | The Prisma migration for `SupplierIntegration`/`SpocketCatalogItem` was run inside the Docker container (`/app/prisma` is not bind-mounted — only `backend/src` is), so it was never persisted to the host/git. A later image rebuild (for the Dockerfile fix in step 3.3) recreated the container and lost the migration file entirely, while the already-applied DDL remained in the persisted Postgres volume — real schema drift with no migration file anywhere. | Dropped the two drifted tables, removed the orphaned `_prisma_migrations` history row, re-ran `npx prisma migrate dev --name add_spocket_integration` inside the container, and immediately `docker cp`'d the resulting migration folder to `backend/prisma/migrations/` on the host **before any further container rebuild**. Verified `npx prisma migrate status` reports "Database schema is up to date!" and re-ran the full test suite (74/74 suites, 667/667 tests pass) plus a curl smoke test. |
| 2 | MAJOR | `spocketIsolation.test.ts` built an Express app with **zero routers mounted**, so it would report "isolated" regardless of whether real isolation held — it proved nothing about the actual route tree. | Rewrote the test to mount the real `productPublicRoutes` router at its real path (mirroring `supplierIsolation.test.ts`), added a sanity-check test that the real router still serves its own routes, and kept the Spocket-path 404 assertions against this now-genuine app. |
| 3 | MAJOR | `GET .../spocket/catalog` returned raw `SpocketCatalogItem` domain instances, leaking `supplierIntegrationId` and the full raw upstream `rawPayload` JSON blob — undocumented contract drift beyond what `docs/api-spec.yml` describes, and unreviewed upstream data reaching an HTTP response. | Added `presentation/serializers/spocketCatalogItemSerializer.ts` (explicit allow-list matching the documented schema exactly) and applied it in `spocketCatalogSyncController.listCatalog`. Added a dedicated serializer unit test and a controller regression test asserting `rawPayload`/`supplierIntegrationId` never appear in the response JSON. |
| 4 | MINOR | Two invalid variants lacking `externalRef` under the same product both fell back to the identical key `` `unknown-${product.externalRef}` ``, so the second silently overwrote the first in `upsertMany`, while `itemsFailed` still counted both. | Added a per-sync `failedItemSequence` counter, so each unmappable item without an `externalRef` gets a unique fallback key. |
| 5 | MINOR | The `syncCatalog` pagination loop (`do...while(pageToken)`) had no maximum-iteration guard — a misbehaving upstream returning an endless `nextPageToken` would loop indefinitely inside the synchronous admin request. | Added `MAX_SYNC_PAGES = 500` cap; exceeding it aborts the sync with `SpocketApiUnavailableError` and logs the condition. |
| 6 | MINOR | `verifyConnection()`'s error handling was narrower than `syncCatalog()`'s: an unexpected non-`SpocketApiError` exception (e.g. malformed JSON body) would propagate uncaught to a generic 500, instead of the spec-mandated `200 { healthy: false, reason }`. | Wrapped the `spocketClient.verifyConnection()` call in `spocketConnectionService.verifyConnection` with a try/catch that treats any error the same as an unhealthy result. |
| 7 | MINOR | `SupplierIntegrationRepository.upsert()` did `findUnique` then `create`/`update` — two concurrent requests for a supplier with no existing connection could both observe "not found" and both attempt `create`, tripping the unique constraint unhandled. | Replaced with a single atomic Prisma `upsert()`; `created` is now inferred by comparing `createdAt`/`updatedAt` (equal only on genuine creation). Updated the repository unit tests accordingly. |
| 8 | NIT | A test set `process.env.SPOCKET_API_KEY` at test-run time, but the client captures the env var at module-import time — the assignment had no effect on the assertion, which actually passed for an unrelated reason (fixed error vocabulary). | Renamed/clarified the test to assert what's actually guaranteed: the thrown error message never contains response-body content, regardless of env vars. |
| 9 | NIT | `parseSupplierIdParam` is duplicated verbatim across `spocketConnectionController.ts` and `spocketCatalogSyncController.ts`. | **Not changed** — verified this exact duplication pattern (`parseIdParam`/`parseSupplierIdParam` defined locally per file) is the established convention across 8 other existing controllers (`customerController.ts`, `customerOrderController.ts`, `refundController.ts`, `returnRequestController.ts`, `reviewAdminController.ts`, `shipmentController.ts`, `supplierController.ts`, `supplierOrderController.ts`). Introducing a shared helper here would be an unrequested, inconsistent refactor rather than a fix. |

## Post-fix Verification

- `npm run lint`: 0 errors.
- `npm test -- --watchAll=false`: 74 suites, 667 tests, all pass.
- `npx prisma migrate status`: "Database schema is up to date!" (14 migrations, including the recovered `20260707110100_add_spocket_integration`).
- curl smoke test re-run on `configureConnection` (create → 201 `created:true`, update → 200 `created:false` via the new atomic upsert) and `listCatalog` (serializer applied, empty envelope) — all as expected; test data cleaned up afterward.

## Final Verdict

All blocker and major findings resolved; all minor findings fixed; nits addressed or explicitly justified as out of scope. Safe to proceed to commit and PR.
