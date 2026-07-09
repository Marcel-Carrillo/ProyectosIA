## Context

Two real production defects surfaced immediately after `cj-catalog-auto-provisioning`'s first live run (documented in `openspec/changes/cj-catalog-auto-provisioning/reports/2026-07-09-production-incident-lock-transaction-revert.md`):

1. **No sync cursor.** `CjCatalogSyncService.syncCatalog` (`backend/src/application/services/cjCatalogSyncService.ts:48-177`) always starts its pagination loop at `page = 1`. Combined with the page/size bounds added to keep a single run under Lambda's 900s timeout (`CJ_SYNC_MAX_PAGES`/`CJ_CATALOG_PAGE_SIZE`), every scheduled run re-fetches and re-upserts the exact same first N products forever. The job never reaches the rest of CJ's catalog.
2. **No image/data capture.** `CjProductDto`/`CjVariantDto` (`backend/src/infrastructure/external/cjTypes.ts:32-49`) only type a handful of fields; product/variant image URLs (confirmed present in CJ's real response — `product.bigImage`, `variant.variantImage`, verified via a live `CjCatalogItem.rawPayload` dump in production) are never copied anywhere. `CjCatalogPromotionService.promote()` (`cjCatalogPromotionService.ts:173-225`) creates `Product`/`ProductVariant` rows but never touches `ProductImage` or `Product.mainImageUrl`. Every promoted product — manual or automatic — has no photo.

Both are fixed together because the sync cursor fix changes what `syncCatalog` persists (touches the same file/tests as any throughput tuning), and the image fix touches the same `promote()` transaction that the auto-provision job already calls — doing them separately would mean two round-trips through the same production incident-response cycle.

## Goals / Non-Goals

**Goals:**
- Make `syncCatalog` advance through CJ's real catalog over successive runs instead of repeating the same window, with a documented, evidence-based per-run size that stays safely under Lambda's timeout.
- Capture product and variant image URLs (and other CJ fields the data model already supports) during sync, and materialize them as `ProductImage`/`Product.mainImageUrl` at promotion time — covering both the manual admin promote flow and the automated job (same function).
- Backfill images for the ~100 products already promoted in production before this fix, using already-stored data (no new CJ API calls).

**Non-Goals:**
- Mapping CJ's own category taxonomy onto local `Category` rows (still deferred, per `cj-catalog-auto-provisioning`'s design.md).
- A cursor keyed on CJ product/variant IDs instead of page number (see Decision D1 for why page-based is sufficient here).
- Cross-Lambda or cross-environment rate-limit coordination (the dev/prod shared-CJ-account risk is documented as an operational caveat, not solved by new code in this change).
- Cypress/E2E coverage (no frontend change — the existing admin Products/CJ Catalog pages already render whatever `mainImageUrl`/`ProductImage` data exists).

## Decisions

### D1: Page-number cursor on `SupplierIntegration`, with wrap-around

Add to `SupplierIntegration` (Prisma migration):
```prisma
catalogSyncCursorPage  Int       @default(0)   // last page fully processed; next run starts at cursor+1
catalogSyncTotalPages  Int?                    // last observed totalPages, for wrap-around detection
catalogSyncWrappedAt   DateTime?               // last time the cursor wrapped back to page 1 (observability)
```

