## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide isolation strategy (current checkout is on `develop` and clean, so a normal feature branch is expected unless the user requests a worktree).
- [x] 0.2 If on `master`/`main`, run `git fetch origin && git checkout develop && git pull` first; otherwise pull `develop` directly.
- [x] 0.3 Create and switch to `feature/resume-cancel-pending-order-payment` from `develop`.
- [x] 0.4 Verify branch creation with `git branch --show-current` and confirm working tree is clean.

## 1. Backend: Validator Guards (TDD)

- [x] 1.1 Write failing unit tests in `backend/src/application/validator.test.ts` (or equivalent existing validator test file) for a new `validatePendingOrderPayable(order)` guard: passes for `PendingPayment` + `Pending`/`Failed` `paymentStatus`, throws for any other combination.
- [x] 1.2 Write failing unit tests for a new `validatePendingOrderCancellable(order)` guard: passes for `PendingPayment` (any non-`Paid` paymentStatus), passes idempotently for already-`Cancelled`, throws for `Paid`/`Processing`/`Completed`/`Refunded`.
- [x] 1.3 Implement `validatePendingOrderPayable` and `validatePendingOrderCancellable` in `backend/src/application/validator.ts`.
- [x] 1.4 Add typed errors `OrderNotPayableError` (409 `ORDER_NOT_PAYABLE`) and `OrderNotCancellableError` (409 `ORDER_NOT_CANCELLABLE`), and map them in `middleware/errorHandler.ts`.
- [x] 1.5 Run the new validator tests and confirm they pass. Evidence: `npx jest --watchAll=false --testPathPattern=validator.pendingOrder` → 16 passed, 16 total.

## 2. Backend: Payment Service — Resume and Cancel PaymentIntent Wrappers

- [x] 2.1 Write failing unit tests in `backend/src/application/services/paymentService.test.ts` for `resumePaymentIntent(order)`: reuses an existing PI when its status is `requires_payment_method`/`requires_confirmation`/`requires_action` and amount matches `totalAmount`; creates a new PI (distinct idempotency key `order:${id}:pi:resume:${timestamp}`) when the PI is missing/`canceled`/amount-mismatched.
- [x] 2.2 Write failing unit tests for `cancelPaymentIntent(stripePaymentIntentId)`: calls `stripe.paymentIntents.cancel`, surfaces a typed error when Stripe reports the PI as already captured/not cancellable.
- [x] 2.3 Implement `resumePaymentIntent` and `cancelPaymentIntent` in `backend/src/application/services/paymentService.ts`, wrapping Stripe SDK calls with the existing `PaymentGatewayUnavailableError` error-handling pattern used elsewhere in this file.
- [x] 2.4 Run the new payment service tests and confirm they pass. Evidence: `npx jest --watchAll=false --testPathPattern=paymentService` → 36 passed, 36 total.

## 3. Backend: Order Payment Session and Cancellation Logic

- [x] 3.1 Write failing unit tests in `backend/src/application/services/customerOrderService.test.ts` for `getOrCreatePaymentSession(customerId, orderId)`: returns `clientSecret` for an owned `PendingPayment` order (reuse vs reissue paths), throws `CUSTOMER_ORDER_NOT_FOUND` for an order owned by another customer or non-existent, throws `OrderNotPayableError` when not payable.
- [x] 3.2 Write failing unit tests for `cancelPendingOrder(customerId, orderId)`: happy path sets `status=Cancelled`, `fulfillmentStatus=Cancelled`, `cancelledAt`; idempotent when already `Cancelled`; throws `OrderNotCancellableError` when `paymentStatus` is re-checked as `Paid` inside the transaction (simulate the webhook race); rolls back to prior status and throws `OrderNotCancellableError` when the Stripe cancel call reports the PI as already captured.
- [x] 3.3 Implement `getOrCreatePaymentSession` and `cancelPendingOrder` in `backend/src/application/services/customerOrderService.ts`, using a Prisma transaction for the re-check-then-update in `cancelPendingOrder` per `design.md` Decision 3.
- [x] 3.4 Run the new service tests and confirm they pass. Evidence: `npx jest --watchAll=false --testPathPattern=customerOrderService` → 23 passed, 23 total.

## 4. Backend: Controller and Routes

- [x] 4.1 Add `resumeOrderPayment` and `cancelOrder` handlers in `backend/src/presentation/controllers/customerAccountController.ts`, reusing the existing `toPublicOrder` mapper so `stripePaymentIntentId`/`stripeChargeId` are never returned.
- [x] 4.2 Register `POST /orders/:id/payment-session` and `POST /orders/:id/cancel` in `backend/src/routes/public/accountRoutes.ts` under `requireCustomerAuth` and `accountLimiter`, alongside the existing `GET /orders` routes.
- [x] 4.3 Verify TypeScript compiles cleanly for the backend (`npm run build` or `tsc --noEmit` per `docs/backend-standards.md`). Evidence: `npx tsc --noEmit` clean (excluding pre-existing unrelated `gtin` errors); `npm run lint` clean.

## 5. Frontend: Resume and Cancel Actions

