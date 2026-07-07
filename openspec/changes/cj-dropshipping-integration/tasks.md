## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide workspace isolation: check current branch, `git status`, and `git worktree list`. If the workspace is clean and no unrelated work is present, use a normal feature branch in the current checkout (no worktree needed); otherwise ask the user before creating a worktree.
- [x] 0.2 Ensure current branch is `develop` and up to date (`git fetch origin && git checkout develop && git pull`) if not already there.
- [x] 0.3 Create and switch to feature branch `feature/cj-dropshipping-integration` from `develop`.
- [x] 0.4 Verify branch creation with `git branch --show-current` and report clean starting state.

## 1. Prisma Schema: Rename to CJ Dropshipping, Add SupplierOrder External-Order Fields

- [x] 1.1 Rename Prisma model `SpocketCatalogItem` → `CjCatalogItem`; add CJ-specific fields: `pid String?`, `vid String?` (mirrors `externalRef`, kept for clarity — `externalRef` remains the unique key), `sku String? @db.VarChar(100)`, `categoryId String? @db.VarChar(100)`, `sellPrice Decimal? @db.Decimal(10,2)`, `warehouseInventoryNum Int?`. Keep `rawPayload Json`, `syncStatus`, `syncError`, `lastSyncedAt`, and the unique `(supplierIntegrationId, externalRef)`.
- [x] 1.2 Change `SupplierIntegration.provider` default from `"Spocket"` to `"CJDropshipping"`.
- [x] 1.3 Add external-order tracking fields to `SupplierOrder`: `externalProvider String? @db.VarChar(50)`, `externalOrderId String? @unique @db.VarChar(150)`, `externalOrderStatus String? @db.VarChar(50)`, `externalTrackingNumber String? @db.VarChar(100)`, `externalTrackingProvider String? @db.VarChar(100)`, `sandbox Boolean @default(true)`, `pushedAt DateTime?`, `lastStatusSyncedAt DateTime?`.
- [x] 1.4 Update the `Supplier.spocketIntegration SupplierIntegration?` back-relation name if renamed for clarity (e.g. `cjIntegration` — optional, low-risk rename since it's a Prisma-only relation name).
- [x] 1.5 Run migration (via `migrate diff` + manual migration file + `migrate deploy`, since `migrate dev` requires an interactive TTY not available in this non-interactive session — confirmed placeholder tables were empty first). Migration file written directly to the host `backend/prisma/migrations/` and copied into the container, applying cleanly (`prisma migrate status` confirms "Database schema is up to date!").
- [x] 1.6 Ran `npx prisma generate` on both the container and the host; verified `prisma.cjCatalogItem` and the new `SupplierOrder` fields are queryable.

## 2. Domain Layer: Rename Models, Extend SupplierOrder

- [x] 2.1 Rename `backend/src/domain/models/spocketCatalogItem.ts` → `cjCatalogItem.ts` (`SpocketCatalogItem` class → `CjCatalogItem`), adding the new CJ-specific fields.
- [x] 2.2 Update `backend/src/domain/models/supplierIntegration.ts` if the default provider string appears there (constructor default), changing `'Spocket'` → `'CJDropshipping'`.
- [x] 2.3 Extend `backend/src/domain/models/supplierOrder.ts` with the new external-order fields (`externalProvider`, `externalOrderId`, `externalOrderStatus`, `externalTrackingNumber`, `externalTrackingProvider`, `sandbox`, `pushedAt`, `lastStatusSyncedAt`), defaulting `sandbox` to `true`.

## 3. Domain Repositories: Rename Interfaces, Extend SupplierOrder Repository

- [x] 3.1 Rename `backend/src/domain/repositories/spocketCatalogItemRepository.ts` → `cjCatalogItemRepository.ts` (interface `ISpocketCatalogItemRepository` → `ICjCatalogItemRepository`, `SpocketCatalogItemUpsertInput` → `CjCatalogItemUpsertInput`, etc.). Also added a new `findByExternalRef` method needed by the order-push service (identified during planning, not explicit in the original task text).
- [x] 3.2 Rename `backend/src/domain/repositories/supplierIntegrationRepository.ts` types/interface names if they reference "Spocket" (they currently do not — verify and leave as-is if already provider-neutral). Verified via grep: zero matches.
- [x] 3.3 Extend `backend/src/domain/repositories/supplierOrderRepository.ts`'s `ISupplierOrderRepository` with methods: `findByExternalOrderId(externalOrderId: string)`, `updateExternalOrder(id, data: { externalProvider, externalOrderId, sandbox, pushedAt })`, `updateExternalOrderStatus(id, data: { externalOrderStatus, externalTrackingNumber, externalTrackingProvider, lastStatusSyncedAt })`.

## 4. Infrastructure: Real CJ Dropshipping API Client

- [x] 4.1 Rename `backend/src/infrastructure/external/spocketTypes.ts` → `cjTypes.ts`. Replace the placeholder DTOs with real CJ shapes, field names locked down against a fresh live API call (`nameEn` not `productNameEn`; envelope has both `result` and `success`, always equal — used `success`; variant stock via `inventoryNum`). Defined `ICjClient` port with all required methods.
- [x] 4.2 Rename `backend/src/infrastructure/external/spocketClient.ts` → `cjClient.ts`. Implemented the real contract: token cache/refresh keyed off `accessTokenExpiryDate`, body-based (`success`) success evaluation, `CJ-Access-Token` header, `pointsInfo` logging, `CjApiError` with fixed vocabulary only.
- [x] 4.3 Rename `backend/src/infrastructure/external/__tests__/spocketClient.test.ts` → `cjClient.test.ts`. Note: discovered and fixed a real test-isolation bug — the client's module-level token cache persists across tests in the same file since `jest.clearAllMocks()` doesn't reset module state; fixed via `jest.resetModules()` + dynamic `await import()` per test. 11/11 tests pass.
- [x] 4.4 Updated `backend/.env.example`: removed `SPOCKET_API_KEY`/`SPOCKET_API_BASE_URL`; added `CJDROPSHIPPING_API_KEY`, `CJ_API_BASE_URL`, `CJ_SANDBOX_ORDERS=true` (and the SSM comment block). Did not touch `backend/.env` (already has the real key).

## 5. Infrastructure: Repository Implementations

- [x] 5.1 Rename `backend/src/infrastructure/repositories/spocketCatalogItemRepository.ts` → `cjCatalogItemRepository.ts`, updating field mappings for the new CJ-specific columns. Added `findByExternalRef`.
- [x] 5.2 Update `backend/src/infrastructure/repositories/supplierIntegrationRepository.ts`'s default `provider` value to `'CJDropshipping'` where it creates a new row. Also updated `SupplierIntegrationNotFoundError`'s code/message to `CJ_CONNECTION_NOT_FOUND`.
- [x] 5.3 Extend `backend/src/infrastructure/repositories/supplierOrderRepository.ts` with `findByExternalOrderId`, `updateExternalOrder`, `updateExternalOrderStatus` implementations.
- [x] 5.4 Rename/update repository unit tests accordingly (`cjCatalogItemRepository.test.ts`, `supplierIntegrationRepository.test.ts`, and new `supplierOrderRepository.externalOrder.test.ts`). 16/16 tests pass, lint clean.

## 6. Application: Connection and Catalog Sync Services (Renamed + Real Behavior)

- [x] 6.1 Rename `backend/src/application/services/spocketConnectionService.ts` → `cjConnectionService.ts` (`SpocketConnectionService` → `CjConnectionService`). `verifyConnection()` now calls the real `ICjClient.verifyConnection()` (auth + `/setting/get`), evaluating success via the body.
- [x] 6.2 Rename `backend/src/application/services/spocketCatalogSyncService.ts` → `cjCatalogSyncService.ts` (`SpocketCatalogSyncService` → `CjCatalogSyncService`). Switched from `nextPageToken` cursor to CJ's real page-number pagination (bounded by `totalPages` + the existing `MAX_SYNC_PAGES` cap). Added a per-product `fetchVariants` call with its own failure isolation (a product whose variant lookup fails is marked `Failed` without aborting the sync — not explicit in the original task text, added per the planning agent's flag). Best-effort `size`/`color` parsing from CJ's `variantProperty` JSON.
- [x] 6.3 Rename and rewrite `backend/src/application/services/__tests__/spocketConnectionService.test.ts` → `cjConnectionService.test.ts` and `spocketCatalogSyncService.test.ts` → `cjCatalogSyncService.test.ts`. 8+10 tests pass, lint clean.

