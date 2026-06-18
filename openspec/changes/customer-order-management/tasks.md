# Tasks

> Full-stack change (Jira KAN-18). Structured per `docs/openspec-tasks-mandatory-steps.md`
> and `openspec/config.yaml`. Reports go under `openspec/changes/customer-order-management/reports/`.
> Parallel agents: **Backend** = sections 1–7 (KAN-28) · **Frontend** = sections 8–12 (KAN-29)
> · **Integration** = sections 13–17 (KAN-30).
>
> **Agent workflow (MANDATORY):** during `/opsx:apply`, mark each sub-task `- [ ]` → `- [x]`
> in this file immediately when done. Verification steps (unit/curl/E2E) are marked `[x]`
> only after the test passes AND the report file exists. Never delegate testing to the user.

## 0. Setup: Create Feature Branch / Worktree (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to choose workspace isolation (current checkout vs Git worktree); create and switch to `feature/KAN-18` (or `feature/customer-order-management`) from `master` before any code change.
- [x] 0.2 If using a worktree, install deps: `npm ci` (backend), `npm ci --legacy-peer-deps` (frontend); verify branch/status and DB connectivity. _(N/A worktree: main checkout on feature/KAN-18)_

## 1. Backend: Prisma schema & domain model

- [x] 1.1 Add `CustomerOrder` and `CustomerOrderItem` models to `backend/prisma/schema.prisma` per `docs/data-model.md` (fields, enums as strings, FKs to `Customer` and `ProductVariant`, unique `orderNumber`, indexes on filter/sort columns). Run `npx prisma migrate dev --name add_customer_order_and_items`.
- [x] 1.2 Create `backend/src/domain/models/customerOrder.ts` (domain entities) and `backend/src/domain/repositories/customerOrderRepository.ts` (interface + types: create data, list filters/result, status update data), mirroring the customer/product module.

## 2. Backend: Validator (TDD)

- [x] 2.1 Extend `backend/src/application/validator.ts` with customer-order create and status-update validation: enum guards for `status`, `paymentStatus`, `fulfillmentStatus`; amount/quantity guards; address snapshot shape; transition-rule helpers (paid cannot return to `PendingPayment`; cancelled cannot advance fulfillment).
- [x] 2.2 Write failing unit tests in `backend/src/application/__tests__/validator.customerOrder.test.ts` then make them pass.

## 3. Backend: Repository

- [x] 3.1 Implement `backend/src/infrastructure/repositories/customerOrderRepository.ts` (Prisma): `list(filters)` with pagination, filters, search, sort; `findById` with items; transactional `create` (order + items); `updateStatus`. Use explicit selects that **omit supplier fields**.
- [x] 3.2 Define typed error classes: `CustomerOrderNotFoundError` → `CUSTOMER_ORDER_NOT_FOUND` (404), `CustomerNotFoundError`, `VariantNotFoundError`, `OrderNumberConflictError`, transition errors → 422 codes per spec.

## 4. Backend: Service

- [x] 4.1 Implement `backend/src/application/services/customerOrderService.ts`: variant resolution + snapshotting, server-side totals (`Decimal`), `orderNumber` generation, status-transition enforcement, `paidAt`/`cancelledAt` timestamps.
- [x] 4.2 Unit tests in `backend/src/application/services/__tests__/customerOrderService.test.ts`: create OK; snapshots; totals; transition guards; not-found cases.

## 5. Backend: Controller and routes

- [x] 5.1 Implement `backend/src/presentation/controllers/customerOrderController.ts` (`listCustomerOrders`, `getCustomerOrderById`, `createCustomerOrder`, `updateCustomerOrderStatus`) using standard envelope and error→HTTP mapping.
- [x] 5.2 Create `backend/src/routes/admin/customerOrderRoutes.ts` (`GET /`, `POST /`, `GET /:id`, `PATCH /:id/status`); register in `backend/src/routes/index.ts` and mount under `/api/admin/customer-orders` in `backend/src/index.ts`. Add NO `/api/public/*` customer-order route.
- [x] 5.3 Add structured logging for create and status transitions via `infrastructure/logger.ts`.

## 6. Backend: Supplier-data isolation guard

- [x] 6.1 Add regression test asserting `supplierId`, `supplierReference`, and `supplierCost` never appear in any customer-order list/detail/create/status response payload.

## 7. Backend: Controller unit tests

- [x] 7.1 Add `backend/src/presentation/controllers/__tests__/customerOrderController.test.ts` covering HTTP status codes, envelope shape, and error mapping.

## 8. Frontend: types and service

- [x] 8.1 Create `frontend/src/types/customerOrder.ts` (`CustomerOrder`, `CustomerOrderItem`, status enums, request/response types).
- [x] 8.2 Implement the existing stub `frontend/src/services/customerOrderService.ts` against `/api/admin/customer-orders`: `list`, `getById`, `create`, `updateStatus`, plus `mapCustomerOrderError`. Add `frontend/src/services/__tests__/customerOrderService.test.ts`.

## 9. Frontend: CustomerOrdersPage (list)

