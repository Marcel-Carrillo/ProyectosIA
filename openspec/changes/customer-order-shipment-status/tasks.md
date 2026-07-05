## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide isolation strategy. The current checkout is on `feature/resume-cancel-pending-order-payment` (a different, already-open PR #68) — do NOT branch from it. Switch to `develop` first. Evidence: PR #68 was already merged into `develop` (confirmed via `gh pr view 68`).
- [x] 0.2 Run `git fetch origin && git checkout develop && git pull` (mandatory here since the current branch is a different, unrelated feature branch, not `develop`). Evidence: fast-forwarded `b764acd..9530c05`.
- [x] 0.3 Create and switch to `feature/customer-order-shipment-status` from `develop`.
- [x] 0.4 Verify branch creation with `git branch --show-current` and confirm working tree is clean. Evidence: `git branch --show-current` → `feature/customer-order-shipment-status`; only pre-existing unrelated WIP (`backend/.env.example`, `backend/serverless.yml` — user's own Stripe config edits) and this change's own new `openspec/changes/customer-order-shipment-status/` remain uncommitted, both untouched by this task.

## 1. Backend: Shipping Status Derivation (TDD)

- [x] 1.1 Write failing unit tests for a new pure function `deriveShippingStatus(shipments: { status: ShipmentStatus }[])` covering all precedence cases from `design.md` Decision 1: empty array → `Preparing`; all `Pending` → `Preparing`; any `Failed`/`Returned` (mixed with any other status) → `Problem`; all non-empty `Delivered` → `Delivered`; any `InTransit` (no Problem, not all Delivered) → `InTransit`; any `Shipped` (no Problem/InTransit, not all Delivered) → `Shipped`.
- [x] 1.2 Implement `deriveShippingStatus` in `backend/src/presentation/controllers/customerAccountController.ts` (or a small co-located helper module if preferred for testability), returning the `CustomerShippingStatus` union type `'Preparing' | 'Shipped' | 'InTransit' | 'Delivered' | 'Problem'`.
- [x] 1.3 Run the new tests and confirm they pass. Evidence: 9/9 `deriveShippingStatus` tests pass.

## 2. Backend: Customer-Safe Shipment Mapper and Payload Changes

- [x] 2.1 Write failing unit/integration-style tests asserting `toPublicOrder`'s new `shipments` mapping includes only `status`, `carrier`, `trackingNumber`, `trackingUrl`, `shippedAt`, `deliveredAt` and never `id`, `customerOrderId`, `supplierOrderId`, or a `supplierOrder` relation, even when the underlying Prisma row contains those fields.
- [x] 2.2 Write failing tests asserting `toPublicOrder`'s output no longer contains `fulfillmentStatus` (order-level or per-item).
- [x] 2.3 Implement a `toPublicShipment(shipment)` allow-list mapper and wire it into `toPublicOrder` to add `shippingStatus` (via `deriveShippingStatus`) and `shipments: shipment[].map(toPublicShipment)` (detail only, per `design.md` Decision 5) to the returned object; remove `fulfillmentStatus` from `toPublicOrder`'s output and from its item mapping.
- [x] 2.4 Update `listOrders` and `getOrderById` in `customerAccountController.ts` to add a scoped Prisma `include`/`select` for `shipments` (`select: { status, carrier, trackingNumber, trackingUrl, shippedAt, deliveredAt }` only — never select `supplierOrderId`), per `design.md` Decision 3. For `listOrders`, only pass `shippingStatus` through to each list item's output (omit the full `shipments[]` array from the list response).
- [x] 2.5 Run the new tests and confirm they pass. Evidence: `npx jest --testPathPattern=customerAccountController` → 18 passed, 18 total. `npx tsc --noEmit` clean.

## 3. Backend: Ownership and Supplier-Leakage Regression Tests

- [x] 3.1 Extend `backend/src/routes/public/__tests__/customerOrderIsolation.test.ts` (or add a new integration test) with a case creating a `Shipment` with a non-null `supplierOrderId` for a test order, then asserting the customer-facing `GET /orders/:id` response body does not contain `supplierOrderId` or `supplierOrder` anywhere.
- [x] 3.2 Add an integration test asserting a customer cannot see another customer's shipment data (ownership isolation already covered structurally by the existing `findFirst({ id, customerId })` pattern — add an explicit assertion covering the new `shipments`/`shippingStatus` fields).
- [x] 3.3 Run the new tests and confirm they pass. Evidence: 3 new tests pass with real assertions (`shippingStatus: 'Shipped'`, whitelisted shipment fields, no `supplierOrderId`/`supplierOrder`, no `fulfillmentStatus`, list omits `shipments`) — checkout succeeded end-to-end (real Stripe test keys now configured), so these ran against real fixture data, not the early-return guard.

## 4. Frontend: Shipping Status UI

- [x] 4.1 Add `shippingStatus: 'Preparing' | 'Shipped' | 'InTransit' | 'Delivered' | 'Problem'` and an optional `shipments?: Array<{ status: string; carrier: string | null; trackingNumber: string | null; trackingUrl: string | null; shippedAt: string | null; deliveredAt: string | null }>` to the `OrderDetail` interface in `frontend/src/pages/storefront/AccountOrderDetailPage.tsx`; remove any local typing that assumed `fulfillmentStatus` was present (confirm none currently render it).
- [x] 4.2 In `AccountOrderDetailPage.tsx`, render a "Shipping" section (status badge via `orderStatusLabel`, plus a list of shipments with carrier, tracking link when `trackingUrl` is present, shipped/delivered dates) gated on `order.status !== 'PendingPayment'`, placed after the existing order-meta block and before/alongside the existing pending-payment actions block (which is gated the opposite way, on `status === 'PendingPayment'`, so the two never render simultaneously).
- [x] 4.3 In `frontend/src/pages/storefront/AccountOrdersPage.tsx`, add a `shippingStatus` field to the orders list item type and render a shipping-status badge (reusing `orderBadgeClass`) for orders with `status !== 'PendingPayment'`.
- [x] 4.4 Add ES/EN i18n keys for `status.Preparing`, `status.InTransit`, `status.Problem` in `frontend/src/i18n/locales/{es,en}/account.json` (`Shipped`/`Delivered`/`Processing` labels already exist); add a short "Shipping" section heading key under `orderDetail`.
- [x] 4.5 Verify TypeScript compiles cleanly for the frontend (`npx tsc --noEmit`) and ESLint passes (`npx eslint src --ext .ts,.tsx`). Evidence: both clean.

## 5. Frontend: Component Tests

- [x] 5.1 Add/extend RTL tests in `frontend/src/pages/storefront/__tests__/AccountOrderDetailPage.test.tsx` covering: shipping section hidden while `PendingPayment`; shipping badge + tracking link rendered for `Paid` order with a `Shipped` shipment; `Problem` status rendered when a shipment is `Failed`.
- [x] 5.2 Add/extend RTL tests in `frontend/src/pages/storefront/__tests__/AccountOrdersPage.test.tsx` covering: shipping-status badge shown for non-pending orders, hidden for `PendingPayment` orders.
- [x] 5.3 Run the new/updated frontend tests and confirm they pass. Evidence: `AccountOrderDetailPage.test.tsx` 10/10 passed (7 existing + 3 new); `AccountOrdersPage.test.tsx` 4/4 passed (2 existing + 2 new).

## 6. Review and Update Existing Unit Tests (MANDATORY)

- [x] 6.1 Review existing `customerAccountController` tests (if any) and `docs/api-spec.yml`-adjacent test fixtures for assumptions that `toPublicOrder` includes `fulfillmentStatus`; update any that do. Evidence: no pre-existing `customerAccountController` test file existed; new file created covers the removal directly.
- [x] 6.2 Review `frontend/src/pages/storefront/__tests__/AccountOrderDetailPage.test.tsx` and `AccountOrdersPage.test.tsx` (from the prior `resume-cancel-pending-order-payment` change) for interference between the pending-payment actions block and the new shipping section; confirm both gate correctly and don't double-render. Evidence: both gates are exact opposites of the same `status` field; all 14 tests across both files pass together with no interference.

## 7. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 7.1 Capture pre-test database baseline: count of `Shipment` rows by `status`, and count of `CustomerOrder` rows by `status`.
- [x] 7.2 Run targeted backend unit tests for the new/changed files (`customerAccountController`, `deriveShippingStatus`).
- [x] 7.3 Run the required backend test suite (`npm test` in `backend/`).
- [x] 7.4 Run the required frontend test suite (`npm test` in `frontend/`, non-watch mode).
- [x] 7.5 Verify post-test database state matches the pre-test baseline; restore if any test left residual data.
- [x] 7.6 Create report `openspec/changes/customer-order-shipment-status/reports/YYYY-MM-DD-step-7-unit-test-and-db-verification.md` following the template in `docs/openspec-tasks-mandatory-steps.md`.
- [x] 7.7 Mark this step complete only after tests pass and the report exists.

## 8. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 8.1 Ensure the backend server and database are running (start if needed).
- [x] 8.2 Using a test customer, create a `Paid` order with no shipments; `curl -X GET /api/public/account/orders/:id` and verify `shippingStatus: "Preparing"`, no `shipments` reported as anything but an empty/absent array as designed, and no `fulfillmentStatus` field anywhere in the response.
- [x] 8.3 Insert a `Shipment` row directly (status `Shipped`, with `carrier`/`trackingNumber`/`trackingUrl`/`shippedAt`) associated to the same order via `supplierOrderId = NULL` and a second one via a non-null `supplierOrderId`; re-run the curl call and verify `shippingStatus: "Shipped"`, the `shipments[]` array contains the whitelisted fields for both, and `supplierOrderId`/`supplierOrder` are absent from the entire response body.
- [x] 8.4 Update one shipment to `Failed` via direct SQL; re-run the curl call and verify `shippingStatus: "Problem"`.
- [x] 8.5 Update all shipments to `Delivered`; re-run the curl call and verify `shippingStatus: "Delivered"`.
- [x] 8.6 `curl -X GET /api/public/account/orders` (list) and verify each item includes `shippingStatus` but not a `shipments` array.
- [x] 8.7 Test ownership: attempt to read the order from a different customer's token, expect `404 CUSTOMER_ORDER_NOT_FOUND` (regression check — unrelated to this change's new fields, confirms no accidental exposure change).
- [x] 8.8 Restore database state: delete any test order/shipment/customer fixtures created for this manual test run.
- [x] 8.9 Create report `openspec/changes/customer-order-shipment-status/reports/YYYY-MM-DD-step-8-curl-endpoint-testing.md` with all commands, responses, and cleanup actions.