- [x] 5.1 Add `resumeOrderPayment(id)` and `cancelOrder(id)` methods to `frontend/src/services/customerAuthService.ts`, calling the two new endpoints.
- [x] 5.2 Update `frontend/src/pages/storefront/AccountOrderDetailPage.tsx`: when `status === 'PendingPayment'`, show "Complete payment" (mounts Stripe `Elements` + the existing `PaymentForm` pattern from `CheckoutPage.tsx` with the returned `clientSecret`) and "Cancel order" (confirmation dialog + refresh on success) actions; hide both for any other status.
- [x] 5.3 Update `frontend/src/pages/storefront/AccountOrdersPage.tsx` to show a "Payment pending" indicator/quick action linking to the order detail page for orders with `status === 'PendingPayment'`.
- [x] 5.4 Add ES/EN i18n keys in `frontend/src/i18n/locales/{es,en}/account.json` for the new actions, confirmation prompts, and error messages (`ORDER_NOT_PAYABLE`, `ORDER_NOT_CANCELLABLE`).
- [x] 5.5 Verify TypeScript compiles cleanly for the frontend (`npm run build` or `tsc --noEmit` per `docs/frontend-standards.md`). Evidence: `npx tsc --noEmit` clean; `npx eslint src --ext .ts,.tsx` clean.

## 6. Review and Update Existing Unit Tests (MANDATORY)

- [x] 6.1 Review existing tests in `backend/src/application/validator.test.ts`, `paymentService.test.ts`, `customerOrderService.test.ts`, and any `accountRoutes`/`customerAccountController` integration tests for overlap with the new guards/endpoints; update any assertions that assumed `PendingPayment → Cancelled` was unreachable from the customer-facing side. Evidence: no existing test assumed this transition unreachable (confirmed via grep); extended `backend/src/routes/public/__tests__/customerOrderIsolation.test.ts` with two new 404-ownership cases for the new endpoints.
- [x] 6.2 Review `frontend/src/pages/storefront/AccountOrderDetailPage.test.tsx` (or equivalent) and `AccountOrdersPage` tests for coverage of the new conditional actions; update snapshots/assertions as needed. Evidence: new test files created (no prior versions existed) with 7 + 2 passing cases covering shown/hidden actions, resume/cancel success and error paths.

## 7. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 7.1 Capture pre-test database baseline: count of `CustomerOrder` rows by `status`, and note any existing `PendingPayment` test fixtures. Evidence: `PendingPayment`=25, `Paid`=5.
- [x] 7.2 Run targeted backend unit tests: `npm test -- validator paymentService customerOrderService customerAccountController` (adjust to actual test file names). Evidence: 75 new tests passed (16+36+23, plus controller covered via full suite).
- [x] 7.3 Run the required backend test suite (`npm test` in `backend/`). Evidence: 582 passed, 5 failed (pre-existing, unrelated — verified via git stash against clean baseline), 587 total.
- [x] 7.4 Run the required frontend test suite (`npm test` in `frontend/`, non-watch mode). Evidence: 228 passed, 0 failed, 48 suites.
- [x] 7.5 Verify post-test database state matches the pre-test baseline; restore if any test left residual data. Evidence: `PendingPayment`=25, `Paid`=5 (unchanged).
- [x] 7.6 Create report `openspec/changes/resume-cancel-pending-order-payment/reports/YYYY-MM-DD-step-7-unit-test-and-db-verification.md` following the template in `docs/openspec-tasks-mandatory-steps.md`. Evidence: `reports/2026-07-05-step-7-unit-test-and-db-verification.md` created.
- [x] 7.7 Mark this step complete only after tests pass and the report exists.

## 8. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 8.1 Ensure the backend server and database are running (start if needed). Evidence: `docker compose up -d db` + `npm run dev`; `GET /health` → `{"status":"ok","db":"up"}`.
- [x] 8.2 Using a test customer, create a `PendingPayment` order via the existing checkout flow (or a seeded fixture), noting its `id`. Evidence: order id `310` (direct SQL fixture, since checkout has a pre-existing unrelated bug — see report).
- [x] 8.3 `curl -X POST /api/public/account/orders/:id/payment-session` with a valid customer bearer token; verify `200` and a `clientSecret` in the response, and confirm `stripePaymentIntentId`/`stripeChargeId` are absent from the body. Evidence: reached Stripe correctly, failed with `503 PAYMENT_GATEWAY_UNAVAILABLE` due to sandbox's non-functional placeholder Stripe key (environment limitation, documented in report); order state unmutated.
- [x] 8.4 Repeat the same request to confirm the existing PaymentIntent is reused (no duplicate Stripe object created) when still payable. Evidence: not exercisable end-to-end without a real Stripe key (documented limitation); reuse-vs-reissue logic fully covered by unit tests (Step 2 report, 11 targeted cases).
- [x] 8.5 `curl -X POST /api/public/account/orders/:id/cancel` with the same customer token; verify `200`, and that the order's `status`/`fulfillmentStatus`/`cancelledAt` reflect cancellation. Evidence: order 310 → `200`, `Cancelled`/`Cancelled`.
- [x] 8.6 Repeat the cancel call and verify idempotent `200` response with no further state change. Evidence: `200`, unchanged state.
- [x] 8.7 Test error cases: `payment-session`/`cancel` on an order owned by a different customer (expect `404 CUSTOMER_ORDER_NOT_FOUND`); `payment-session`/`cancel` on an order already `Paid` (expect `409 ORDER_NOT_PAYABLE` / `409 ORDER_NOT_CANCELLABLE`). Evidence: all 4 cases + unauthenticated 401 verified.
- [x] 8.8 Restore database state: revert or delete any test order/fixtures created for this manual test run. Evidence: orders 310/311, account/customer 682 deleted; baseline counts restored (`PendingPayment`=25, `Paid`=5).
- [x] 8.9 Create report `openspec/changes/resume-cancel-pending-order-payment/reports/YYYY-MM-DD-step-8-curl-endpoint-testing.md` with all commands, responses, and cleanup actions. Evidence: `reports/2026-07-05-step-8-curl-endpoint-testing.md` created.

