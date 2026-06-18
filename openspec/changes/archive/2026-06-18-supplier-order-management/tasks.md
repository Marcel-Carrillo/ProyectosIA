# Tasks

> Full-stack change (Jira KAN-19). Structured per `docs/openspec-tasks-mandatory-steps.md`
> and `openspec/config.yaml`. Reports go under `openspec/changes/supplier-order-management/reports/`.
> Parallel agents: **Backend** = sections 1–8 (KAN-31) · **Frontend** = sections 9–13 (KAN-32)
> · **Integration** = sections 14–18 (KAN-33).
>
> **Agent workflow (MANDATORY):** during `/opsx:apply`, mark each sub-task `- [x]` → `- [x]`
> in this file immediately when done. Verification steps (unit/curl/E2E) are marked `[x]`
> only after the test passes AND the report file exists. Never delegate testing to the user.

## 0. Setup: Create Feature Branch / Worktree (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to choose workspace isolation (current checkout vs Git worktree); create and switch to `feature/KAN-19` (or `feature/supplier-order-management`) from `master` before any code change.
- [x] 0.2 If using a worktree, install deps: `npm ci` (backend), `npm ci --legacy-peer-deps` (frontend); verify branch/status and DB connectivity.

## 1. Backend: Prisma schema & domain model

- [x] 1.1 Add `SupplierOrder` and `SupplierOrderItem` models to `backend/prisma/schema.prisma` per `docs/data-model.md` (fields, enums as strings, FKs to `CustomerOrder`, `CustomerOrderItem`, `Supplier`, `ProductVariant`, unique `supplierOrderNumber`, indexes on filter/sort columns). Run `npx prisma migrate dev --name add_supplier_order_and_items`.
- [x] 1.2 Create `backend/src/domain/models/supplierOrder.ts` (domain entities) and `backend/src/domain/repositories/supplierOrderRepository.ts` (interface + types: create data, list filters/result, status update data, generation result), mirroring the customer-order module.

## 2. Backend: Validator (TDD)

- [x] 2.1 Extend `backend/src/application/validator.ts` with supplier-order create, status-update, and generation validation: enum guards for `SupplierOrderStatus`; quantity/cost guards; eligibility rules (customer order `Paid`/`Processing`, not `Cancelled`); transition-rule helpers; blocked-supplier guard.
- [x] 2.2 Write failing unit tests in `backend/src/application/__tests__/validator.supplierOrder.test.ts` then make them pass.

## 3. Backend: Repository

- [x] 3.1 Implement `backend/src/infrastructure/repositories/supplierOrderRepository.ts` (Prisma): `list(filters)` with pagination, filters, search, sort; `findById` with items; transactional `create` (order + items); transactional `generateFromCustomerOrder` (group by supplier, idempotent); `updateStatus`. Include `supplierCost`/`supplierReferenceSnapshot` in supplier-order selects only.
- [x] 3.2 Define typed error classes: `SupplierOrderNotFoundError` → `SUPPLIER_ORDER_NOT_FOUND` (404), `CustomerOrderNotEligibleError` → `CUSTOMER_ORDER_NOT_ELIGIBLE` (422), `VariantSupplierMissingError` → `VARIANT_SUPPLIER_MISSING` (422), transition errors → `SUPPLIER_ORDER_STATUS_TRANSITION_INVALID` (422).

## 4. Backend: Service

- [x] 4.1 Implement `backend/src/application/services/supplierOrderService.ts`: snapshot `supplierCost`/`supplierReference` from variant, `supplierOrderNumber` generation, status-transition enforcement with lifecycle timestamps, fulfillment recomputation on parent customer order.
- [x] 4.2 Extend `customerOrderService` (or delegate) for `generateSupplierOrders(customerOrderId)` calling supplier-order service; update `fulfillmentStatus` side-effects per design D8.
- [x] 4.3 Unit tests in `backend/src/application/services/__tests__/supplierOrderService.test.ts`: manual create OK; generation groups by supplier; idempotent re-generation; eligibility guards; fulfillment side-effects; not-found cases.

