## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Read `ai-specs/skills/using-git-worktrees/SKILL.md` and decide workspace isolation strategy (current checkout vs Git worktree)
- [x] 0.2 Create feature branch `feature/KAN-22-shipment-management` from master
- [x] 0.3 Verify branch creation and confirm working branch is `feature/KAN-22-shipment-management`

## 1. Backend: Prisma Schema and Migration (KAN-34)

- [x] 1.1 Add `Shipment` model to `backend/prisma/schema.prisma` with fields: `id`, `customerOrderId`, `supplierOrderId?`, `carrier?`, `trackingNumber?`, `trackingUrl?`, `status` (default `"Pending"`), `shippedAt?`, `deliveredAt?`, `createdAt`, `updatedAt`; indexes on `customerOrderId`, `supplierOrderId`, `status`, `createdAt`
- [x] 1.2 Add `shipments Shipment[]` back-relation to `CustomerOrder` model in schema
- [x] 1.3 Add `shipments Shipment[]` back-relation to `SupplierOrder` model in schema
- [x] 1.4 Run `npx prisma migrate dev --name add-shipment-model` and confirm migration file created and applied
- [x] 1.5 Run `npx prisma generate` and verify TypeScript types generated without errors

## 2. Backend: Domain Layer (KAN-34)

- [x] 2.1 Create `backend/src/domain/models/shipment.ts` — `Shipment` domain type, `ShipmentStatus` enum (`Pending`, `Shipped`, `InTransit`, `Delivered`, `Failed`, `Returned`), allowed transitions map
- [x] 2.2 Create `backend/src/domain/repositories/shipmentRepository.ts` — `IShipmentRepository` interface with `findAll`, `findById`, `create`, `updateStatus`; `ShipmentFilters`, `CreateShipmentData`, `UpdateShipmentStatusData` types; error classes `ShipmentNotFoundError`, `ShipmentStatusTransitionInvalidError`, `CustomerOrderNotFoundError`, `SupplierOrderNotFoundError`

## 3. Backend: Infrastructure Layer (KAN-34)

- [x] 3.1 Create `backend/src/infrastructure/repositories/shipmentRepository.ts` — Prisma implementation of `IShipmentRepository`; `findAll` with pagination (default page 1, pageSize 20, cap 100) and filters (`customerOrderId`, `supplierOrderId`, `status`); `findById` includes customer order and supplier order summaries; `create` and `updateStatus` as Prisma writes
- [x] 3.2 Create `backend/src/infrastructure/repositories/__tests__/shipmentRepository.test.ts` — integration tests covering list with filters, get by id (found/not found), create, updateStatus

## 4. Backend: Application Layer — Validator (KAN-34)

- [x] 4.1 Add `validateShipmentCreateData` to `backend/src/application/validator.ts` — required `customerOrderId` (positive integer), optional `supplierOrderId` (positive integer), optional `carrier` (≤100 chars), optional `trackingNumber` (≤100 chars), optional `trackingUrl` (≤500 chars)
- [x] 4.2 Add `validateShipmentStatusUpdate` to `backend/src/application/validator.ts` — required `status` (must be a valid `ShipmentStatus` value)
- [x] 4.3 Add validator unit tests in `backend/src/application/__tests__/validator.test.ts` for both shipment validators (valid, missing required, length violations, invalid status)

## 5. Backend: Application Layer — Service (KAN-34)

- [x] 5.1 Create `backend/src/application/services/shipmentService.ts` with methods: `listShipments` (pagination + filters), `getShipmentById`, `createShipment` (FK checks for `customerOrderId` and optional `supplierOrderId`, calls validator, status defaults to `Pending`), `updateShipmentStatus` (state-machine validation, auto-set `shippedAt` on `Shipped`, `deliveredAt` on `Delivered`)
- [x] 5.2 State machine: `Pending → Shipped | Failed | Returned`; `Shipped → InTransit | Delivered | Failed | Returned`; `InTransit → Delivered | Failed | Returned`; terminals reject all transitions
- [x] 5.3 Create `backend/src/application/services/__tests__/shipmentService.test.ts` — unit tests for: list pagination/filtering, getById found/not found, create valid/invalid FK/validation error, updateStatus valid transitions, invalid transitions (including from terminal states)

## 6. Backend: Presentation Layer — Controller, Serializer, Routes (KAN-34)

- [x] 6.1 Create `backend/src/presentation/serializers/shipmentSerializer.ts` — map Prisma `Shipment` (with included relations) to response DTO; include customer order summary and supplier order summary when present
- [x] 6.2 Create `backend/src/presentation/controllers/shipmentController.ts` with handlers: `listShipments`, `getShipmentById`, `createShipment`, `updateShipmentStatus`; use standard response envelope `{ success, data, message }` / `{ success, data, meta }`; map domain errors to HTTP status codes and error codes (`SHIPMENT_NOT_FOUND` 404, `CUSTOMER_ORDER_NOT_FOUND` 404, `SUPPLIER_ORDER_NOT_FOUND` 404, `SHIPMENT_STATUS_TRANSITION_INVALID` 400, `VALIDATION_ERROR` 400)
- [x] 6.3 Create `backend/src/presentation/controllers/__tests__/shipmentController.test.ts` — unit tests for all 4 handlers (success cases and error mapping)
- [x] 6.4 Create `backend/src/routes/admin/shipmentRoutes.ts` — `GET /`, `POST /`, `GET /:id`, `PATCH /:id/status`; all behind `requireAdminAuth`
- [x] 6.5 Register `shipmentAdminRoutes` in `backend/src/routes/index.ts` under `adminRouter.use('/shipments', shipmentAdminRoutes)`
- [x] 6.6 Verify routes are exported in `backend/src/index.ts` (if needed)

