# Production Incident Report - Advisory Lock Transaction Wrapping

- Date: 2026-07-09
- Change: cj-catalog-auto-provisioning
- Severity: Blocking (job could not complete a single successful run in production)

## Timeline

1. Deployed to production (PR #86 → develop, PR #87 → master). `SUPPLIER_AUTO_PROVISION_ENABLED` and `CJ_DEFAULT_CATEGORY_ID` SSM parameters created; redeployed for the Lambda to pick them up.
2. First manual invocation (`aws lambda invoke`) failed: `Invalid prisma.supplierIntegration.findFirst() invocation: ... Timed out fetching a new connection from the connection pool ... (Current connection pool timeout: 10, connection limit: 1)`.
   - Root cause: production `DATABASE_URL` has `connection_limit=1`. The adversarial-review fix wrapped the advisory lock's acquire→pipeline→release span in a single `prisma.$transaction(...)` to pin one connection for the lock. With `connection_limit=1`, that one connection was held by the transaction for the entire pipeline duration, so `ensureSupplierProvisioned`'s separate `prisma.supplierIntegration.findFirst()` call (issued via the shared `prisma` singleton, not the transaction's `tx`) had no connection left to acquire from the pool and timed out after 10s.
3. Bumped `DATABASE_URL`'s `connection_limit` from 1 to 5 (both functions read the same shared value), redeployed.
4. Second manual invocation: returned `{skipped:true, skipReason:'LOCKED'}` — a lock from the *first* failed invocation was still held. Inspected `pg_locks`/`pg_stat_activity`: the first invocation's Prisma interactive transaction was `idle in transaction` in Postgres, never committed or rolled back, permanently holding the advisory lock. Manually released via `pg_terminate_backend`.
5. Third manual invocation (after the connection_limit fix and lock cleanup): **also** returned `LOCKED`. Re-inspected `pg_locks`: a **new** `idle in transaction` session, again never closed — confirming this is not a connection-pool-exhaustion symptom but a deterministic property of using `prisma.$transaction(...)` in this Lambda, independent of pool size.
6. Root cause identified: AWS Lambda freezes the execution environment's CPU immediately once the handler's returned promise resolves. Prisma's interactive `$transaction()` callback returned successfully (or threw, caught by the outer handler) and the wrapping `run()` promise resolved — but the underlying COMMIT/ROLLBACK Prisma issues to close the transaction never actually completed on the wire before the Lambda container was frozen, leaving the session `idle in transaction` in Postgres indefinitely (until the container is eventually recycled or the connection manually terminated).
7. Reverted the transaction-wrapping fix: `tryAcquireLock`/`releaseLock` are again two independent `prisma.$queryRaw` calls against the shared `prisma` singleton, with the per-provider try/catch still correctly wrapping lock acquisition (the one genuinely good part of that fix, kept). Manually released the second stuck lock via `pg_terminate_backend` again.
8. Rebuilt, retested (unit suite green), redeployed, re-invoked — succeeded end to end (see below).

## Why unit tests didn't catch this

All new unit tests mock `prisma` entirely (`$transaction`, `$queryRaw`) — they verify the *shape* of the calls (transaction invoked, callback receives a `tx`, `tx.$queryRaw` called twice), not whether a real Postgres session under real Lambda freeze semantics actually completes the transaction. This class of bug — an interactive ORM transaction left open because the *hosting* runtime freezes mid-flight — is invisible to mocked tests and only manifests against a real deployed Lambda + real Postgres. The adversarial review's manual-testing decision (documented in `2026-07-09-adversarial-review.md`) explicitly chose not to re-run the full live-API battery after the fix, reasoning the fix was "surgical" — in hindsight, any change to the lock/transaction mechanism specifically needed live-Lambda verification, since that mechanism's entire purpose only matters under real concurrent/production conditions that mocks cannot represent.

## Resolution Verification (part 1 — transaction revert)

After reverting:
- `cd backend && npx tsc --noEmit` → clean.
- `cd backend && npm run lint` → clean.
- `cd backend && npx jest --watchAll=false` → 82/82 suites, 783/783 tests passed.
- Redeployed to production (PR #88 → develop, PR #89 → master).
- Re-invoked `supplierAutoProvision` — still reported `LOCKED`. This turned out to be a **second, independent** issue (below), not a regression of the transaction fix.

`docs/backend-standards.md`'s "Scheduled Lambda Job Pattern" section was amended in the same commit as the revert to explicitly warn against `prisma.$transaction` spanning a job's full external-API-calling duration, given Lambda's execution-freeze semantics. Any future change to this lock mechanism must include a real `aws lambda invoke` test against a deployed function before being considered verified — mocked unit tests are necessary but not sufficient for this specific mechanism.

## Second incident: EventBridge fired immediately, unbounded sync ran past the Lambda timeout

After the transaction revert, `supplierAutoProvision` kept reporting `LOCKED` on every manual re-invoke. Investigation via `aws logs tail` (not just `pg_locks`) revealed the real cause:

1. **The EventBridge `rate(1 day)` schedule did not wait ~24h to fire** — contrary to what was assumed and communicated to the user. A real invocation (`RequestId 267f1726`) started at `10:12:52`, almost immediately after the rule was first created/enabled by the initial production deploy. (Whether "rate" schedules generally fire immediately on creation, or this was triggered by the CloudFormation stack being touched on each of the several redeploys that followed, was not conclusively determined — but empirically, multiple real invocations occurred within the same ~45-minute window as the deploys, not the next day.)
2. That invocation, and subsequent ones, ran `CjCatalogSyncService.syncCatalog` with **no `CJ_SYNC_MAX_PAGES`/`CJ_CATALOG_PAGE_SIZE` override in production** (never wired into `serverless.yml` before this change) — defaulting to 500 pages × 100 items/page. `syncCatalog` makes **one `fetchVariants` API call per product on every page**, not one call per page, so at CJ's observed ~1 call/sec effective throughput, a single run cannot come close to finishing the default page/size budget. Two separate invocations (`267f1726`, `f3781c70`) each ran for the full 900s and were killed by Lambda's own function timeout (`Status: timeout` in `REPORT` lines) — legitimately holding the advisory lock the entire time, which is exactly why every manual re-invoke during that window correctly reported `LOCKED` (working as designed, not a bug).
3. Immediate mitigation: disabled the EventBridge rule (`aws events disable-rule`) to stop further automatic triggers while investigating. Real CJ API quota consumption during this window was confirmed non-critical (`usedToday` climbed from ~12,800 to ~18,100 against a `remaining: 50000` daily budget).
4. Waited for the in-flight invocation (`5bfd7af3`, started `10:41:58`) to hit its own 900s timeout naturally (`10:56:58`) rather than force-killing it mid-flight. Confirmed via `pg_locks`/`pg_stat_activity` that Lambda's forced termination correctly closed the connection and released the advisory lock — no manual `pg_terminate_backend` was needed this time, confirming the reverted (non-transaction) lock code behaves correctly even under a hard timeout kill, not just a clean return.
5. Added `CJ_SYNC_MAX_PAGES` (default `5`) and `CJ_CATALOG_PAGE_SIZE` (default `20`) to `serverless.yml`'s shared `provider.environment` (SSM-backed, with safe fallbacks), bounding a single sync run to at most 100 products' worth of variant-fetch calls — comfortably within the 900s budget at the observed throughput, while still making incremental daily progress. These are shared with the `app` function's manual "Sync catalog" admin action too (previously also effectively unbounded/untested at scale in production).
6. Redeployed, manually invoked again with the new caps, verified the run completes well within budget, then re-enabled the EventBridge rule.

## Resolution Verification (part 2 — sync bounding)

- `backend/serverless.yml` validated as valid YAML before commit.
- No code changes in this part (config-only) — `npx tsc --noEmit`/`npm run lint` unaffected, already green.
- Manually invoked `supplierAutoProvision` in production after redeploy: completed in well under a minute, no `LOCKED`/timeout, lock confirmed released afterward via `pg_locks`.
- Re-enabled the EventBridge rule (`aws events enable-rule`) only after confirming a bounded run completes reliably.

## Follow-up / Lessons

- Do not assume a newly created EventBridge `rate(...)` schedule's first firing is a full interval away — verify empirically (CloudWatch Logs / `pg_locks`) before assuming a job "hasn't run yet."
- Any job wrapping a paginated external API sync must have its page count **and** page size bounded from the very first production deployment — "default to unbounded, tune later" is not safe when the per-page cost includes N further API calls (one per item), not O(1).
- `docs/development_guide.md`/`docs/aws-infrastructure.md` should document `CJ_SYNC_MAX_PAGES`/`CJ_CATALOG_PAGE_SIZE`'s production defaults and why they're capped (follow-up).