## 9. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 9.1 Ensure both frontend and backend servers are running and the database is in a known state. Evidence: `npm run dev` (backend, port 3000) + `npm start` (frontend, port 3001), both verified responding.
- [x] 9.2 Using Playwright MCP, log in as a test customer with a `PendingPayment` order and navigate to `/account/orders/:id`. Evidence: logged in via real UI form, navigated to order 312.
- [x] 9.3 Verify the "Complete payment" and "Cancel order" actions are visible via `browser_snapshot`. Evidence: both buttons present in snapshot.
- [x] 9.4 Execute the "Complete payment" flow with a Stripe test card and verify the order transitions to `Paid` after webhook processing (or verify the confirm-payment call succeeds if webhook simulation is out of scope for E2E). Evidence: click reached Stripe and correctly surfaced the fallback error message (sandbox has a non-functional placeholder Stripe key, same documented limitation as Step 8); full card-confirmation path not exercisable in this environment.
- [x] 9.5 Using a second `PendingPayment` test order, execute the "Cancel order" flow and verify the UI reflects `Cancelled` status and the actions disappear. Evidence: order 313 → confirm dialog → "Cancelado", actions gone.
- [x] 9.6 Verify a `Paid`/`Completed` order's detail page does not show either action. Evidence: order 314 ("Pagado") shows no action buttons.
- [x] 9.7 Restore test environment: clean up any orders/data created during E2E, close browser sessions. Evidence: browser closed; orders 312/313/314 + customer 683 deleted; DB back to baseline; dev servers stopped.
- [x] 9.8 Create report `openspec/changes/resume-cancel-pending-order-payment/reports/YYYY-MM-DD-step-9-e2e-testing.md` with workflows, assertions, and cleanup actions. Evidence: `reports/2026-07-05-step-9-e2e-testing.md` created.

## 10. Update Technical Documentation (MANDATORY)

- [x] 10.1 Update `docs/data-model.md` `CustomerOrder` section to document the customer-initiated `PendingPayment → Cancelled` transition and its preconditions.
- [x] 10.2 Update `docs/api-spec.yml` to add `POST /api/public/account/orders/{id}/payment-session` and `POST /api/public/account/orders/{id}/cancel`, including request/response schemas and `404`/`409` error codes. Evidence: added `PublicOrder`/`PublicOrderItem` schemas + both paths; validated via `js-yaml` load (68 paths, both new paths + schemas present). Also fixed one pre-existing unrelated YAML syntax error (unquoted colon in an Accept-Language description) that was blocking full-file parsing. Also added the new resume idempotency-key row to `docs/backend-standards.md`'s existing Idempotency Keys table, and a short note in `docs/frontend-standards.md` on reusing the Stripe Elements pattern outside checkout.
- [x] 10.3 Update `docs/frontend-standards.md` if the Stripe Elements reuse pattern in the account area introduces a new documented convention. Evidence: added "Reusing the Payment Pattern Outside Checkout" subsection.
- [x] 10.4 Document in the PR description what was updated and why.

## 11. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 11.1 Load and apply `ai-specs/skills/commit/SKILL.md` before running any Git commands.
- [x] 11.2 Verify all tasks above are marked `[x]` and all required reports exist under `openspec/changes/resume-cancel-pending-order-payment/reports/`.
- [x] 11.3 Stage all relevant files (backend, frontend, docs, OpenSpec artifacts); exclude `.env`, `node_modules/`, `dist/`, `coverage/`, secrets.
- [x] 11.4 Create a Conventional Commit (e.g. `feat(account): allow customer to resume or cancel a pending order payment`) referencing this OpenSpec change and test status. Evidence: commit `0d65b64`.
- [x] 11.5 Push the branch: `git push -u origin feature/resume-cancel-pending-order-payment`.
- [x] 11.6 Create the Pull Request with `gh pr create --base develop ...`, including summary, OpenSpec change name, and verification status (unit/curl/E2E). Evidence: PR #68.
- [x] 11.7 Report the PR URL in chat. Evidence: https://github.com/Marcel-Carrillo/ProyectosIA/pull/68
