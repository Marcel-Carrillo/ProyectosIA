## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide workspace isolation: check current branch, `git status`, and `git worktree list`. If the workspace is clean and no unrelated work is present, use a normal feature branch in the current checkout (no worktree needed); otherwise ask the user before creating a worktree.
- [x] 0.2 Ensure current branch is `develop` and up to date (`git fetch origin && git checkout develop && git pull`) if not already there.
- [x] 0.3 Create and switch to feature branch `feature/spocket-integration` from `develop`.
- [x] 0.4 Verify branch creation with `git branch --show-current` and report clean starting state.

## 1. Database: Prisma Schema for Spocket Connection and Catalog Staging

- [x] 1.1 Add `SupplierIntegration` model to `backend/prisma/schema.prisma`: `id`, `supplierId` (unique FK to `Supplier`), `provider` (default `"Spocket"`), `status` (`Disconnected | Connected | Error`, default `Disconnected`), `externalAccountRef` (optional, max 150), `lastVerifiedAt` (optional), `lastSyncedAt` (optional), `createdAt`, `updatedAt`.
- [x] 1.2 Add `SpocketCatalogItem` model: `id`, `supplierIntegrationId` (FK), `externalRef`, `title`, variant attributes (`size`, `color` optional), `supplierCost` (Decimal, >= 0), `stockQuantity` (Int, >= 0), `rawPayload` (Json), `syncStatus` (`Synced | Failed`), `syncError` (optional), `lastSyncedAt`, `createdAt`, `updatedAt`. Add a unique constraint on `(supplierIntegrationId, externalRef)`.
- [x] 1.3 Add `@@index` on `SupplierIntegration.supplierId`, `SpocketCatalogItem.supplierIntegrationId`, and `SpocketCatalogItem.syncStatus`.
- [x] 1.4 Add `Supplier.spocketIntegration SupplierIntegration?` back-relation.
- [x] 1.5 Run `npx prisma migrate dev --name add_spocket_integration` and verify the migration applies cleanly against the local dev database.
- [x] 1.6 Run `npx prisma generate` and verify the TypeScript client compiles with the new models.

## 2. Domain Layer: Models and Repository Interfaces

- [x] 2.1 Add `backend/src/domain/models/supplierIntegration.ts` (`SupplierIntegration` entity with `status` transition helpers: `markConnected()`, `markError(reason)`).
- [x] 2.2 Add `backend/src/domain/models/spocketCatalogItem.ts` (`SpocketCatalogItem` entity).
- [x] 2.3 Add `backend/src/domain/repositories/supplierIntegrationRepository.ts` interface: `findBySupplierId`, `upsert`, `updateStatus`.
- [x] 2.4 Add `backend/src/domain/repositories/spocketCatalogItemRepository.ts` interface: `upsertMany`, `findBySupplierIntegrationId` (paginated, filterable by `syncStatus`).

## 3. Infrastructure: Spocket API Client Adapter

- [x] 3.1 Add `backend/src/infrastructure/external/spocketTypes.ts` with typed DTOs for the Spocket product/variant/inventory response shape and an `ISpocketClient` port interface (`verifyConnection()`, `fetchCatalog()`).
- [x] 3.2 Add `backend/src/infrastructure/external/spocketClient.ts`: HTTP client reading `SPOCKET_API_KEY` / `SPOCKET_API_BASE_URL` from `process.env`, request timeout, bounded retry with backoff on `429`/`5xx`, and a `SpocketApiError` class that never includes the raw API key in its message.
- [x] 3.3 Add `backend/src/infrastructure/external/__tests__/spocketClient.test.ts` covering: successful verify, auth failure, timeout/retry behavior, and error normalization (mocked HTTP layer, no real network calls). Also fixed `backend/Dockerfile` dev stage, which was missing `COPY jest.config.js jest.setup.js` — without it Jest silently fell back to default babel transform and ALL backend tests failed to run in Docker, not just this change's.
- [x] 3.4 Add `SPOCKET_API_KEY` and `SPOCKET_API_BASE_URL` to `backend/.env.example` with a placeholder value so the module can be imported safely without a real key (mirrors the Stripe `sk_test_placeholder` pattern).

## 4. Infrastructure: Repository Implementations

- [x] 4.1 Implement `backend/src/infrastructure/repositories/supplierIntegrationRepository.ts` using Prisma, satisfying the domain interface.
- [x] 4.2 Implement `backend/src/infrastructure/repositories/spocketCatalogItemRepository.ts` using Prisma `upsert` keyed on `(supplierIntegrationId, externalRef)`, satisfying the domain interface.
- [x] 4.3 Add unit tests for both repository implementations mocking the Prisma client.

## 5. Application Layer: Connection Management Service

