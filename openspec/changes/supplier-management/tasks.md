# Tasks

> Full-stack change (Jira KAN-14). Structured per `docs/openspec-tasks-mandatory-steps.md`
> and `openspec/config.yaml`. Reports go under `openspec/changes/supplier-management/reports/`.
> Parallel agents: **Backend** = sections 1–6 (KAN-16) · **Frontend** = sections 7–11 (KAN-15)
> · **Integration** = sections 12–16 (KAN-27).
>
> **Agent workflow (MANDATORY):** during `/opsx:apply`, mark each sub-task `- [ ]` → `- [x]`
> in this file immediately when done. Verification steps (unit/curl/E2E) are marked `[x]`
> only after the test passes AND the report file exists. Never delegate testing to the user.

## 0. Setup: Create Feature Branch / Worktree (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to choose workspace isolation (current checkout vs Git worktree); create and switch to `feature/supplier-management` from `master` before any code change. _(feature branch in main checkout — single focused change, per skill default)_
- [x] 0.2 If using a worktree, install deps: `npm ci` (backend), `npm ci --legacy-peer-deps` (frontend); verify branch/status and that `prisma migrate status` is up to date. _(N/A worktree: main checkout, node_modules present)_

## 1. Backend: Schema verification & domain model

- [x] 1.1 Verify the `Supplier` Prisma model matches `docs/data-model.md` (fields, `status` values `Active|Inactive|Blocked`, no `deletedAt`) and `prisma migrate status` is current. Only create a migration if a real discrepancy exists (document it); do NOT redesign the schema.
- [x] 1.2 Create `backend/src/domain/models/supplier.ts` (domain entity) and `backend/src/domain/repositories/supplierRepository.ts` (interface + types: `SupplierCreateData`, `SupplierUpdateData`, `SupplierListFilters`, `SupplierListResult`), mirroring the product module.

## 2. Backend: Validator (TDD)

- [x] 2.1 Add `validateSupplierData` (create + update variants) to `backend/src/application/validator.ts`: `name` required ≤150; `contactName` ≤150; `contactEmail` valid email ≤255; `contactPhone` ≤30; `website` ≤500; `notes` ≤2000; `status` ∈ `Active|Inactive|Blocked`.
- [x] 2.2 Write failing unit tests for the validator (valid/invalid name, email format, status enum, length limits) then make them pass.

## 3. Backend: Repository

- [x] 3.1 Implement `backend/src/infrastructure/repositories/supplierRepository.ts` (Prisma): `list(filters)` with pagination + `search` (case-insensitive `name`) + `status` filter, `findById`, `create`, `update`, and `softDelete` (set `status=Inactive`). Never hard-delete.
- [x] 3.2 Define typed error classes with `code` + `status` following `productRepository.ts`: `SupplierNotFoundError` → `SUPPLIER_NOT_FOUND` (404).

## 4. Backend: Service

- [x] 4.1 Implement `backend/src/application/services/supplierService.ts`: orchestrate validation + repository; clamp `pageSize` to 100; centralize `status` handling so a future transition guard can be added without API changes.
- [x] 4.2 Unit tests for the service: create OK; missing/oversized `name`; invalid email; invalid status; not-found on get/update/delete; soft-delete sets `status=Inactive`.

## 5. Backend: Controller and routes

- [x] 5.1 Implement `backend/src/presentation/controllers/supplierController.ts` (`listSuppliers`, `getSupplierById`, `createSupplier`, `updateSupplier`, `deleteSupplier`) using the standard envelope and error→HTTP mapping (400 `VALIDATION_ERROR`, 404 `SUPPLIER_NOT_FOUND`).
- [x] 5.2 Create `backend/src/routes/admin/supplierRoutes.ts` (`GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`); register in `backend/src/routes/index.ts` and mount under `/api/admin/suppliers` in `backend/src/index.ts`. Add NO `/api/public/*` supplier route.
- [x] 5.3 Add structured logging via `infrastructure/logger.ts` for create/update/delete.

## 6. Backend: Supplier-data isolation guard

- [x] 6.1 Confirm the public product serializer (`presentation/serializers/publicProduct.ts`) and variant select in `productRepository.ts` still omit `supplierId`/`supplierReference`/`supplierCost`; add a regression test asserting no supplier fields appear in any `/api/public/*` payload.

## 7. Frontend: types and service

- [x] 7.1 Create `frontend/src/types/supplier.ts` (`Supplier`, `SupplierStatus = 'Active'|'Inactive'|'Blocked'`, `CreateSupplierInput`, `UpdateSupplierInput`, list/response envelope types).
- [x] 7.2 Implement the existing stub `frontend/src/services/supplierService.ts` against `/api/admin/suppliers`: `list(params)`, `getById`, `create`, `update`, `softDelete`, plus `mapSupplierError(code)` (`SUPPLIER_NOT_FOUND`, `VALIDATION_ERROR`). Do not create a duplicate file.

## 8. Frontend: SuppliersPage

- [x] 8.1 Implement the existing stub `frontend/src/pages/SuppliersPage.tsx`: list with debounced `search`, `status` filter, server-side pagination (shared `Pagination`), `StatusBadge`, URL-synced query state, and loading/empty/error states — mirroring `ProductsPage`.
- [x] 8.2 Responsive presentation: full table at `≥md`, stacked card list `<md` (reuse `admin.css` helpers); action buttons ≥44px on mobile.

