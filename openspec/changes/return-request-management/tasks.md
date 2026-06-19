## 0. Setup: Create Feature Branch (MANDATORY — FIRST STEP)

> Before executing this step, apply `ai-specs/skills/using-git-worktrees/SKILL.md` to determine workspace isolation strategy (current checkout vs. Git worktree). Feature branch is the default; create a worktree only if the user explicitly requests it or unrelated changes need isolation.

- [x] 0.1 Inspect repository state: run `git status`, `git branch --show-current`, `git worktree list`
- [x] 0.2 Create feature branch `feature/KAN-25-return-request-management` from `master`
- [x] 0.3 Verify branch is active: `git branch --show-current`

## 1. Backend: Prisma Schema and Migration

- [x] 1.1 Add `model ReturnRequest` to `backend/prisma/schema.prisma` with all fields from `docs/data-model.md` §13: `id`, `customerOrderId`, `customerOrderItemId`, `reason`, `status` (string, default `"Requested"`), `requestedAt`, `approvedAt?`, `rejectedAt?`, `receivedAt?`, `createdAt`, `updatedAt`
- [x] 1.2 Add `returnRequests ReturnRequest[]` relation to the `CustomerOrder` model in `schema.prisma`
- [x] 1.3 Add `returnRequests ReturnRequest[]` relation to the `CustomerOrderItem` model in `schema.prisma`
- [x] 1.4 Add `refunds Refund[]` back-relation to the `ReturnRequest` model
- [x] 1.5 Convert `Refund.returnRequestId Int?` into a real optional FK relation: add `returnRequest ReturnRequest? @relation(fields: [returnRequestId], references: [id])` to the `Refund` model
- [x] 1.6 Add indexes on `ReturnRequest`: `@@index([customerOrderId])`, `@@index([customerOrderItemId])`, `@@index([status])`, `@@index([createdAt])`
- [x] 1.7 Run `npx prisma migrate dev --name add_return_request` inside `backend/` — verify migration SQL creates the table, FK constraints, and indexes; verify the FK on `Refund.return_request_id` is added
- [x] 1.8 Run `npx prisma generate` inside `backend/` to rebuild the Prisma client

## 2. Backend: Domain Model

- [x] 2.1 Create `backend/src/domain/models/returnRequest.ts` — define `ReturnRequestStatus` type (union of `"Requested" | "Approved" | "Rejected" | "Received" | "Refunded" | "Cancelled"`)
- [x] 2.2 Define `RETURN_REQUEST_TRANSITIONS` map: `Requested → ["Approved","Rejected","Cancelled"]`, `Approved → ["Received","Cancelled"]`, `Received → ["Refunded","Cancelled"]` (terminal: Rejected, Refunded, Cancelled)
- [x] 2.3 Implement `isValidReturnRequestTransition(current, next): boolean` using the map
- [x] 2.4 Define `ReturnRequest` class/interface with all fields mirroring the Prisma model (pattern of `domain/models/refund.ts`)

## 3. Backend: Repository Interface and Prisma Implementation

- [x] 3.1 Create `backend/src/domain/repositories/returnRequestRepository.ts` — define `ReturnRequestListFilters` (`customerOrderId?`, `status?`, `page`, `limit`) and `ReturnRequestListResult` interfaces; define `IReturnRequestRepository` interface with `list`, `getById`, `create`, `updateStatus` methods
- [x] 3.2 Create `backend/src/infrastructure/repositories/returnRequestRepository.ts` — implement `IReturnRequestRepository` using Prisma; include error classes: `ReturnRequestNotFoundError`, `ReturnRequestOrderCancelledError`, `ReturnRequestItemMismatchError`, `ReturnRequestTransitionInvalidError`
- [x] 3.3 Verify `getById` throws `ReturnRequestNotFoundError` for unknown IDs

## 4. Backend: Validator

- [x] 4.1 Add `validateReturnRequestCreateData` to `backend/src/application/validator.ts`: validates `customerOrderId` (required integer), `customerOrderItemId` (required integer), `reason` (required string ≤ 500 chars)
- [x] 4.2 Add `validateReturnRequestStatusUpdate`: validates `status` is a valid `ReturnRequestStatus` string
- [x] 4.3 Write unit tests for both validators in the existing validator test file (pattern of `validator.shipment.test.ts`)

## 5. Backend: Service