- [x] 9.1 Implement the existing stub `frontend/src/pages/CustomerOrdersPage.tsx`: paginated list, filters (`status`, `paymentStatus`, `fulfillmentStatus`, `customerId`), debounced search, sort, URL-synced query state, `StatusBadge` for the three status dimensions, loading/empty/error states — mirroring `ProductsPage`/`CustomersPage`.
- [x] 9.2 Responsive presentation: table at `≥md`, card list `<md`; action buttons ≥44px on mobile.

## 10. Frontend: CustomerOrderDetailPage & status control

- [x] 10.1 Implement the existing stub `frontend/src/pages/CustomerOrderDetailPage.tsx`: order header, totals, address snapshots, line items with snapshots, customer link.
- [x] 10.2 Create `frontend/src/components/admin/OrderStatusControl.tsx` for the three independent status fields; add `frontend/src/components/admin/__tests__/OrderStatusControl.test.tsx`.
- [x] 10.3 Wire routes `/customer-orders` and `/customer-orders/:id` inside admin `Layout` (already present in `App.tsx`).

## 11. Review and Update Existing Unit Tests (MANDATORY)

- [x] 11.1 Review existing backend/frontend tests impacted by the new module; update as needed. Confirm catalog, customer, and supplier tests remain green.

## 12. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 12.1 Capture pre-test DB baseline (CustomerOrder/CustomerOrderItem counts, related Customer/ProductVariant counts).
- [x] 12.2 Run targeted tests for changed backend + frontend modules.
- [x] 12.3 Run full suites (`backend` Jest, `frontend` RTL) and `npx tsc --noEmit` + lint; ensure green.
- [x] 12.4 Verify post-test DB state unchanged (mocks/integration cleaned up); restore if needed.
- [x] 12.5 Create report `openspec/changes/customer-order-management/reports/YYYY-MM-DD-step-12-unit-test-and-db-verification.md`.

## 13. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 13.1 Start backend + DB; capture pre-test CustomerOrder count.
- [x] 13.2 `GET /api/admin/customer-orders` (list, filters, search, sort, pageSize clamp) and `GET /:id` — verify 200, envelope, 404 `CUSTOMER_ORDER_NOT_FOUND`.
- [x] 13.3 `POST /api/admin/customer-orders` (create with items) — verify 201, snapshots, totals, unique `orderNumber`; then restore DB (remove created order).
- [x] 13.4 `PATCH /api/admin/customer-orders/:id/status` — verify independent status updates; test valid transitions and 422 on invalid transitions (paid→PendingPayment, cancelled fulfillment advance).
- [x] 13.5 Error cases: missing customer (404), invalid variant (404), invalid quantity (400), duplicate order number handling if applicable.
- [x] 13.6 Security: assert NO `/api/public/customer-orders` route; assert no supplier fields in responses.
- [x] 13.7 Verify DB count matches baseline after restoration; create report `openspec/changes/customer-order-management/reports/YYYY-MM-DD-step-13-curl-endpoint-testing.md`.

## 14. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 14.1 Start frontend (:3001) + backend (:3000) with DB; navigate to `/customer-orders`.
- [x] 14.2 E2E flow: view list → open detail → advance each status dimension via `OrderStatusControl` → verify badges update. Verify no horizontal overflow at 360/768/1280px.
- [x] 14.3 Restore DB state (remove/restore E2E-created data); close browser session.
- [x] 14.4 Add/extend Cypress spec `frontend/cypress/e2e/customer-orders.cy.ts`; create report `openspec/changes/customer-order-management/reports/YYYY-MM-DD-step-14-e2e-testing.md`.

## 15. Update Technical Documentation (MANDATORY)

- [x] 15.1 Update `docs/api-spec.yml`: add `/api/admin/customer-orders` block (GET list, GET :id, POST, PATCH :id/status) aligned with admin convention; supersede legacy `/customer-orders*` paths; document error codes (`CUSTOMER_ORDER_NOT_FOUND`, `ORDER_STATUS_TRANSITION_INVALID`, etc.).
- [x] 15.2 Update `docs/data-model.md` only if clarifications emerge; confirm `docs/backend-standards.md`/`docs/frontend-standards.md` updated only if new patterns introduced. _(no schema clarifications needed)_

## 16. Adversarial review (before commit)

- [x] 16.1 Offer/apply `ai-specs/skills/adversarial-review/SKILL.md`; fix blockers/majors (focus: status-model separation, snapshot immutability, supplier-field absence, monetary correctness). _(Major gap fixed: service-level snapshot test added; minor repo dedup applied.)_

## 17. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 17.1 Load and apply `ai-specs/skills/commit/SKILL.md`.
- [x] 17.2 Verify all tasks `[x]` and required reports exist under `openspec/changes/customer-order-management/reports/`.
- [x] 17.3 Stage relevant files (exclude `.env`, `node_modules`, `dist`, `coverage`).
- [x] 17.4 Create commit with Conventional Commit message referencing `customer-order-management` / KAN-18.
- [x] 17.5 Push feature branch; `gh pr create`; report the PR URL in chat. _(PR #21)_
