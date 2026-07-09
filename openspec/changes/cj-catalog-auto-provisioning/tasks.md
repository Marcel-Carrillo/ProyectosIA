## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Applied `ai-specs/skills/using-git-worktrees/SKILL.md`: workspace was clean except the untracked `openspec/changes/cj-catalog-auto-provisioning/` planning artifacts; previous branch `feature/cj-connection-management-ui` had 2 unrelated, already-completed commits not yet merged to `develop` — decided to branch fresh from `develop` rather than continue on that branch. Normal feature branch used, no worktree needed.
- [x] 0.2 Ran `git checkout develop && git pull origin develop` — already up to date with `origin/develop`.
- [x] 0.3 Created and switched to feature branch `feature/cj-catalog-auto-provisioning` from `develop` (`git checkout -b feature/cj-catalog-auto-provisioning`).
- [x] 0.4 Verified with `git branch --show-current` → `feature/cj-catalog-auto-provisioning`; `git status --porcelain` shows only the untracked OpenSpec planning folder, tracked tree clean.

## 1. Configuration: New Environment Variables

- [x] 1.1 Added `CJ_DEFAULT_CATEGORY_ID`/`SUPPLIER_AUTO_PROVISION_ENABLED` to `backend/.env.example` (blank/`false` template defaults) and `backend/.env.docker` (blank/`false`, documented as dev-only, gitignored file).
- [x] 1.2 Created an "Uncategorized" `Category` row in the local dev DB (id `270`, `status: Active`); recorded for use as `CJ_DEFAULT_CATEGORY_ID=270` in local manual job-execution testing (task 8). `backend/.env.example`/`backend/.env.docker` correctly stay blank templates — only the developer's local `backend/.env` gets the real id, set in task 8.
- [x] 1.3 No new error class needed: `CjCatalogPromotionService.promote` already throws `CjPromotionCategoryRequiredError` (`backend/src/application/validator.ts:1144`) both when `categoryId` is undefined and when the category doesn't exist — exactly the "missing or invalid" case. Reused as-is in `providerRegistry.ts`'s `runPipeline` (see group 2).

## 2. Domain/Application: Provider Registry Abstraction

- [x] 2.1 Added `backend/src/application/providers/providerRegistry.ts` defining `SupplierProviderDescriptor` (`key`, `isConfigured()`, `defaultSupplierName`, `runPipeline(supplierId)`) per design.md D7. Also exported `CJ_PLACEHOLDER_API_KEY` from `cjClient.ts` (additive, 2-line change) so `isConfigured()` doesn't duplicate the placeholder literal.
- [x] 2.2 Implemented the CJ descriptor reusing `cjClient`/`CjConnectionService`/`CjCatalogSyncService`/`CjCatalogPromotionService` exactly as wired in `cjCatalogPromotionController.ts`; paginates `listStagedCatalog` (page size 100, capped by `CJ_PROMOTION_LIST_MAX_PAGES`, ordered by `createdAt desc, id asc` for stable pagination) to collect all `NotPromoted`/`Synced` items (deduped via a `Set`) before a `promote(..., activate:false)` call; catches `CjPromotionCategoryRequiredError`/`CjPromotionValidationError` to report a skip reason instead of throwing. **Post-adversarial-review fix**: added `id: 'asc'` as a secondary sort key on the shared `cjCatalogItemRepository.findBySupplierIntegrationId` query (createdAt alone ties within one sync batch — undefined pagination order without it) and defensive dedupe; also added a bounded one-time retry excluding items reported by `CjPromotionValidationError` so one "poison" item (e.g. zero-cost, unresolvable price) can't block the entire remaining batch forever instead of just that item.
- [x] 2.3 Added `backend/src/application/providers/__tests__/providerRegistry.test.ts` (16 cases: isConfigured ×4, descriptor shape ×2, runPipeline ×10, incl. 3 added post-review for the poison-item retry and cross-page dedupe). Verified: `npx jest --watchAll=false --testPathPattern=providerRegistry` → 16/16 passed.

## 3. Application: Auto-Provision Orchestrator Service

