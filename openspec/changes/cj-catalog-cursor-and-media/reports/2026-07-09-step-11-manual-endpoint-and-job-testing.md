# Step 11 Report - Manual Endpoint & Job Testing (Local/Dev + Production)

## Local/Dev (tasks 11.1-11.4)

See inline evidence already recorded in `tasks.md` 11.1-11.4:
- Two consecutive `POST .../cj/sync` calls against the real CJ API: cursor advanced `0→1→2` (`catalogSyncTotalPages: 1200`), distinct `pid` count grew 5→10 between runs.
- `POST .../cj/catalog/promote` on a real item with `rawPayload.product.bigImage`: `mainImageUrl` set, 2 `ProductImage` rows (product image `sortOrder:0` + variant image `sortOrder:1`). Re-promotion confirmed idempotent (no duplicate image rows).
- Forced wrap-around test: cursor reset to `0`, `catalogSyncWrappedAt` set.
- Local/dev DB restored to exact pre-test baseline (`SupplierIntegration:0, CjCatalogItem:0, Product:12, ProductVariant:24, ProductImage:25`).

## Production (tasks 11.5-11.7)

### 11.5 - Deploy verification

Deployed via the standard `develop` → `master` release flow across several PRs as issues were found and fixed live (see below). Confirmed the new SSM-backed defaults are live on the deployed Lambda:

```
$ aws lambda get-function-configuration --function-name ecommerce-backend-prod-supplierAutoProvision \
    --query "Environment.Variables.{MaxPages:CJ_SYNC_MAX_PAGES,PageSize:CJ_CATALOG_PAGE_SIZE}"
{
    "MaxPages": "3",
    "PageSize": "100"
}
```

### 11.6 - Backfill script run

Ran `DATABASE_URL=<prod> npx ts-node --transpile-only scripts/backfillCjProductImages.ts` against production. Result: `processed=100 imaged=100 noImageAvailable=0`. Verified via DB query: 285 `ProductImage` rows created, all 100 pre-existing CJ-promoted products' `mainImageUrl` populated.

### 11.7 - Production job invocation and two real production incidents found/fixed along the way

The first two production invocations of `supplierAutoProvision` (after deploying the cursor+media change) surfaced two additional real bugs not caught by the pre-deploy adversarial review, both the same root cause class:

1. **`promote()`'s `prisma.$transaction` timeout** — Prisma's default 5000ms interactive-transaction limit was exceeded promoting a real batch (~300 items). Fixed in `3ba183a` (PR #94/#95), deployed.
2. **`CjCatalogItemRepository.upsertMany()`'s `prisma.$transaction` timeout** — same root cause, surfaced immediately after fix #1 was deployed and re-tested, this time in the sync step for a ~900+ item window. Fixed in `07872d3` (PR #96/#97), deployed. See `reports/2026-07-09-upsertMany-transaction-timeout-fix.md` for full detail.

Both fixes added an explicit `timeout: 120_000` option to their respective `prisma.$transaction` calls — safe because both transactions are pure DB writes with no external API calls inside them (distinct from the reverted advisory-lock transaction in `cj-catalog-auto-provisioning`, which spanned external CJ API calls inside a Lambda that can freeze mid-transaction).

**Final successful production invocation** (after both fixes deployed):

```
$ aws lambda invoke --function-name ecommerce-backend-prod-supplierAutoProvision --cli-read-timeout 900 <output>
{"StatusCode": 200, "ExecutedVersion": "$LATEST"}

$ cat <output>
{"enabled":true,"providers":[{"provider":"CJDropshipping","skipped":false,"provisioned":false,"verifyHealthy":true,"itemsUpserted":3154,"itemsFailed":0,"variantsCreated":3154,"alreadyPromoted":0}]}
```

CloudWatch confirms real duration: `Duration: 421842.71 ms` (~422s) — well within the 900s Lambda timeout (47% of budget), and under the ~540s design.md D2 target.

DB state verification after this run:

| Check | Before this run | After this run |
|---|---|---|
| `catalogSyncCursorPage` | 3 | **12** (advanced, not stuck) |
| `catalogSyncTotalPages` | 60 | 60 (consistent) |
| `CjCatalogItem` count | 1309 | 7109 |
| `Product` count | ~1195 | 1295 |
| CJ-promoted products missing `mainImageUrl` | (100 pre-fix, now backfilled) | **0** (of 1295 total) |

All 5 success criteria from task 11.7 confirmed:
- (a) sync's `upsertMany` no longer times out — confirmed (`itemsFailed:0`, cursor persisted).
- (b) cursor genuinely advances past `3/60` — confirmed (`3 → 12`).
- (c) `promote()` succeeds for the new batch — confirmed (`variantsCreated:3154`, `Product` count grew).
- (d) newly-promoted products have images — confirmed (0 of 1295 CJ-promoted products missing `mainImageUrl`).
- (e) run duration stays well within the 900s Lambda budget — confirmed (~422s, 47% of budget).

No stuck advisory locks or idle-in-transaction sessions found before or after any of these invocations.