- [x] 5.1 Add `backend/src/application/services/spocketConnectionService.ts`: `configureConnection(supplierId, data)`, `getConnection(supplierId)`, `verifyConnection(supplierId)` — depends on `ISupplierIntegrationRepository` and `ISpocketClient` (injected, not imported directly).
- [x] 5.2 Add validation in `backend/src/application/validator.ts` for `externalAccountRef` (optional, max 150 chars).
- [x] 5.3 Add domain errors: `SupplierIntegrationNotFoundError`.
- [x] 5.4 Add `backend/src/application/services/__tests__/spocketConnectionService.test.ts` covering: create connection, update connection, missing supplier, successful verify (status → Connected), failed verify (status → Error, no secret in `reason`), missing connection.

## 6. Application Layer: Catalog Sync Service

- [x] 6.1 Add `backend/src/application/services/spocketCatalogSyncService.ts`: `syncCatalog(supplierId)` — validates connection `status = Connected`, calls `ISpocketClient.fetchCatalog()`, maps DTOs to `SpocketCatalogItem` upserts, handles per-item failures without aborting the batch, updates `lastSyncedAt`, returns `{ itemsUpserted, itemsFailed, syncedAt }`.
- [x] 6.2 Add `listStagedCatalog(supplierId, { page, pageSize, syncStatus })` with pagination clamped to max 100 per page.
- [x] 6.3 Add domain errors: `SpocketConnectionNotReadyError`, `SpocketApiUnavailableError`.
- [x] 6.4 Add `backend/src/application/services/__tests__/spocketCatalogSyncService.test.ts` covering: successful sync, idempotent re-sync (no duplicates), partial item failure reporting, connection not ready (422), total upstream outage (502), pagination and `syncStatus` filter on listing.

## 7. Presentation Layer: Controllers and Routes

- [x] 7.1 Add `backend/src/presentation/controllers/spocketConnectionController.ts` implementing `configure`, `get`, `verify` handlers, mapping domain errors to `404 SPOCKET_CONNECTION_NOT_FOUND` / `404 SUPPLIER_NOT_FOUND` and stripping any secret-shaped field from responses.
- [x] 7.2 Add `backend/src/presentation/controllers/spocketCatalogSyncController.ts` implementing `sync`, `listCatalog` handlers, mapping domain errors to `422 SPOCKET_CONNECTION_NOT_READY` / `502 SPOCKET_API_UNAVAILABLE`.
- [x] 7.3 Add `backend/src/routes/admin/spocketRoutes.ts` wiring `POST /connection`, `GET /connection`, `POST /connection/verify`, `POST /sync`, `GET /catalog` under `/api/admin/suppliers/:supplierId/spocket/*`, behind `requireAdminAuth`.
- [x] 7.4 Register the new router in the admin route index. (Nested via `supplierRouter.use('/:supplierId/spocket', spocketRouter)` in `supplierRoutes.ts` — already mounted under `requireAdminAuth` in `index.ts`, no `index.ts` change needed.)
- [x] 7.5 Add controller unit tests (`__tests__/spocketConnectionController.test.ts`, `__tests__/spocketCatalogSyncController.test.ts`) mocking the service layer completely, verifying status codes and that responses never include credential fields.
- [x] 7.6 Add `backend/src/routes/public/__tests__/spocketIsolation.test.ts` asserting no `/api/public/*` route matching `spocket` exists (mirrors `supplierIsolation.test.ts`).

## 8. Review and Update Existing Unit Tests (MANDATORY)

- [x] 8.1 Review existing `Supplier`-related tests (`supplierService.test.ts`, `supplierController.test.ts`) to confirm the new `spocketIntegration` back-relation does not break existing mocks or serialization allow-lists. Verified: 30/30 tests pass unchanged.
- [x] 8.2 Update any shared test builders/fixtures if `Supplier` test data needs to account for an optional Spocket integration. Not needed — existing tests build `Supplier` domain-model instances directly (not raw Prisma rows), and the domain `Supplier` class has no `spocketIntegration` field to populate.

## 9. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 9.1 Capture pre-test database baseline: row counts for `Supplier`, `SupplierIntegration`, `SpocketCatalogItem`.
- [x] 9.2 Run targeted unit tests: `npm test -- --watchAll=false --testPathPattern=spocket`.
- [x] 9.3 Run the full backend suite: `npm test -- --watchAll=false` and confirm no regressions and the 90% coverage threshold is met for new files. (73 suites / 661 tests passed; `npm run lint` clean.)
- [x] 9.4 Verify post-test database state matches the baseline (unit tests must not touch the real dev database — confirm via mocked Prisma client usage); restore state if any test leaked real writes. (Spocket tables unchanged at 0; unrelated pre-existing `Supplier` fixture leak documented in the report, not caused by this change.)
- [x] 9.5 Create report `openspec/changes/spocket-integration/reports/YYYY-MM-DD-step-9-unit-test-and-db-verification.md` with executed commands, pass/fail counts, and the database baseline comparison.
- [x] 9.6 Mark this step complete only after all tests pass and the report exists.