## 7. Frontend: Types and Service (KAN-35)

- [x] 7.1 Create `frontend/src/types/shipment.ts` — `Shipment`, `ShipmentStatus` enum, `ShipmentListItem`, `CreateShipmentRequest`, `UpdateShipmentStatusRequest`, `ShipmentResponse`, `ShipmentListResponse`, `ShipmentQueryParams`, API error types (`ShipmentApiError`, `ShipmentErrorCode`)
- [x] 7.2 Replace stub in `frontend/src/services/shipmentService.ts` — implement `list(params)`, `getById(id)`, `create(data)`, `updateStatus(id, status)`, `listByCustomerOrder(customerOrderId)`, `listBySupplierOrder(supplierOrderId)`; base URL `${API_BASE_URL}/api/admin/shipments`; add `mapShipmentError` and `extractShipmentErrorMessage` helpers (mirror `supplierOrderService.ts` pattern)
- [x] 7.3 Add unit tests for `shipmentService.ts` (mock Axios; test list, getById, create, updateStatus, error extraction)

## 8. Frontend: ShipmentsPage (KAN-35)

- [x] 8.1 Replace "Coming soon" stub in `frontend/src/pages/ShipmentsPage.tsx` with paginated list view: columns `id`, customer order link, supplier order link (if present), carrier, tracking number, status badge (`StatusBadge`), `createdAt`
- [x] 8.2 Add filter controls: status dropdown, `customerOrderId` text input, `supplierOrderId` text input; filters update list on change
- [x] 8.3 Add pagination controls (reuse existing `Pagination` component)
- [x] 8.4 Add "Create Shipment" button/modal: form fields `customerOrderId` (required), `supplierOrderId` (optional), `carrier`, `trackingNumber`, `trackingUrl`; submit calls `shipmentService.create`; show validation errors
- [x] 8.5 Add unit/RTL tests for `ShipmentsPage.tsx` (list renders, filter interaction, create modal opens)

## 9. Frontend: ShipmentDetailPage (KAN-35)

- [x] 9.1 Create `frontend/src/pages/ShipmentDetailPage.tsx` — display all shipment fields: id, carrier, tracking number (with `trackingUrl` as external link if present), status badge, `shippedAt`, `deliveredAt`, `createdAt`; link to customer order detail page; link to supplier order detail page if present
- [x] 9.2 Add status transition action buttons for allowed next states (per state machine); hide all actions when shipment is in terminal state (`Delivered`, `Failed`, `Returned`)
- [x] 9.3 On transition button click: call `shipmentService.updateStatus`; show success/error feedback; refresh shipment data
- [x] 9.4 Add unit/RTL tests for `ShipmentDetailPage.tsx` (renders fields, terminal state hides actions, transition calls service)

## 10. Frontend: Routing and Navigation (KAN-35)

- [x] 10.1 Register `ShipmentsPage` route in admin routing (wherever `SupplierOrdersPage` / `RefundsPage` are registered), e.g. `/admin/shipments`
- [x] 10.2 Register `ShipmentDetailPage` route, e.g. `/admin/shipments/:id`
- [x] 10.3 Add "Shipments" entry to admin navigation sidebar/menu (mirror position of Refunds entry)
- [x] 10.4 Verify navigation link appears and routes resolve correctly in dev build

## 11. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 11.1 Review existing backend unit tests for `customerOrderService`, `supplierOrderService` — confirm back-relation changes do not break existing tests
- [x] 11.2 Review Prisma seed files or test fixtures — update if they reference `CustomerOrder` or `SupplierOrder` schemas that now include `shipments`
- [x] 11.3 Fix any broken tests introduced by schema additions

## 12. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 12.1 Capture pre-test database baseline (shipments table row count = 0; customer_orders and supplier_orders counts unchanged)
- [x] 12.2 Run targeted unit tests: `cd backend && npx jest --testPathPattern="shipment" --verbose`
- [x] 12.3 Run broader backend unit test suite: `cd backend && npx jest --verbose`
- [x] 12.4 Verify post-test database state matches baseline (no unintended mutations remain)
- [x] 12.5 Restore database state if any test left residual data
- [x] 12.6 Create report `openspec/changes/shipment-management/reports/YYYY-MM-DD-step-12-unit-test-and-db-verification.md`
- [x] 12.7 Mark step complete only after all tests pass and report exists

## 13. Frontend: Run Unit Tests (MANDATORY)