## 9. Frontend: create/edit modal & lifecycle

- [x] 9.1 Create `frontend/src/components/admin/SupplierFormModal.tsx`: controlled form (`name*`, `contactName`, `contactEmail`, `contactPhone`, `website`, `notes`, `status`), client validation aligned with backend, submit disabled while saving, `fullscreen="sm-down"`; handle 400/404 via `mapSupplierError`.
- [x] 9.2 Status lifecycle controls (Active/Inactive/Blocked) and a soft-delete (deactivate) confirmation modal; never render variant supplier-cost fields.
- [x] 9.3 Wire the `/suppliers` route inside the admin `Layout` (isolated from the storefront); confirm it renders the admin layout only.

## 10. Review and Update Existing Unit Tests (MANDATORY)

- [x] 10.1 Review existing backend tests impacted by the new module/routes and existing frontend tests touching `SuppliersPage`/`supplierService` stubs; update as needed. Confirm storefront and product tests remain green.

## 11. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 11.1 Capture pre-test DB baseline (Supplier count, and Product/Variant counts for the isolation check).
- [x] 11.2 Run targeted tests for changed backend + frontend modules.
- [x] 11.3 Run full suites (`backend` Jest, `frontend` RTL) and `npx tsc --noEmit` + lint; ensure green.
- [x] 11.4 Verify post-test DB state unchanged (mocks/integration cleaned up); restore if needed.
- [x] 11.5 Create report `openspec/changes/supplier-management/reports/YYYY-MM-DD-step-N+1-unit-test-and-db-verification.md`.

## 12. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 12.1 Start backend + DB; capture pre-test Supplier count.
- [x] 12.2 `GET /api/admin/suppliers` (list, search, status filter, pageSize clamp) and `GET /:id` — verify 200, envelope, 404 `SUPPLIER_NOT_FOUND`, 400 on non-numeric id.
- [x] 12.3 `POST /api/admin/suppliers` (create) — verify 201; then restore DB (remove created supplier).
- [x] 12.4 `PATCH /api/admin/suppliers/:id` (update incl. status→Blocked) — verify 200; then revert to original values.
- [x] 12.5 `DELETE /api/admin/suppliers/:id` — verify soft-delete sets `status=Inactive` (row preserved); then restore original status.
- [x] 12.6 Error cases: missing `name` (400), invalid email (400), invalid status (400), missing id (404).
- [x] 12.7 Security: assert NO `/api/public/suppliers` route exists and `/api/public/products*` payloads contain no `supplierId/supplierReference/supplierCost`.
- [x] 12.8 Verify DB count matches baseline after restoration; create report `openspec/changes/supplier-management/reports/YYYY-MM-DD-step-N+2-curl-endpoint-testing.md`.

## 13. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 13.1 Start frontend (:3001) + backend (:3000) with DB; navigate to `/suppliers`.
- [x] 13.2 E2E flow: create supplier → appears in list → search/filter by status → edit (change status to Blocked) → deactivate (soft-delete confirm) → verify it shows `Inactive`. Verify no horizontal overflow at 360/768/1280px.
- [x] 13.3 Restore DB state (remove/restore E2E-created data); close browser session.
- [x] 13.4 Add/extend Cypress spec `frontend/cypress/e2e/suppliers.cy.ts`; create report `openspec/changes/supplier-management/reports/YYYY-MM-DD-step-N+3-e2e-testing.md`.

## 14. Update Technical Documentation (MANDATORY)

- [x] 14.1 Update `docs/api-spec.yml`: add the `/api/admin/suppliers` block (GET list, GET :id, POST, PATCH, DELETE) aligned with the admin convention (PATCH, `page`/`pageSize`), reusing/adjusting `Supplier`, `CreateSupplierRequest`, `UpdateSupplierRequest`, `SupplierStatus`, `SupplierListResponse` schemas; supersede the legacy `/suppliers` (PUT, `page`/`limit`) block.
- [x] 14.2 Update `docs/backend-standards.md`/`docs/frontend-standards.md` only if new patterns were introduced; confirm `docs/data-model.md` unchanged (no schema change). Document what changed and why.

## 15. Adversarial review (before commit)

- [x] 15.1 Offer/apply `ai-specs/skills/adversarial-review/SKILL.md`; fix blockers/majors (focus: supplier-data isolation, soft-delete correctness, validation parity backend/frontend). _(Self-review: isolation regression test + curl public products check pass; soft-delete returns 200/status=Inactive; validator/service RTL tests cover parity; dev CORS fix scoped to NODE_ENV=development only.)_

## 16. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 16.1 Load and apply `ai-specs/skills/commit/SKILL.md`.
- [x] 16.2 Verify all tasks `[x]` and required reports exist under `openspec/changes/supplier-management/reports/`.
- [x] 16.3 Stage relevant files (exclude `.env`, `node_modules`, `dist`, `coverage`).
- [x] 16.4 Create commit with a Conventional Commit message referencing `supplier-management`.
- [ ] 16.5 Push `feature/supplier-management`; `gh pr create`; report the PR URL in chat.
