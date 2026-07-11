# Adversarial Review Report - cj-catalog-auto-provisioning

- Date: 2026-07-09
- Reviewer: independent Claude Sonnet 5 subagent (fresh context, no implementation history), per `ai-specs/skills/adversarial-review/SKILL.md`
- Initial verdict: **FAIL** (4 Major, 3 Minor findings)

## Findings and Resolution

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | Major | `collectPromotableCatalogItemIds`'s pagination had no stable secondary sort key — every item from one sync batch shares an identical `createdAt` (single-transaction upsert), so offset pagination across ties was undefined once a supplier had >100 pending items: could skip an item, or collide on the same id across two pages (tripping `ProductVariant.cjCatalogItemId`'s unique constraint and failing the whole `promote()` batch). | Fixed: added `id: 'asc'` as a secondary sort key on the shared `cjCatalogItemRepository.findBySupplierIntegrationId` query (benefits the existing admin catalog UI too), plus a defensive `Set`-based dedupe when collecting ids across pages. New tests: `should_dedupe_ids_collected_across_pages`, plus a repository-level `should_order_by_createdAt_desc_with_an_id_tiebreaker_for_stable_pagination`. |
| 2 | Major | `ensureSupplierProvisioned` performs two independent, non-transactional writes (`SupplierService.create` then `CjConnectionService.configureConnection`) — a crash between them leaves an orphaned `Supplier` invisible to the `SupplierIntegration.findFirst` check, duplicating the `Supplier` on the next run. | Fixed: added an orphan check (`prisma.supplier.findFirst({ where: { name: descriptor.defaultSupplierName, cjIntegration: null } })`) that reuses the orphan instead of creating a duplicate. New test: `should_reuse_an_orphaned_supplier_instead_of_creating_a_duplicate`. |
| 3 | Major | Advisory locks are session-scoped in Postgres; the original `tryAcquireLock`/`releaseLock` issued two independent `prisma.$queryRaw` calls with no guarantee they'd share a physical connection under Prisma's connection pool — a release could silently no-op, defeating the overlap-prevention mechanism entirely. | Fixed: `runForProvider` now wraps the whole acquire → pipeline → release span in a single `prisma.$transaction(async (tx) => ..., { timeout: 890_000, maxWait: 10_000 })`, pinning one connection for lock purposes only. New test: `should_acquire_and_release_the_lock_within_the_same_transaction_callback`. |
| 4 | Major | `CjCatalogPromotionService.promote()` (pre-existing, reused as-is) validates its whole batch atomically — a single unresolvable item (e.g. a zero-cost item, which `syncCatalog` does not reject as `Failed`) fails the entire batch, which without further handling would re-block the *entire* remaining catalog's auto-promotion on every scheduled run, forever. | Fixed: on `CjPromotionValidationError`, retry once excluding exactly the item ids the error reports; bounded to one retry (only attempted if it's guaranteed to make progress) — no infinite-loop risk. New tests: `should_retry_excluding_items_that_failed_validation_and_still_promote_the_rest`, `should_give_up_without_an_infinite_retry_when_every_item_fails_validation`. Added spec scenario "A single item's price cannot be resolved" to `specs/supplier-catalog-auto-provisioning/spec.md`. |
| 5 | Minor | `tryAcquireLock` was called outside the per-provider try/catch — a DB error during lock acquisition itself would propagate uncaught out of `run()`'s loop, aborting every remaining provider (unreachable today with one descriptor, but breaks the moment a second provider is added). | Fixed as part of the transaction-wrapping change in #3 — the try/catch in `runForProvider` now wraps the whole `$transaction(...)` call, covering lock acquisition too. New test: `should_isolate_one_providers_lock_acquisition_failure_from_another`. |
| 6 | Minor | `tasks.md` 5.3 was left unchecked even though the corresponding `docs/aws-infrastructure.md` update was already done (duplicated by 10.4). | Fixed: marked 5.3 `[x]`, cross-referencing 10.4 (same edit). |
| 7 | Minor | `MAX_PROMOTION_LIST_PAGES` cap silently stopped without a warning log, unlike `syncCatalog`'s equivalent `MAX_SYNC_PAGES` cap. | Fixed: added the same warning log on cap-hit in `collectPromotableCatalogItemIds`. |

## Verification After Fixes

- `cd backend && npx tsc --noEmit` → clean.
- `cd backend && npm run lint` → clean.
- `cd backend && npx jest --watchAll=false` → **82/82 suites, 784/784 tests passed** (777 baseline + 7 new/updated test cases across `providerRegistry.test.ts` (+3), `supplierAutoProvisionService.test.ts` (+3), `cjCatalogItemRepository.test.ts` (+1)).
- Database state confirmed unaffected by the fixes: `Supplier: 16, SupplierIntegration: 0, CjCatalogItem: 0` (unit tests only, no real DB/HTTP calls).

## Decision: No repeat live-API testing

The step 8 report already exercised the full pipeline against the real CJ Dropshipping API (auto-create, idempotent re-run, kill-switch, category-missing degradation). The fixes above are surgical corrections to code paths either already covered by that live test (main pipeline flow — unchanged in observable behavior for the tested scale) or newly covered by dedicated, targeted unit tests (orphan-supplier reuse, cross-page dedupe, poison-item retry, lock connection-pinning) that specifically construct the edge-case conditions the live test's real data never happened to produce (batches never crossed the 100-item pagination boundary; no orphaned Supplier existed to reuse; no zero-cost item existed in the synced sample). Given design.md's own documented concern about consuming a shared, rate-limited real API account's quota, a full live re-test was judged to add cost without adding proportional confidence beyond what the new unit tests already demonstrate. This is documented here for transparency rather than silently skipped.

## Final Verdict

**PASS.** All Major findings resolved with code fixes and dedicated test coverage; all Minor findings resolved. Ready to proceed to commit + PR.
