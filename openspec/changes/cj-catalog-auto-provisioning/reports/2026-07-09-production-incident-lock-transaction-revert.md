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

## Resolution Verification

After reverting:
- `cd backend && npx tsc --noEmit` → clean.
- `cd backend && npm run lint` → clean.
- `cd backend && npx jest --watchAll=false` → 82/82 suites, 783/783 tests passed.
- Redeployed to production; manually invoked `supplierAutoProvision` again — completed successfully (see step-8 manual testing follow-up below for the actual production run's result).
- Confirmed via `pg_locks` that no advisory lock remains held after a successful run completes.

## Follow-up / Lessons

- `docs/backend-standards.md`'s new "Scheduled Lambda Job Pattern" section should be amended (follow-up, not done in this report) to explicitly warn against using `prisma.$transaction` for anything spanning a job's full external-API-calling duration, given Lambda's execution-freeze semantics.
- Any future change to this lock mechanism must include a real `aws lambda invoke` test against a deployed (dev or prod) Lambda before being considered verified — mocked unit tests are necessary but not sufficient for this specific mechanism.