## 5. Backend: Controller and routes

- [x] 5.1 Implement `backend/src/presentation/controllers/supplierOrderController.ts` (`listSupplierOrders`, `getSupplierOrderById`, `createSupplierOrder`, `updateSupplierOrderStatus`) using standard envelope and error→HTTP mapping.
- [x] 5.2 Create `backend/src/routes/admin/supplierOrderRoutes.ts` (`GET /`, `POST /`, `GET /:id`, `PATCH /:id/status`); register in `backend/src/routes/index.ts` and mount under `/api/admin/supplier-orders` in `backend/src/index.ts`.
- [x] 5.3 Add `POST /:id/supplier-orders` to `customerOrderRoutes.ts` and `customerOrderController.ts` for auto-generation endpoint.
- [x] 5.4 Add structured logging for create, generation, and status transitions via `infrastructure/logger.ts`.

## 6. Backend: Supplier-data isolation guard

- [x] 6.1 Add regression test asserting `supplierCost` and `supplierReference` never appear in any customer-order list/detail/create/status response payload.

## 7. Backend: Controller unit tests

- [x] 7.1 Add `backend/src/presentation/controllers/__tests__/supplierOrderController.test.ts` covering HTTP status codes, envelope shape, and error mapping.
- [x] 7.2 Extend `customerOrderController.test.ts` for `POST /:id/supplier-orders` (201/200/422/404).

## 8. Frontend: types and service

- [x] 8.1 Create `frontend/src/types/supplierOrder.ts` (`SupplierOrder`, `SupplierOrderItem`, `SupplierOrderStatus`, request/response types).
- [x] 8.2 Implement the existing stub `frontend/src/services/supplierOrderService.ts` against `/api/admin/supplier-orders`: `list`, `getById`, `create`, `updateStatus`, plus `mapSupplierOrderError`. Add `generateFromCustomerOrder` to `customerOrderService.ts`. Add `frontend/src/services/__tests__/supplierOrderService.test.ts`.

## 9. Frontend: SupplierOrdersPage (list)

- [x] 9.1 Implement the existing stub `frontend/src/pages/SupplierOrdersPage.tsx`: paginated list, filters (`status`, `customerOrderId`, `supplierId`), debounced search on `supplierOrderNumber`, sort, URL-synced query state, `StatusBadge`, loading/empty/error states — mirroring `CustomerOrdersPage`.
- [x] 9.2 Responsive presentation: table at `≥md`, card list `<md`; action buttons ≥44px on mobile.

## 10. Frontend: SupplierOrderDetailPage & status control

- [x] 10.1 Implement the existing stub `frontend/src/pages/SupplierOrderDetailPage.tsx`: order header, supplier/customer order links, line items with `supplierCost`/`supplierReferenceSnapshot`, tracking fields, internal notes.
- [x] 10.2 Create `frontend/src/components/admin/SupplierOrderStatusControl.tsx` for status transitions with optional tracking fields; add `frontend/src/components/admin/__tests__/SupplierOrderStatusControl.test.tsx`.
- [x] 10.3 Wire routes `/supplier-orders` and `/supplier-orders/:id` inside admin `Layout` (already present in `App.tsx`).

## 11. Frontend: Customer order detail integration

- [x] 11.1 Add "Generate supplier orders" action on `CustomerOrderDetailPage.tsx` (visible when order is eligible); show linked supplier orders list with navigation to detail pages.
- [x] 11.2 Handle idempotent 200 vs 201 responses; display success/error toasts.

## 12. Review and Update Existing Unit Tests (MANDATORY)

- [x] 12.1 Review existing backend/frontend tests impacted by the new module; update as needed. Confirm customer-order, catalog, and supplier tests remain green.