## 10. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 10.1 Ensure the backend server is running (`docker compose up -d` or existing dev workflow) and note current row counts for `SupplierIntegration`/`SpocketCatalogItem`.
- [x] 10.2 `curl -X POST /api/admin/suppliers/:id/spocket/connection` with a valid `externalAccountRef` — verify `201`/`200` and no credential field in the response.
- [x] 10.3 `curl -X GET /api/admin/suppliers/:id/spocket/connection` — verify `200` with `status`, `lastVerifiedAt`, `lastSyncedAt`.
- [x] 10.4 `curl -X POST /api/admin/suppliers/:id/spocket/connection/verify` against a mocked/sandbox-safe Spocket credential — verify `200` with `{ healthy }` and that `status` updates accordingly. (No real Spocket API reachable in this environment; verified against the placeholder URL, which correctly resolves to `healthy:false` with a safe `reason` and `status=Error` — see report.)
- [x] 10.5 `curl -X POST /api/admin/suppliers/:id/spocket/sync` — verify `200` with `{ itemsUpserted, itemsFailed, syncedAt }`, or `422 SPOCKET_CONNECTION_NOT_READY` if not connected. (422 path verified via curl; the 200 success path is covered by `spocketCatalogSyncService.test.ts` since no real Spocket connection is reachable — documented in the report.)
- [x] 10.6 `curl -X GET /api/admin/suppliers/:id/spocket/catalog?page=1&pageSize=20` — verify paginated envelope and `syncStatus` filter.
- [x] 10.7 Test error cases: non-existent `supplierId` (404), sync on a disconnected supplier (422), non-numeric `supplierId` (400).
- [x] 10.8 Restore database state: delete any `SupplierIntegration`/`SpocketCatalogItem` rows created during testing so counts match the pre-test baseline.
- [x] 10.9 Create report `openspec/changes/spocket-integration/reports/YYYY-MM-DD-step-10-curl-endpoint-testing.md` with all commands, responses, and cleanup actions.

## 11. E2E Testing with Playwright MCP (NOT APPLICABLE)

- [x] 11.1 Confirm this change introduces no frontend UI or customer-facing user workflow (admin endpoints only, no React components in scope) — document this as the reason E2E Playwright testing is not applicable for this change, per `docs/openspec-tasks-mandatory-steps.md` section 3 ("MANDATORY if applicable"). Confirmed: no files under `frontend/` were touched; all changes are backend-only (Prisma schema, domain/application/infrastructure/presentation layers, admin routes). Verified via curl in Step 10 instead.

## 12. Update Technical Documentation (MANDATORY)

- [x] 12.1 Update `docs/data-model.md` with the new `SupplierIntegration` and `SpocketCatalogItem` entities, fields, relationships, and the "internal-only, never exposed on public APIs" note.
- [x] 12.2 Update `docs/api-spec.yml` with the five new admin endpoints (request/response schemas, status codes, error codes), reusing existing shared response components (`BadRequest`, `NotFound`, `UnprocessableEntity`). (This section of `api-spec.yml` follows the neighboring Supplier paths' convention of inline `ErrorResponse` schemas rather than the generic shared `$ref`s — kept consistent with immediate surrounding code. YAML validated to parse and resolve all new `$ref`s.)
- [x] 12.3 Update `docs/development_guide.md` with `SPOCKET_API_KEY` / `SPOCKET_API_BASE_URL` setup instructions for local development.
- [x] 12.4 Update `docs/backend-standards.md` if the Spocket client introduces a new reusable pattern worth documenting (e.g., alongside the Stripe client section), following the same evidence-based update discipline as section 16 of `docs/base-standards.md`. Added "External Supplier API Integration Pattern (Spocket)" section.
- [x] 12.5 Document what was updated and why in the response, per `docs/base-standards.md` section 6 (Mandatory Verification Gate).

## 13. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 13.1 Load and apply `ai-specs/skills/commit/SKILL.md` before executing any Git commands.
- [x] 13.2 Verify all tasks above are marked `[x]` and required reports exist under `openspec/changes/spocket-integration/reports/`.
- [x] 13.3 Stage all relevant files (Prisma schema/migration, domain/application/infrastructure/presentation code, tests, docs, OpenSpec artifacts) — exclude `.env`, `node_modules/`, `dist/`, `coverage/`.
- [x] 13.4 Create commit with Conventional Commit message (e.g., `feat(suppliers): add Spocket connection and read-only catalog sync`), including OpenSpec change name and test verification status. (Commit `5a80ea2`.)
- [x] 13.5 Push branch to remote: `git push -u origin feature/spocket-integration`.
- [x] 13.6 Create Pull Request with `gh pr create --base develop --title "..." --body "..."`, including summary, OpenSpec change name, verification status (unit/curl/E2E-N/A), and open questions from `design.md` as known limitations. (PR #77.)
- [x] 13.7 Report the PR URL in chat. (https://github.com/Marcel-Carrillo/ProyectosIA/pull/77)