- [x] 5.1 Create `backend/src/application/services/returnRequestService.ts` — implement `list`, `getById`, `create`, `updateStatus` methods
- [x] 5.2 `create` method: run inside `prisma.$transaction` — validate order exists, order `status !== "Cancelled"`, item exists, item belongs to the order; create with `status = "Requested"` and `requestedAt = new Date()`
- [x] 5.3 `updateStatus` method: validate transition using `isValidReturnRequestTransition`; set `approvedAt`, `rejectedAt`, or `receivedAt` timestamps based on target state; throw `ReturnRequestTransitionInvalidError` on invalid transitions
- [x] 5.4 Write unit tests for `returnRequestService` covering: successful create, order-not-found, item-not-found, item-mismatch, order-cancelled; every valid transition; every invalid transition; terminal-state rejection (pattern of `shipmentService.test.ts`)

## 6. Backend: Controller, Serializer, and Routes

- [x] 6.1 Create `backend/src/presentation/serializers/returnRequestSerializer.ts` — `serializeReturnRequest(rr)` returns only public fields (no supplier data)
- [x] 6.2 Create `backend/src/presentation/controllers/returnRequestController.ts` with handlers: `listReturnRequests`, `createReturnRequest`, `getReturnRequestById`, `updateReturnRequestStatus`; map domain errors to HTTP responses per spec (`ReturnRequestNotFoundError → 404`, `ReturnRequestOrderCancelledError → 409`, `ReturnRequestItemMismatchError → 422`, `ReturnRequestTransitionInvalidError → 409`)
- [x] 6.3 Create `backend/src/routes/admin/returnRequestRoutes.ts` — register: `GET /`, `POST /`, `GET /:id`, `PATCH /:id/status`; apply `requireAdminAuth` middleware to all routes
- [x] 6.4 Mount router in `backend/src/index.ts`: `adminRouter.use('/return-requests', returnRequestAdminRoutes)`
- [x] 6.5 Verify `GET /api/admin/return-requests` returns 401 without a token (smoke test)

## 7. Frontend: Types

- [x] 7.1 Create `frontend/src/types/returnRequest.ts` — define `ReturnRequestStatus` enum/union, `ReturnRequest` interface (all fields), `ReturnRequestListFilters`, `ReturnRequestListResult`, `CreateReturnRequestInput`, `UpdateReturnRequestStatusInput`

## 8. Frontend: Service (replace stub)

- [x] 8.1 Replace `frontend/src/services/returnRequestService.ts` stub with real axios implementation: `listReturnRequests`, `getReturnRequestById`, `createReturnRequest`, `updateReturnRequestStatus`; base URL `…/api/admin/return-requests`; add `mapReturnRequestError` (pattern of `refundService.ts`)

## 9. Frontend: Hook

- [x] 9.1 Create `frontend/src/hooks/useReturnRequests.ts` — wraps `listReturnRequests` with local state for filters, pagination, loading, and error (pattern of `useRefunds.ts`)

## 10. Frontend: Pages and Components

- [x] 10.1 Replace `frontend/src/pages/ReturnRequestsPage.tsx` stub with real list page: filterable by `customerOrderId` and `status`; paginated table with columns `id`, `customerOrderId`, `customerOrderItemId`, `status`, `requestedAt`; row links to detail page
- [x] 10.2 Create `frontend/src/pages/ReturnRequestDetailPage.tsx` — shows all fields; renders `ReturnRequestStatusControl`
- [x] 10.3 Create `frontend/src/components/admin/ReturnRequestStatusControl.tsx` — approve, reject, receive action buttons gated by allowed transitions for the current state; no buttons shown for terminal states (pattern of `RefundStatusControl.tsx`)
- [x] 10.4 Add `<Route path="return-requests/:id" element={<ReturnRequestDetailPage />} />` to `frontend/src/App.tsx` (the list route `return-requests` already exists at line 102)

## 11. Frontend: Update CustomerOrderDetailPage

- [x] 11.1 Add a per-item "Create Return" action button to `frontend/src/pages/CustomerOrderDetailPage.tsx`; visible when `customerOrder.status !== "Cancelled"`; navigates to the create-return form with `customerOrderId` and `customerOrderItemId` pre-filled
- [x] 11.2 Add a link to the return requests list filtered by the current order: `return-requests?customerOrderId=<id>`

## 12. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 12.1 Review `backend/src/application/services/__tests__/` for any test that touches `Refund` and now needs the `returnRequestId` FK relation — update mocks/fixtures if needed
- [x] 12.2 Ensure no existing tests are broken by the schema changes (especially refund tests)