## 7. Application: New Supplier-Order Push Service (Sandbox-Only)

- [x] 7.1 Add `backend/src/application/services/cjOrderPushService.ts`: `quoteFreight`, `pushOrder` (forces sandbox server-side, no `isSandbox` param in the method signature at all), `getOrderStatus`. Also resolved the shipping-address gap flagged during planning: address comes from `CustomerOrder.shippingAddressSnapshot` (a `Json` snapshot of `CustomerAddress` fields, confirmed via `docs/api-spec.yml`'s `AddressSnapshot` schema) via `SupplierOrder.customerOrderId`, with a small best-effort country-name→ISO-code map for the common EU markets (falls through to the raw value otherwise, letting CJ's real API reject an invalid code rather than silently guessing wrong).
- [x] 7.2 Add domain errors in `backend/src/application/validator.ts`: `CjItemNotMappedError` (422), `CjOrderAlreadyPushedError` (409), `CjOrderNotPushedError` (422), `CjConnectionNotReadyError` (422), `CjApiUnavailableError` (502), plus `validateCjOrderPushData` which structurally rejects any `isSandbox` field in the request body.
- [x] 7.3 Add `backend/src/application/services/__tests__/cjOrderPushService.test.ts`. 10/10 tests pass, lint clean.

## 8. Presentation: Rename Connection/Catalog Endpoints, Add Order-Push Endpoints