## 9. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 9.1 Ensure both frontend and backend servers are running and the database is in a known state.
- [x] 9.2 Using Playwright MCP, log in as a test customer with a `Paid` order that has an associated `Shipped` shipment (insert via SQL fixture) and navigate to `/account/orders/:id`.
- [x] 9.3 Verify the shipping status badge and tracking section (carrier, tracking link, shipped date) are visible via `browser_snapshot`.
- [x] 9.4 Navigate to `/account/orders` and verify the shipping-status badge is visible in the list for that order.
- [x] 9.5 Using a second test order still `PendingPayment`, verify no shipping badge/section renders on either the list or detail page (and that the existing "Complete payment"/"Cancel order" actions still render correctly, unaffected by this change).
- [x] 9.6 Using a third test order with a `Failed` shipment, verify the detail page shows the `Problem` status.
- [x] 9.7 Restore test environment: clean up any orders/shipments/data created during E2E, close browser sessions.
- [x] 9.8 Create report `openspec/changes/customer-order-shipment-status/reports/YYYY-MM-DD-step-9-e2e-testing.md` with workflows, assertions, and cleanup actions.

## 10. Update Technical Documentation (MANDATORY)

- [x] 10.1 Update `docs/data-model.md`'s `Shipment` and `CustomerOrder` sections to document the derived customer-facing `shippingStatus` (values, precedence rule) and note that internal `fulfillmentStatus` is no longer exposed through the customer-facing account order endpoints.
- [x] 10.2 Update `docs/api-spec.yml`'s `PublicOrder`/`PublicOrderItem` schemas (added in the prior `resume-cancel-pending-order-payment` change) to add `shippingStatus` and `shipments` (detail only), and remove `fulfillmentStatus` from `PublicOrder`/`PublicOrderItem`; document this removal in the endpoint description as **BREAKING (internal API surface only)**.
- [x] 10.3 Update `docs/frontend-standards.md` if the shipping-status badge/section introduces a new documented UI convention worth capturing.
- [x] 10.4 Document in the PR description what was updated and why, including the `fulfillmentStatus` removal.

## 11. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [ ] 11.1 Load and apply `ai-specs/skills/commit/SKILL.md` before running any Git commands.
- [ ] 11.2 Verify all tasks above are marked `[x]` and all required reports exist under `openspec/changes/customer-order-shipment-status/reports/`.
- [ ] 11.3 Stage all relevant files (backend, frontend, docs, OpenSpec artifacts); exclude `.env`, `node_modules/`, `dist/`, `coverage/`, secrets, and any unrelated in-progress changes already present in the working tree from other work.
- [ ] 11.4 Create a Conventional Commit (e.g. `feat(account): expose derived shipping status on customer orders`) referencing this OpenSpec change and test status.
- [ ] 11.5 Push the branch: `git push -u origin feature/customer-order-shipment-status`.
- [ ] 11.6 Create the Pull Request with `gh pr create --base develop ...`, including summary, OpenSpec change name, and verification status (unit/curl/E2E).
- [ ] 11.7 Report the PR URL in chat.