## 13. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 13.1 Capture pre-test baseline: record `ReturnRequest` and `Refund` row counts
- [x] 13.2 Run targeted tests: `npx jest --testPathPattern="returnRequest"` inside `backend/`
- [x] 13.3 Run full backend test suite: `npm test` inside `backend/`
- [x] 13.4 Verify post-test database state matches pre-test baseline
- [x] 13.5 Create report `openspec/changes/return-request-management/reports/YYYY-MM-DD-step-13-unit-test-and-db-verification.md`
- [x] 13.6 Mark step complete only after tests pass and report exists

## 14. Backend: Manual Endpoint Testing with curl (MANDATORY — AGENT MUST EXECUTE)

- [x] 14.1 Ensure backend server is running (`npm run dev` in `backend/`)
- [x] 14.2 Test `GET /api/admin/return-requests` — verify 200 with empty paginated list
- [x] 14.3 Test `POST /api/admin/return-requests` with valid data — verify 201 and `status = Requested`; capture created `id`
- [x] 14.4 Test `GET /api/admin/return-requests/:id` with created ID — verify 200
- [x] 14.5 Test `PATCH /api/admin/return-requests/:id/status` with `{ "status": "Approved" }` — verify 200 and `approvedAt` set
- [x] 14.6 Test `PATCH /api/admin/return-requests/:id/status` with `{ "status": "Received" }` — verify 200 and `receivedAt` set
- [x] 14.7 Test `PATCH /api/admin/return-requests/:id/status` with `{ "status": "Cancelled" }` — verify 409 `RETURN_REQUEST_TRANSITION_INVALID` (terminal state)
- [x] 14.8 Test `POST` with cancelled-order — verify 409 `RETURN_REQUEST_ORDER_CANCELLED`
- [x] 14.9 Test `POST` with item from different order — verify 422 `RETURN_REQUEST_ITEM_MISMATCH`
- [x] 14.10 Test `GET /api/admin/return-requests` without auth token — verify 401
- [x] 14.11 Restore database: delete the test return request created in 14.3
- [x] 14.12 Create report `openspec/changes/return-request-management/reports/YYYY-MM-DD-step-14-curl-endpoint-testing.md`

## 15. Frontend: E2E Testing with Playwright MCP (MANDATORY — AGENT MUST EXECUTE)

- [x] 15.1 Ensure frontend (`npm start` in `frontend/`) and backend servers are running
- [x] 15.2 Navigate to admin Return Requests list page using `browser_navigate`; take snapshot to verify page loads without "Coming soon"
- [x] 15.3 Create a return request through the UI form; verify it appears in the list
- [x] 15.4 Navigate to the return request detail page; verify all fields are displayed
- [x] 15.5 Use `ReturnRequestStatusControl` to approve the request; verify status updates to `Approved`
- [x] 15.6 Test approve/reject actions; verify terminal state hides action buttons
- [x] 15.7 Navigate to a customer order detail; verify "Create Return" action is visible on items for active orders and absent for cancelled orders
- [x] 15.8 Restore test data: delete any return requests created during E2E testing
- [x] 15.9 Create report `openspec/changes/return-request-management/reports/YYYY-MM-DD-step-15-e2e-testing.md`

## 16. Update Technical Documentation (MANDATORY)

- [x] 16.1 Update `docs/api-spec.yml`: correct the route from public `/return-requests` to `/api/admin/return-requests` with admin security; add missing `GET /{id}` and `PATCH /{id}/status` operations; add `UpdateReturnRequestStatusRequest` schema; add 401/404/409/422 responses with the new error codes
- [x] 16.2 Update `docs/data-model.md` §13: confirm state machine matches the explicit matrix implemented; confirm all fields and indexes
- [x] 16.3 Update `docs/data-model.md` §14: remove the "until KAN-25" deferral note; document that `Refund.returnRequestId` is now a real FK with optional relation

## 17. Commit and Create Pull Request (MANDATORY — LAST STEP)

- [ ] 17.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [ ] 17.2 Verify all tasks above are marked `[x]` and reports exist under `openspec/changes/return-request-management/reports/`
- [ ] 17.3 Stage all relevant files (backend, frontend, docs, OpenSpec artifacts); exclude `.env`, `node_modules/`, `dist/`, `coverage/`
- [ ] 17.4 Create commit with message: `feat(KAN-25): add admin return request (RMA) management`
- [ ] 17.5 Push branch to remote: `git push -u origin feature/KAN-25-return-request-management`
- [ ] 17.6 Create Pull Request with `gh pr create` and report URL in chat