## 13. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 13.1 Capture pre-test DB baseline (SupplierOrder/SupplierOrderItem counts, related CustomerOrder/Supplier counts).
- [x] 13.2 Run targeted tests for changed backend + frontend modules.
- [x] 13.3 Run full suites (`backend` Jest, `frontend` RTL) and `npx tsc --noEmit` + lint; ensure green.
- [x] 13.4 Verify post-test DB state unchanged (mocks/integration cleaned up); restore if needed.
- [x] 13.5 Create report `openspec/changes/supplier-order-management/reports/YYYY-MM-DD-step-13-unit-test-and-db-verification.md`.

## 14. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 14.1 Start backend + DB; capture pre-test SupplierOrder count; ensure a paid customer order with variants exists (seed if needed).
- [x] 14.2 `GET /api/admin/supplier-orders` (list, filters, search, sort, pageSize clamp) and `GET /:id` — verify 200, envelope, 404 `SUPPLIER_ORDER_NOT_FOUND`.
- [x] 14.3 `POST /api/admin/customer-orders/:id/supplier-orders` — verify 201 (or 200 idempotent), one order per supplier, fulfillment status update; then restore DB.
- [x] 14.4 `POST /api/admin/supplier-orders` (manual create) — verify 201, snapshots, unique `supplierOrderNumber`; restore DB.
- [x] 14.5 `PATCH /api/admin/supplier-orders/:id/status` — verify status updates, lifecycle timestamps, tracking fields; test 422 on invalid transitions; verify customer-order fulfillment recomputation.
- [x] 14.6 Error cases: ineligible customer order (422), missing supplier (404), variant without supplier (422), blocked supplier (422).
- [x] 14.7 Security: assert NO `/api/public/supplier-orders` route; assert no `supplierCost` in customer-order responses.
- [x] 14.8 Verify DB count matches baseline after restoration; create report `openspec/changes/supplier-order-management/reports/YYYY-MM-DD-step-14-curl-endpoint-testing.md`.

## 15. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 15.1 Start frontend (:3001) + backend (:3000) with DB; navigate to `/supplier-orders`.
- [x] 15.2 E2E flow: view supplier orders list → open detail → advance status via `SupplierOrderStatusControl` → verify badges update.
- [x] 15.3 E2E flow: open customer order detail → generate supplier orders → verify linked orders appear → navigate to supplier order detail.
- [x] 15.4 Verify no horizontal overflow at 360/768/1280px.
- [x] 15.5 Restore DB state (remove/restore E2E-created data); close browser session.
- [x] 15.6 Add/extend Cypress spec `frontend/cypress/e2e/supplier-orders.cy.ts`; create report `openspec/changes/supplier-order-management/reports/YYYY-MM-DD-step-15-e2e-testing.md`.

## 16. Update Technical Documentation (MANDATORY)

- [x] 16.1 Update `docs/api-spec.yml`: add `/api/admin/supplier-orders` block (GET list, GET :id, POST, PATCH :id/status) and `/api/admin/customer-orders/:id/supplier-orders` (POST); supersede legacy `/supplier-orders*` paths; document error codes (`SUPPLIER_ORDER_NOT_FOUND`, `CUSTOMER_ORDER_NOT_ELIGIBLE`, `SUPPLIER_ORDER_STATUS_TRANSITION_INVALID`, etc.).
- [x] 16.2 Update `docs/data-model.md` only if clarifications emerge; confirm `docs/backend-standards.md`/`docs/frontend-standards.md` updated only if new patterns introduced.

## 17. Adversarial review (before commit)

- [x] 17.1 Offer/apply `ai-specs/skills/adversarial-review/SKILL.md`; fix blockers/majors (focus: status-model separation, supplier-cost isolation, idempotent generation, fulfillment side-effects).

## 18. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 18.1 Load and apply `ai-specs/skills/commit/SKILL.md`.
- [x] 18.2 Verify all tasks `[x]` and required reports exist under `openspec/changes/supplier-order-management/reports/`.
- [x] 18.3 Stage relevant files (exclude `.env`, `node_modules`, `dist`, `coverage`).
- [x] 18.4 Create commit with Conventional Commit message referencing `supplier-order-management` / KAN-19.
- [x] 18.5 Push feature branch; `gh pr create`; report the PR URL in chat.
