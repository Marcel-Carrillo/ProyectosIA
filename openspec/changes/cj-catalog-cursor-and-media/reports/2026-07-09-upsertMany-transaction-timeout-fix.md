# Fix Report - CjCatalogItemRepository.upsertMany() transaction timeout

- Date: 2026-07-09
- Context: post-deploy production verification (tasks.md 11.7) of the cursor+media
  change, run immediately after the sibling fix in
  `3ba183a fix(suppliers): raise promote() transaction timeout past Prisma's 5s default`
  (PR #94/#95) was deployed.

## Symptom

Manually invoking `supplierAutoProvision` in production after deploying the
`promote()` timeout fix took 415s and failed with:

```
Invalid `prisma.cjCatalogItem.upsert()` invocation:
Transaction API error: Transaction not found. Transaction ID is invalid, refers
to an old closed transaction Prisma doesn't have information about anymore, or
was obtained before disconnecting.
```

Production DB state after the failure was unchanged (`catalogSyncCursorPage: 3`,
`CjCatalogItem` count still 1309) — the failure was non-progressing, not
data-corrupting, consistent with this session's established pattern.

## Root Cause

`CjCatalogItemRepository.upsertMany()` (`backend/src/infrastructure/repositories/cjCatalogItemRepository.ts`)
wraps a sequential loop of per-item `tx.cjCatalogItem.upsert(...)` calls inside
one `prisma.$transaction(async (tx) => {...})` with no explicit `timeout`
option — defaulting to Prisma's 5000ms interactive-transaction limit. This is
the exact same bug class just fixed in `promote()`.

This bug pre-dates the current change (the function already existed in
`cj-catalog-auto-provisioning`), but was only triggered now because this
change's throughput fix (`CJ_SYNC_MAX_PAGES` 5→3, `CJ_CATALOG_PAGE_SIZE`
20→100) increases the number of raw items upserted per sync window from ~100
to ~900+, which routinely exceeds 5s of sequential DB writes.

## Fix

Added an explicit `timeout: 120_000` option to `upsertMany`'s
`prisma.$transaction(...)` call, mirroring `cjCatalogPromotionService.ts`'s
`PROMOTE_TRANSACTION_OPTIONS` precedent and its accompanying comment
distinguishing DB-only transactions (safe to extend) from transactions
spanning external API calls inside a Lambda (unsafe — see
`cj-catalog-auto-provisioning`'s incident report on the reverted advisory-lock
transaction).

New regression test:
`should_raise_the_transaction_timeout_above_prismas_5s_default_for_large_batches`
in `cjCatalogItemRepository.test.ts`, mirroring the equivalent test already
added for `promote()`.

## Verification

- `cd backend && npx tsc --noEmit` → clean.
- `cd backend && npm run lint` → clean.
- `cd backend && npx jest --watchAll=false` → 84/84 suites, 833/833 tests passed.

Production re-verification (cursor advancing past 3/60, promote() succeeding
for the resulting batch, images present, duration under budget) pending this
fix's deploy — to be captured as a follow-up report once confirmed.
