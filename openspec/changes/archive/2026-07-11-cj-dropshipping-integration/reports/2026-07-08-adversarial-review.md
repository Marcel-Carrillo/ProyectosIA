# Adversarial Review — cj-dropshipping-integration

- Date: 2026-07-08
- Reviewer: independent subagent (fresh context, no prior involvement in this change), per `ai-specs/skills/adversarial-review/SKILL.md`
- Scope: `openspec/changes/cj-dropshipping-integration/` (PR #79, branch `feature/cj-dropshipping-integration`)

## Initial Verdict: FAIL

Three Major findings, two Minor, one Question (unrelated pre-existing test flakiness).

## Findings and Resolution

| Severity | Finding | Resolution |
|----------|---------|------------|
| Major | `cjClient.ts`'s `requestWithRetry` logged the raw upstream `body.message` on every logical failure — contradicts design.md Decision 3's own stated reasoning (`CjApiError` correctly excludes it, but the log line didn't). Live-reproduced: a fixture with `message: 'Bearer super-secret-leak'` landed in stdout via `logger.warn`. | **Fixed.** Removed `message: body.message` from the log call in `cjClient.ts`. Extended `cjClient.test.ts`'s existing leak-prevention regression test to also assert the logged output (spied on `process.stdout.write`) never contains the secret, not just the thrown error. |
| Major | Migration `20260707175653_...` does `DROP TABLE "SpocketCatalogItem"` then `CREATE TABLE "CjCatalogItem"` — a destructive drop, not a real rename. Safe only because the dev table was verified empty at the time; does not generalize to any other environment. | **Documented, not re-migrated** (the migration is already applied; rewriting an applied migration file is unsafe). Added a correction note to `design.md`'s Migration Plan explicitly labeling this as destructive and requiring a zero-row-count check before applying to any other environment. |
| Major | `cjOrderPushService.pushOrder()`'s "already pushed" guard was check-then-act with no DB-level enforcement: two concurrent pushes could both pass the `externalOrderId` check, both create a CJ sandbox order, and the second `updateExternalOrder()` call would silently overwrite the first's `externalOrderId` (unconditional `prisma.supplierOrder.update`). | **Fixed.** `updateExternalOrder` now does a conditional `updateMany({ where: { id, externalOrderId: null } })` and returns `null` when 0 rows matched; the service treats `null` as `CjOrderAlreadyPushedError` and logs the orphaned CJ order id for manual reconciliation instead of silently losing track of it. |
| Minor | `resolveCountryCode(address.country)` was called inside the same `try` block as the actual CJ API call in both `quoteFreight` and `pushOrder` — a malformed/missing `shippingAddressSnapshot` would throw a TypeError there and get mislabeled as `502 CJ_API_UNAVAILABLE`. | **Fixed.** Moved country-code resolution out of both `try` blocks so a local data bug surfaces as an unhandled error, not a mislabeled upstream failure. |
| Minor | `pushOrder()` never checks `SupplierOrder.status` — a `Cancelled` order could still be pushed to CJ in sandbox mode. | **Not fixed** — deferred. Low real-world risk (sandbox-only, admin-triggered); flagged as a follow-up for a future increment rather than blocking this merge. |
| Question | Independent re-run found 698/699 on the full suite (one `checkoutIntegration.test.ts` failure, unrelated to CJ code, tied to shared non-reset dev DB state) — contradicts the report's earlier "699/699" claim, though it passes in isolation. | **Not CJ-scope.** Confirmed unrelated to this change; full-suite pass/fail is order/state-dependent in this test infra. Noted here for visibility, not addressed as part of this change. |

## Re-verification After Fixes

```bash
docker exec ecommerce-backend npm run lint                                          # PASS, 0 errors
docker exec ecommerce-backend npm test -- --watchAll=false --testPathPattern="cjClient|cjOrderPushService|supplierOrderRepository"  # 27/27 pass
docker exec ecommerce-backend npm test -- --watchAll=false                          # 701/701 pass (full suite)
```

Database baseline re-checked after the full suite run: `Supplier=16, SupplierIntegration=0, CjCatalogItem=0, SupplierOrder=9` — unchanged from the corrected baseline (2026-07-08 correction in the Step 10/11 reports).

## Final Verdict

**PASS WITH GAPS** — all Blockers/Majors resolved; the one deferred Minor (status guard on push) and the pre-existing unrelated test-flakiness Question are documented, not fixed, and don't block merge.

Archiving/merging advisable: **Yes**.