- [x] 13.1 Run frontend unit tests from repo root (use `--testMatch` override if running from worktree on Windows): `cd frontend && npx react-scripts test --watchAll=false --testPathPattern="shipment"`
- [x] 13.2 Run broader frontend test suite: `cd frontend && npx react-scripts test --watchAll=false`
- [x] 13.3 Fix any failures; document results in `openspec/changes/shipment-management/reports/YYYY-MM-DD-step-13-frontend-unit-tests.md`

## 14. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 14.1 Ensure backend server is running (start if needed); verify database connection
- [x] 14.2 Test `GET /api/admin/shipments` — list all (no filters); verify 200, pagination meta, response envelope
- [x] 14.3 Test `GET /api/admin/shipments?status=Pending` — filter by status; verify only matching records returned
- [x] 14.4 Test `GET /api/admin/shipments?customerOrderId=1` — filter by customer order; verify results
- [x] 14.5 Test `POST /api/admin/shipments` with valid body (`customerOrderId`, optional fields) — verify 201, status = Pending; then DELETE test record to restore DB
- [x] 14.6 Test `POST /api/admin/shipments` with non-existent `customerOrderId` — verify 404 `CUSTOMER_ORDER_NOT_FOUND`
- [x] 14.7 Test `POST /api/admin/shipments` with non-existent `supplierOrderId` — verify 404 `SUPPLIER_ORDER_NOT_FOUND`
- [x] 14.8 Test `POST /api/admin/shipments` with `carrier` > 100 chars — verify 400 `VALIDATION_ERROR`
- [x] 14.9 Test `GET /api/admin/shipments/:id` for existing shipment — verify 200, relations included
- [x] 14.10 Test `GET /api/admin/shipments/:id` for non-existent id — verify 404 `SHIPMENT_NOT_FOUND`
- [x] 14.11 Test `PATCH /api/admin/shipments/:id/status` valid transition (`Pending → Shipped`) — verify 200, `shippedAt` set; restore status
- [x] 14.12 Test `PATCH /api/admin/shipments/:id/status` invalid transition (terminal → any) — verify 400 `SHIPMENT_STATUS_TRANSITION_INVALID`
- [x] 14.13 Test unauthenticated request — verify 401
- [x] 14.14 Verify database state matches pre-test baseline after all tests and cleanup
- [x] 14.15 Create report `openspec/changes/shipment-management/reports/YYYY-MM-DD-step-14-curl-endpoint-testing.md`

## 15. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 15.1 Ensure frontend and backend servers are running; verify database is in known state
- [x] 15.2 Navigate to admin Shipments page using `browser_navigate`; take snapshot to confirm list renders
- [x] 15.3 Test filter by status: select a status from dropdown, verify list updates
- [x] 15.4 Test "Create Shipment" flow: open modal, fill `customerOrderId` and optional fields, submit; verify shipment appears in list
- [x] 15.5 Navigate to shipment detail page; verify all fields displayed and customer order link present
- [x] 15.6 Test status transition from detail page: click "Shipped" action; verify status updates and `shippedAt` shown
- [x] 15.7 Verify terminal state: navigate to a `Delivered` shipment; confirm no transition actions visible
- [x] 15.8 Test error scenario: attempt to create shipment with missing `customerOrderId`; verify validation error displayed
- [x] 15.9 Restore test data (delete created shipments); close browser
- [x] 15.10 Create report `openspec/changes/shipment-management/reports/YYYY-MM-DD-step-15-e2e-testing.md`

## 16. Update Technical Documentation (MANDATORY)

- [x] 16.1 Update `docs/api-spec.yml` — correct path from `/shipments` to `/api/admin/shipments`; add `GET /:id` and `PATCH /:id/status` endpoints; add/update schemas `Shipment`, `CreateShipmentRequest`, `UpdateShipmentStatusRequest`, `ShipmentResponse`, `ShipmentListResponse`, `ShipmentStatus`
- [x] 16.2 Update `docs/data-model.md` §12 Shipment — confirm fields match Prisma model; add `shipments Shipment[]` back-relations to CustomerOrder and SupplierOrder sections; document the tracking-field complementary design decision
- [x] 16.3 Review `docs/backend-standards.md` and `docs/frontend-standards.md` — update if new patterns are introduced
- [x] 16.4 Document the `Shipment vs SupplierOrder tracking` design decision explicitly in data-model.md

## 17. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 17.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [x] 17.2 Verify all tasks are marked `[x]` and required reports exist under `openspec/changes/shipment-management/reports/`
- [x] 17.3 Stage all relevant files: Prisma schema + migration, backend layers, frontend service/pages/types, routing, docs, OpenSpec artifacts; exclude `.env`, `node_modules/`, `dist/`, `coverage/`
- [x] 17.4 Create commit with Conventional Commit message: `feat(KAN-22): add admin shipment management — Prisma model, API, UI`
- [x] 17.5 Push branch to remote: `git push -u origin feature/KAN-22-shipment-management`
- [x] 17.6 Create Pull Request with `gh pr create` and report PR URL in chat