- [x] 3.1 Added `backend/src/application/services/supplierAutoProvisionService.ts` implementing the full pipeline (auto-create Supplier/SupplierIntegration if missing → verify → sync → paginated `listStagedCatalog` → promote `activate:false`) via the injected `SupplierProviderDescriptor.runPipeline`.
- [x] 3.2 Implemented via `prisma.supplierIntegration.findFirst({ where: { provider: descriptor.key } })` in `ensureSupplierProvisioned` (direct prisma access, mirroring the existing `CjConnectionService.configureConnection`'s one-off `prisma.supplier.findUnique` precedent — no repository method or schema change added, per D3). **Post-adversarial-review fix**: `SupplierService.create` + `CjConnectionService.configureConnection` are two independent, non-transactional writes — a crash between them would leave an orphaned `Supplier` invisible to the integration check, duplicating the `Supplier` on retry. Added an orphan check (`prisma.supplier.findFirst({ where: { name: descriptor.defaultSupplierName, cjIntegration: null } })`) that reuses that orphan instead of creating a duplicate.
- [x] 3.3 Implemented: each provider's `runForProvider` call is wrapped in its own try/catch inside the `for` loop in `run()`; a thrown error is caught, logged, and recorded as `{error: message}` for that provider only — the loop continues to the next descriptor. **Post-adversarial-review fix**: the try/catch now wraps lock acquisition too (previously it only wrapped the code *after* a successful acquire), so a DB error during the lock check itself is also isolated per-provider instead of propagating out of `run()`'s loop and aborting every remaining provider — unreachable today with a single-descriptor registry, but exactly the failure mode the descriptor seam exists to prevent once a second provider is added.
- [x] 3.4 Implemented `pg_try_advisory_lock(hashtext(key))`/`pg_advisory_unlock(hashtext(key))`, keyed per provider. **Post-adversarial-review fix**: advisory locks are session-scoped in Postgres — the original implementation issued acquire/release as two independent `prisma.$queryRaw` calls with no guarantee they'd share a physical connection under Prisma's pool, so a release could silently no-op. Rewrote `runForProvider` to wrap the whole acquire → pipeline → release span in a single `prisma.$transaction(async (tx) => ..., { timeout: 890_000, maxWait: 10_000 })`, pinning one connection for lock purposes only (the pipeline's real business writes still go through the shared `prisma` singleton, unchanged).
- [x] 3.5 Implemented: `run()` checks `process.env.SUPPLIER_AUTO_PROVISION_ENABLED !== 'true'` first and returns `{enabled:false, providers:[]}` with a log line, before touching the DB.
- [x] 3.6 Implemented: `ProviderRunOutcome` per provider (`provisioned`, `verifyHealthy`, `itemsUpserted`/`itemsFailed`, `variantsCreated`/`alreadyPromoted`, `error`) plus a final `logger.info('Supplier auto-provision run completed', { providers })`.
- [x] 3.7 Added `backend/src/application/services/__tests__/supplierAutoProvisionService.test.ts` (14 cases: kill-switch no-op, not-configured skip, auto-create, orphan-supplier reuse, reuse-no-duplicate, unhealthy verify passthrough, category-missing passthrough, full happy path, second-run idempotency, per-provider isolation ×2 (pipeline failure + lock-acquisition failure), lock-held skip, lock-released-on-throw, lock-acquire-and-release-share-one-transaction). Verified: `npx jest --watchAll=false --testPathPattern=supplierAutoProvisionService` → 14/14 passed.

## 4. Infrastructure: Scheduled Lambda Handler

- [x] 4.1 Added `backend/src/jobs/supplierAutoProvisionHandler.ts`: constructs its own service/repository instances at module load time (mirrors the existing CJ admin controllers' wiring pattern, per design.md D1) and invokes `SupplierAutoProvisionService.run()`, logging and returning the run summary.
- [x] 4.2 Added `backend/src/jobs/__tests__/supplierAutoProvisionHandler.test.ts` (3 cases: dependency wiring, result passthrough, error propagation). Verified: `npx jest --watchAll=false --testPathPattern=supplierAutoProvisionHandler` → 3/3 passed.

## 5. Infrastructure: Serverless Configuration

- [x] 5.1 Added the `supplierAutoProvision` function to `backend/serverless.yml` with an EventBridge `schedule: rate(1 day)` event, `timeout: 900`, no `http` event (D9). Verified valid YAML via `js-yaml` parse.
- [x] 5.2 Added `CJ_DEFAULT_CATEGORY_ID` and `SUPPLIER_AUTO_PROVISION_ENABLED` to `provider.environment`. Deviated slightly from the plan: gave `CJ_DEFAULT_CATEGORY_ID` an empty-string SSM fallback (`${ssm:/ecommerce/prod/CJ_DEFAULT_CATEGORY_ID, ''}`) instead of a hard-required parameter — a missing/invalid value is already handled gracefully at runtime (sync persists, promotion skipped, logged per D4), so making it deploy-blocking would also break the unrelated shared `app` function's deploys (both functions read the same `provider.environment` block), which contradicts the documented graceful-degradation behavior.
- [x] 5.3 Updated `docs/aws-infrastructure.md` (Recursos table + SSM Parameter Store table — done together with task 10.4, same edit) noting the new scheduled function, its IAM-only trigger, and the two new SSM parameters required before enabling it in production.

## 6. Review and Update Existing Unit Tests (MANDATORY)

- [x] 6.1 Ran the full backend suite after groups 1–5: `npx jest --watchAll=false` → 82/82 suites, 777/777 tests passed (required starting Docker Desktop + `docker compose up -d db`, since `customerOrderIsolation.test.ts` and others hit a real local Postgres). `npm run lint` clean; `npx tsc --noEmit` clean. No breakage found — no existing test needed changes.
- [x] 6.2 Confirmed: `cjConnectionService.test.ts`, `cjCatalogSyncService.test.ts`, `cjCatalogPromotionService.test.ts` all pass unmodified — the only production-code edit outside the new files was the additive `CJ_PLACEHOLDER_API_KEY` export in `cjClient.ts`, which changes no existing behavior and required no test updates (confirmed by `cjClient.test.ts` passing unchanged).

## 7. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 7.1 Captured pre-test baseline: `Supplier:16, SupplierIntegration:0, CjCatalogItem:0, Product:12, ProductVariant:24`; "Uncategorized" `Category` id `270` (task 1.2).
- [x] 7.2 Ran targeted unit tests: `providerRegistry` 13/13, `supplierAutoProvisionService` 11/11, `supplierAutoProvisionHandler` 3/3 — all passed.
- [x] 7.3 Ran the full backend suite: 82/82 suites, 777/777 tests passed (~10.4s, with local Postgres up).
- [x] 7.4 Verified post-test DB state unchanged from baseline (all new unit tests are fully mocked, no real DB/HTTP calls) — no restoration needed.
- [x] 7.5 Created report `openspec/changes/cj-catalog-auto-provisioning/reports/2026-07-09-step-7-unit-test-and-db-verification.md`.
- [x] 7.6 All tests passed and the report exists.

## 8. Manual Job Execution Testing Against a Local/Dev Database (MANDATORY - AGENT MUST EXECUTE)

This capability intentionally has no HTTP endpoint (design.md D9 — the job must not be triggerable by unauthenticated HTTP). The equivalent of curl-based endpoint testing here is directly invoking the job against a running local/dev backend and database, since that is the only way to produce runtime evidence per `base-standards.md` §6.

- [x] 8.1 Started Docker Desktop + `docker compose up -d db`; set `CJ_DEFAULT_CATEGORY_ID=270`, `SUPPLIER_AUTO_PROVISION_ENABLED=true`, plus temporary `CJ_SYNC_MAX_PAGES=1`/`CJ_CATALOG_PAGE_SIZE=5` quota caps in `backend/.env`.
- [x] 8.2 Confirmed starting state: `SupplierIntegration` count = 0, no leftover `CJDropshipping` row.
- [x] 8.3 Invoked the job via `npx ts-node --transpile-only scratch-invoke-auto-provision.ts` (temporary, deleted after; `serverless invoke local` doesn't apply — no `serverless-offline` support for `schedule` events). Captured full output/logs.
- [x] 8.4 Verified via `docker exec ecommerce-db psql`: `Supplier` "CJ Dropshipping" (id 54) created, `SupplierIntegration.status = 'Connected'`, 28 `CjCatalogItem` rows, 5 `Product` rows all `status: Draft` with 28 linked `ProductVariant` rows.
- [x] 8.5 Invoked a second time: `provisioned:false`, `variantsCreated:0`, `NO_PROMOTABLE_ITEMS`; DB query confirmed no duplicate `Supplier`/`SupplierIntegration`/`Product`/`ProductVariant`.
- [x] 8.6 Verified kill-switch: `SUPPLIER_AUTO_PROVISION_ENABLED=false` → `{enabled:false, providers:[]}`, no DB-touching log lines.
- [x] 8.7 Verified missing-category case: invalid `CJ_DEFAULT_CATEGORY_ID=999999` + widened sync (`CJ_SYNC_MAX_PAGES=2`, to reach genuinely new unpromoted items) → sync persisted 69 items, promotion skipped (`DEFAULT_CATEGORY_MISSING`), no new `Product`/`ProductVariant` created.
- [x] 8.8 Restored DB state: deleted the 28 test `ProductVariant`, 5 `Product`, 69 `CjCatalogItem`, 1 `SupplierIntegration`, 1 `Supplier` rows; verified counts match the task 7.1 baseline exactly (`16/0/0/12/24`). Restored `backend/.env` (removed temporary overrides). Deleted the temporary invocation script.
- [x] 8.9 Created report `openspec/changes/cj-catalog-auto-provisioning/reports/2026-07-09-step-8-manual-job-execution-testing.md`.

## 9. E2E Testing with Playwright MCP

Not applicable — this change has no frontend or admin-UI component. The admin still uses the existing, unchanged Products page and `activate` action from `cj-catalog-promotion`/`cj-connection-management-ui` to review and publish auto-imported products; no new user-facing workflow is introduced by this change.

## 10. Update Technical Documentation (MANDATORY)

- [x] 10.1 No `docs/data-model.md` changes needed — confirmed no Prisma schema change (design.md D3), no new entities/fields/relationships introduced.
- [x] 10.2 Updated `docs/development_guide.md`: added `CJ_DEFAULT_CATEGORY_ID`/`SUPPLIER_AUTO_PROVISION_ENABLED` to the env var table and `.env` example block, and a new paragraph documenting the scheduled job (24h cadence, auto-create/verify/sync/promote-to-Draft behavior, manual invocation for testing/support, one-time "Uncategorized" category setup requirement).
- [x] 10.3 Added a "Scheduled Lambda Job Pattern (non-HTTP entry point)" section to `docs/backend-standards.md` (after the CJ integration pattern section) generalizing the job/handler/kill-switch/manual-testing conventions for future non-HTTP jobs.
- [x] 10.4 Updated `docs/aws-infrastructure.md` (Spanish, matching this doc's existing language/style): added the `supplierAutoProvision` Lambda to the Recursos table (noting it's IAM/EventBridge-only, no API Gateway route) and the two new SSM parameters with their fallback behavior.
- [x] 10.5 Confirmed: no `docs/api-spec.yml` changes needed — no new endpoint introduced (D9).

## 11. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 11.1 Loaded and applied `ai-specs/skills/commit/SKILL.md` before executing any Git commands.
- [x] 11.2 Verified all tasks above (0–10) are `[x]` (an independent adversarial review pass and its resulting fixes were completed before this step — see `reports/2026-07-09-adversarial-review.md`) and both reports (steps 7 and 8) exist under `reports/`.
- [x] 11.3 Staged all relevant files (code, tests, docs, OpenSpec artifacts, `.claude/doc`/`.claude/sessions` planning artifacts per this repo's own precedent); confirmed via `git show --stat HEAD` no `.env`/`.env.docker` were committed.
- [x] 11.4 Created commit `a4ac20a` with a Conventional Commit message, referencing the OpenSpec change name and full test/review verification status.
- [x] 11.5 Pushed branch to remote: `git push -u origin feature/cj-catalog-auto-provisioning`.
- [x] 11.6 Created Pull Request #86 via `gh pr create --base develop` with summary, OpenSpec change name, verification status, and known limitations.
- [x] 11.7 Reported the PR URL in chat: https://github.com/Marcel-Carrillo/ProyectosIA/pull/86