- [x] 8.1 Rename `backend/src/presentation/controllers/spocketConnectionController.ts` → `cjConnectionController.ts` and `spocketCatalogSyncController.ts` → `cjCatalogSyncController.ts`, updating error-code mappings and the serializer import (rename `spocketCatalogItemSerializer.ts` → `cjCatalogItemSerializer.ts`, updating the allow-list for the new CJ-specific fields — still excluding `rawPayload`/internal ids; added `sku` per the spec's documented field list).
- [x] 8.2 Add `backend/src/presentation/controllers/cjOrderPushController.ts`: `freightQuote`, `push`, `getOrderStatus` handlers wired to `CjOrderPushService`. Reads `req.params['id']` (not `:supplierOrderId`) since the parent `supplierOrderRoutes.ts` router uses `:id` as its param name — confirmed by reading the actual file before wiring the mount.
- [x] 8.3 Rename `backend/src/routes/admin/spocketRoutes.ts` → `cjRoutes.ts`, mounted as `supplierRouter.use('/:supplierId/cj', cjRouter)` in `supplierRoutes.ts`. Retained the existing rate limiter on the verify endpoint.
- [x] 8.4 Add `backend/src/routes/admin/supplierOrderCjRoutes.ts` with `POST /freight-quote`, `POST /push`, `GET /order`, mounted as `supplierOrderRouter.use('/:id/cj', supplierOrderCjRouter)` (param name matches the parent router's actual `:id` convention, not the spec's literal `:supplierOrderId` wording).
- [x] 8.5 Updated `backend/src/middleware/errorHandler.ts` with the renamed CJ error mappings plus `CjItemNotMappedError` (422), `CjOrderAlreadyPushedError` (409), `CjOrderNotPushedError` (422).
- [x] 8.6 Renamed/rewrote controller tests, added `cjOrderPushController.test.ts` and `cjIsolation.test.ts` (renamed from `spocketIsolation.test.ts`, extended with the new order-push route paths). 33/34 passed on first run — one test's own expectation was wrong (asserted a caller-supplied `isSandbox` field would be silently stripped, when the validator correctly rejects the whole request instead); fixed the test, not the code. 34/34 pass, lint clean.
- [x] 8.7 Rename `backend/src/routes/public/__tests__/spocketIsolation.test.ts` → `cjIsolation.test.ts`, updating candidate paths to `/cj/` variants (connection, catalog, and the new supplier-order push/order paths), keeping the "mount a real public router" pattern from the prior increment. Verified: `npm test -- --watchAll=false --testPathPattern=cjIsolation` → 11/11 pass.

## 9. Review and Update Existing Unit Tests (MANDATORY)

- [x] 9.1 Review `supplierOrderService.test.ts` / `supplierOrderController.test.ts` / `supplierOrderRepository` tests to confirm the new external-order fields on `SupplierOrder` do not break existing mocks or serialization allow-lists for the existing internal fulfillment endpoints.
- [x] 9.2 Update any shared `SupplierOrder` test builders/fixtures only if required by the new fields (existing tests build domain-model instances directly, so this is likely a no-op — verify by running the existing suite, do not assume).

## 10. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 10.1 Capture pre-test database baseline: row counts for `Supplier`, `SupplierIntegration`, `CjCatalogItem`, `SupplierOrder`.
- [x] 10.2 Run targeted unit tests: `npm test -- --watchAll=false --testPathPattern=cj`.
- [x] 10.3 Run the full backend suite: `npm test -- --watchAll=false` and confirm no regressions; run `npm run lint`.
- [x] 10.4 Verify post-test database state matches the baseline (all unit tests mock Prisma); restore state if any test leaked real writes; document any pre-existing unrelated leak separately (do not attribute it to this change without verifying).
- [x] 10.5 Create report `openspec/changes/cj-dropshipping-integration/reports/YYYY-MM-DD-step-10-unit-test-and-db-verification.md` with executed commands, pass/fail counts, and the database baseline comparison.
- [x] 10.6 Mark this step complete only after all tests pass and the report exists.

## 11. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 11.1 Ensure the backend server is running with `CJDROPSHIPPING_API_KEY` set to the real key already present in `backend/.env`/`.env.docker`, and `CJ_SANDBOX_ORDERS=true`.
- [x] 11.2 `curl -X POST /api/admin/suppliers/:id/cj/connection` — verify `201`/`200`, no credential field in the response.
- [x] 11.3 `curl -X POST /api/admin/suppliers/:id/cj/connection/verify` against the **real** CJ Dropshipping API — verify `200` with `{ healthy: true }` (this should succeed for real, unlike the placeholder Spocket test, since the API key is valid) and that `status` becomes `Connected`.
- [x] 11.4 `curl -X POST /api/admin/suppliers/:id/cj/sync` — verify `200` with a real `{ itemsUpserted, itemsFailed, syncedAt }` against the live CJ catalog; `curl -X GET /api/admin/suppliers/:id/cj/catalog` — verify real staged items are listed.
- [x] 11.5 Create a test `SupplierOrder` (or reuse an existing test fixture flow) with items mapped to staged CJ variants; `curl -X POST /api/admin/supplier-orders/:id/cj/freight-quote` — verify `200` with real logistics options (expect ~4-8 day options, per the manual research already performed).
- [x] 11.6 `curl -X POST /api/admin/supplier-orders/:id/cj/push` — verify `201`, that `externalOrderId` is populated, and that **no real balance was deducted and no real shipment was created** (confirm via CJ's own order list showing `isSandbox` on the created order, if visible, or via the account balance being unchanged). Then `curl` the same push again — verify `409 CJ_ORDER_ALREADY_PUSHED`.
- [x] 11.7 `curl -X GET /api/admin/supplier-orders/:id/cj/order` — verify `200` with status/tracking fields persisted.
- [x] 11.8 Test error cases: non-existent supplier/supplier-order (404), sync/push on a disconnected connection (422), freight quote with an unmapped item (422), invalid `isSandbox` injection attempt in the push body (verify it has no effect).
- [x] 11.9 Restore database state: delete any test `Supplier`/`SupplierIntegration`/`CjCatalogItem`/`SupplierOrder` rows created during testing so counts match the pre-test baseline.
- [x] 11.10 Create report `openspec/changes/cj-dropshipping-integration/reports/YYYY-MM-DD-step-11-curl-endpoint-testing.md` with all commands, responses, and cleanup actions. Explicitly note the real CJ Dropshipping responses observed (auth success, catalog items returned, freight days/cost, sandbox order id) as evidence this is a real, working integration, not a placeholder.

## 12. E2E Testing with Playwright MCP (NOT APPLICABLE)

- [x] 12.1 Confirm this change introduces no frontend UI or customer-facing user workflow (admin endpoints only, no React components in scope) — document this as the reason E2E Playwright testing is not applicable, per `docs/openspec-tasks-mandatory-steps.md` section 3. Verified via curl in Step 11 instead.

## 13. Update Technical Documentation (MANDATORY)

- [x] 13.1 Update `docs/data-model.md`: rename the `SupplierIntegration`/`SpocketCatalogItem` sections' provider references to CJ Dropshipping, rename `SpocketCatalogItem` → `CjCatalogItem` with its new fields, and add the new `SupplierOrder` external-order fields with an "internal-only, never exposed on public APIs" note.
- [x] 13.2 Update `docs/api-spec.yml`: rename the five connection/catalog endpoints' paths from `/spocket/` to `/cj/`, add the three new supplier-order push endpoints and their schemas, remove the old `Spocket*` schema names in favor of `Cj*` equivalents.
- [x] 13.3 Update `docs/development_guide.md`: replace the `SPOCKET_API_KEY`/`SPOCKET_API_BASE_URL` section with `CJDROPSHIPPING_API_KEY`/`CJ_API_BASE_URL`/`CJ_SANDBOX_ORDERS` setup instructions, noting that sandbox mode is forced in this increment.
- [x] 13.4 Update `docs/backend-standards.md`'s "External Supplier API Integration Pattern" section to reflect the real CJ Dropshipping contract (body-based success evaluation, token refresh from `accessTokenExpiryDate`, `pointsInfo` observability) instead of the retired Spocket-placeholder assumptions.
- [x] 13.5 Document what was updated and why in the response, per `docs/base-standards.md` section 6.

## 14. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 14.1 Load and apply `ai-specs/skills/commit/SKILL.md` before executing any Git commands.
- [ ] 14.2 Verify all tasks above are marked `[x]` and required reports exist under `openspec/changes/cj-dropshipping-integration/reports/`.
- [ ] 14.3 Stage all relevant files (Prisma schema/migration, renamed and new domain/application/infrastructure/presentation code, tests, docs, OpenSpec artifacts) — exclude `.env`, `node_modules/`, `dist/`, `coverage/`. Double-check `backend/.env` (containing the real `CJDROPSHIPPING_API_KEY`) is NOT staged.
- [ ] 14.4 Create commit with Conventional Commit message (e.g., `feat(suppliers): replace Spocket placeholder with real CJ Dropshipping integration and sandbox order push`), including OpenSpec change name and test verification status.
- [ ] 14.5 Push branch to remote: `git push -u origin feature/cj-dropshipping-integration`.
- [ ] 14.6 Create Pull Request with `gh pr create --base develop --title "..." --body "..."`, including summary, OpenSpec change name, verification status (unit/curl real-API/E2E-N/A), and open questions from `design.md` as known limitations.
- [ ] 14.7 Report the PR URL in chat.