`syncCatalog` changes from "loop pages 1..min(totalPages, MAX_SYNC_PAGES)" to "loop a *window* of `CJ_SYNC_MAX_PAGES` pages starting at `cursorPage + 1`":
1. Read `integration.catalogSyncCursorPage` (0 if never synced) → `startPage = cursorPage + 1`.
2. Fetch pages `startPage .. startPage + CJ_SYNC_MAX_PAGES - 1`, stopping early if `page > totalPages` (end of catalog reached mid-window).
3. If the window reached/passed `totalPages`: reset `catalogSyncCursorPage = 0` and set `catalogSyncWrappedAt = now` (next run starts over from page 1 — this is deliberate, not a bug: it periodically refreshes stale price/stock/image data for previously-synced items, since CJ's catalog is not static and there is no delta/webhook feed).
4. Otherwise: persist `catalogSyncCursorPage = lastPageProcessed`.
5. Always persist `catalogSyncTotalPages = totalPages` and `lastSyncedAt` (existing behavior) in the same call.

New repository method: `ISupplierIntegrationRepository.updateCatalogSyncCursor(id, { cursorPage, totalPages, wrappedAt? })`, implemented alongside the existing `updateStatus`/`updateLastSyncedAt` in `SupplierIntegrationRepository`.

**Why page-number, not a CJ product/variant ID cursor:** CJ's `listV2` endpoint is page/size-paginated (`cjClient.ts` — confirmed no `after-id`/cursor-token parameter exists). A page-number cursor maps directly onto the API's own model with no translation layer. **Trade-off accepted:** if CJ inserts or removes products between runs, a page-number cursor can skip or repeat items relative to a hypothetical stable ID-ordered feed. This is mitigated by (a) `syncCatalog`'s upsert being idempotent on `externalRef` — a repeated item is just re-upserted, not duplicated, and (b) the periodic wrap-around, which re-visits every page over time and self-corrects drift. A per-ID cursor would need CJ to expose stable, sequentially-listable IDs with a real cursor parameter, which it does not.

### D2: Throughput study — per-run page/size defaults

**Cost model (verified in code):** `syncCatalog` makes 1 `fetchCatalog` call per page **plus 1 `fetchVariants` call per product on that page** (`cjCatalogSyncService.ts:66,80`) — cost is `O(products)`, not `O(pages)`:
```
calls(P, S) = P + P·S = P·(1 + S)        # P = pages per run, S = page size
products(P, S) = P·S
```
The variant-fetch calls dominate; the catalog-list call is only a ~1/S overhead.

**Empirical anchor (real production run, post-fix):** 100 products (5 pages × 20/page) → 318 variants, **146s wall-clock** against the live CJ API. Calls made ≈ 5 + 100 = 105.
```
t_per_product ≈ 146s / 100 ≈ 1.46 s/product   (end-to-end: network + backoff + DB upsert)
t_per_call    ≈ 146s / 105 ≈ 1.39 s/call      (above the 1.0s AUTH_MIN_INTERVAL_MS floor — reflects real latency + some 429/5xx backoff)
```

**Timeout budget:** Lambda hard cap is 900s. Target ≤ **60%** utilization (**540s**) to leave margin for cold start, network variance, and rate-limit backoff spikes — do not tune to the edge of the hard timeout.
```
products_max ≈ 540s / 1.46s/product ≈ 370 products (aggressive ceiling)
```

**Recommended defaults (defensive, not the ceiling):**
```
CJ_CATALOG_PAGE_SIZE = 100   (CJ's practical max page size; minimizes list-call overhead, advances the cursor in coarse steps)
CJ_SYNC_MAX_PAGES    = 3     → 3 × 100 = 300 products/run
Estimated calls ≈ 3 + 300 = 303 → T ≈ 303 × 1.46s ≈ 442s (~49% of 900s, ~460s margin)
```

**CJ points quota (confirmed not the bottleneck):** ~303 calls × ~10 points/call ≈ 3,030 points/run, against the observed 50,000/day budget → ~6% — time/rate-limit is the real constraint, not quota.

**Catalog coverage:** at 300 products/run × 1 run/day, a catalog of N products is fully covered in `ceil(N/300)` days before the first wrap-around. Both values remain configurable via SSM (`CJ_CATALOG_PAGE_SIZE`, `CJ_SYNC_MAX_PAGES`) without a redeploy, so this can be tuned up later without code changes.

**Caveat (operational, not solved by code):** the ~1 req/s throttle (`AUTH_MIN_INTERVAL_MS`) is in-process per Lambda invocation, not a globally shared limiter. CJ Dropshipping uses the same merchant account for dev and prod (no separation) — a manual dev-side sync running concurrently with the scheduled prod job can double real request pressure against CJ and risk 429s. Document this in `docs/development_guide.md`; no code mitigation is in scope here.

### D3: Derive images from `rawPayload` at promotion time — no new `CjCatalogItem` columns

`CjCatalogItem.rawPayload` already stores `{ product, variant }` verbatim (confirmed live: `rawPayload.product.bigImage`, `rawPayload.variant.variantImage` both present). Rather than adding structured `imageUrl`/`variantImageUrl` columns to `CjCatalogItem` (a second migration, a second place these can drift out of sync with the raw source), `CjCatalogPromotionService.promote()` reads directly from `catalogItem.rawPayload` when building `ProductImage` rows. `rawPayload` is `unknown`-typed on the domain model — a small, local, defensively-typed helper (e.g. `extractCjImages(rawPayload): { productImage?: string; variantImage?: string }`) parses it, tolerating missing/malformed fields (returns `undefined`, never throws).

**Alternative considered:** add `imageUrl`/`variantImageUrl` to `CjCatalogItem` at sync time. Rejected for now — no other part of the system needs to filter/query by image presence yet, and `rawPayload` is the single source of truth already being paid for in storage; deriving at read time avoids a second write path that could disagree with it. Revisit if a future need (e.g. an admin filter "items missing an image") requires querying without loading full `rawPayload`.

Extend `CjProductDto`/`CjVariantDto` (`cjTypes.ts`) with the now-confirmed fields worth typing: `bigImage?: string` (product), `variantImage?: string` (variant) — plus, since the sync loop already has the raw objects in hand, no further typed fields are strictly required for this change (other observed fields like `saleStatus`, `productType`, `variantStandard` have no corresponding column in `Product`/`ProductVariant` and stay in `rawPayload` only, per the "don't add fields nobody uses yet" principle — they remain available for a future change without any migration, since `rawPayload` already retains them raw).

### D4: `ProductImage` creation inside `promote()`'s existing transaction

Inside the existing `prisma.$transaction(async (tx) => {...})` in `promote()` (`cjCatalogPromotionService.ts:173-225`, which already bypasses repositories for `tx.product.create`/`tx.productVariant.create` per this file's established precedent):

- **On `Product` creation** (`productId === null` branch): after `tx.product.create(...)`, derive the product image from the **first** item in the pid group's `rawPayload.product.bigImage`; if present, `tx.product.update({ where: { id: productId }, data: { mainImageUrl } })` and `tx.productImage.create({ data: { productId, url: mainImageUrl, altText: title, sortOrder: 0 } })`.
- **Per `ProductVariant` creation**: derive `rawPayload.variant.variantImage`; if present **and different from the product's main image** (avoid an identical duplicate `ProductImage` row per color that happens to reuse the same photo), `tx.productImage.create({ data: { productId, url: variantImageUrl, altText: variantTitle, sortOrder: nextSortOrder } })` with an incrementing `sortOrder` per new image within the group.
- **Graceful degradation:** if neither image is present, create zero `ProductImage` rows and do not fail the item — mirrors the existing best-effort pattern already used for `parseSizeColor` (missing size/color doesn't fail a sync item either).
- **Idempotency:** re-promoting an already-linked item (the `wasAlreadyPromoted: true` path, which does not enter the `tx.product.create` branch) does not re-run image creation — images are only created in the same code path as `Product`/`ProductVariant` creation, never on the re-promotion no-op path, so no duplicate `ProductImage` rows can be created by re-running `promote()`.
- **Business rule:** only public-safe fields are ever copied (image URL, title). `supplierCost` and all other internal supplier data continue to flow only into `ProductVariant.supplierCost`/`CjCatalogItem`, never into any public-facing field — unchanged from existing behavior, explicitly re-verified for this change.

This automatically covers the automated job too: `providerRegistry.ts`'s `runPipeline` calls this exact same `promote()`.

### D5: One-off backfill for already-promoted products

New script `backend/scripts/backfillCjProductImages.ts` (not a permanent job, not wired into `serverless.yml` — a one-time, manually-invoked maintenance script, consistent with how one-off data fixes are handled elsewhere in this codebase):
1. Query `ProductVariant` rows with `cjCatalogItemId IS NOT NULL` whose parent `Product` has no `ProductImage` yet (or `mainImageUrl IS NULL`).
2. For each, load the linked `CjCatalogItem.rawPayload` (already in the database — **zero CJ API calls**) and extract images using the same `extractCjImages` helper as D4 (extracted into a small shared module, e.g. `backend/src/application/services/cjImageExtraction.ts`, imported by both `promote()` and the backfill script — avoids duplicating the derivation logic).
3. Create `ProductImage`/set `mainImageUrl` exactly as D4 does.
4. Idempotent (safe to re-run — products that already have an image are skipped by the query in step 1) and logs a summary (`processed`, `imaged`, `noImageAvailable`).
5. Invoked manually post-deploy via `npx ts-node --transpile-only backend/scripts/backfillCjProductImages.ts` against the target database (documented in `docs/development_guide.md`), not automatically run by any deploy step.

## Risks / Trade-offs

- **[Risk]** Page-number cursor drift if CJ's catalog is reordered/mutated between runs (see D1). → **Mitigation**: idempotent upsert + periodic wrap-around; accepted as a bounded, self-correcting trade-off rather than building a true stable-ID cursor CJ's API doesn't support.
- **[Risk]** Increasing `CJ_CATALOG_PAGE_SIZE` from 20→100 changes the shape of a single `fetchCatalog` response; if CJ enforces an undocumented lower max page size than 100, `fetchCatalog` would need to handle a smaller-than-requested page gracefully. → **Mitigation**: `syncCatalog` already reads `listPage.totalPages`/`content` from whatever CJ actually returns rather than assuming the requested size was honored exactly; no code change needed, but this should be watched in the first post-deploy run's logs.
- **[Risk]** Dev and prod share one CJ account/rate limit (D2 caveat) — no code-level mitigation in this change. → **Mitigation**: documented operationally; a future change could add cross-environment coordination if it becomes a real problem.
- **[Risk]** Backfill script touches production data directly. → **Mitigation**: read-only against CJ (no API calls), idempotent, scoped to exactly the rows matching D5's query, run manually with logged output before/after counts — same rigor as the manual DB verification steps already used throughout `cj-catalog-auto-provisioning`'s testing.
- **[Risk]** (found during adversarial review, before merge) `updateCatalogSyncCursor` is an unconditional `UPDATE`, not compare-and-swap — two overlapping `syncCatalog` calls for the *same* connection (e.g. an admin's manual "Sync catalog" click racing the scheduled job, which D2's shared-account caveat already acknowledges can happen) both read the same starting cursor and independently compute+overwrite the new cursor/`totalPages`/`wrapped` state; the call that writes last wins, potentially discarding the other's further-advanced cursor or `wrappedAt` stamp. → **Mitigation (accepted, not code-fixed in this change)**: impact is bounded, not data-corrupting — `syncCatalog`'s item upserts are idempotent on `externalRef` regardless of cursor bookkeeping, and the periodic wrap-around self-corrects any lost cursor progress within one full pass of the catalog. A true fix (optimistic concurrency via a conditional `updateMany` keyed on the cursor value read at the start of the run) would change `updateCatalogSyncCursor`'s signature and return type, cascading through existing tests — deferred as a follow-up unless this is observed to cause real repeated-work problems in production (which the existing idempotency already prevents from becoming *duplicated* data, only wasted re-fetching).
- **[Risk]** (found during adversarial review, before merge) `backend/scripts/backfillCjProductImages.ts` reuses the same `Prisma.TransactionClient`-typed helpers (`cjProductImageSync.ts`) as `promote()`, wrapping each candidate in `prisma.$transaction(...)`. This is safe as written — the sibling `cj-catalog-auto-provisioning` incident's root cause was specifically a Lambda execution environment freezing *before* a transaction spanning external API calls could commit; this script runs as a short-lived local/manual `ts-node` process (not inside Lambda) and each transaction only performs DB writes, no external calls. → **Mitigation**: documented explicitly here and in a code comment — if this script (or its `backfillProductImages`/`cjProductImageSync` helpers) is ever wired into a scheduled Lambda job, the transaction-wrapping assumption must be re-validated against a real deployed Lambda first, per the lesson in `cj-catalog-auto-provisioning`'s incident report.

## Migration Plan

1. Add the Prisma migration for `SupplierIntegration.catalogSyncCursorPage`/`catalogSyncTotalPages`/`catalogSyncWrappedAt` (additive, nullable/defaulted — no backfill required, defaults to `0`/`null` for the existing row).
2. Implement cursor logic in `syncCatalog` + repository method; update `serverless.yml`'s `CJ_CATALOG_PAGE_SIZE`/`CJ_SYNC_MAX_PAGES` defaults per D2.
3. Implement `extractCjImages` + wire into `promote()`.
4. Deploy to production (develop → master, same release flow as `cj-catalog-auto-provisioning`).
5. Run the backfill script once against production for the ~100 already-promoted products.
6. Manually invoke `supplierAutoProvision` once post-deploy to confirm: (a) it advances past the previous cursor position (new products appear, not the same 100), (b) newly-promoted products have images, (c) run duration stays comfortably under the 540s target.
7. Rollback: cursor fields are additive-only (safe to leave in place even if reverted); reverting the code change simply restores the always-page-1 behavior (the known, already-documented bug) without any data loss.

## Open Questions

- Should `CJ_CATALOG_PAGE_SIZE`/`CJ_SYNC_MAX_PAGES` eventually be tuned upward once more real-world timing data accumulates across several daily runs (network variance, CJ-side load)? Deferred — the current recommendation already leaves ~50% margin specifically to allow this without urgency.
- Should the wrap-around ever short-circuit (e.g., skip re-syncing pages whose items were all synced within some conservatively supposed to be recent time window) to avoid needless full-catalog re-scans? Deferred as premature optimization until real wrap-around behavior is observed in production over several cycles.
