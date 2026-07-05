## Context

`checkoutService.createOrder` creates a `CustomerOrder` (`status: PendingPayment`, `paymentStatus: Pending`) together with a Stripe PaymentIntent, and returns a `clientSecret` to the frontend (`backend/src/application/services/checkoutService.ts`). That `clientSecret` only lives in `CheckoutPage.tsx` React state — it is never persisted or recoverable. `paymentStatus` only ever transitions via Stripe webhooks (`payment_intent.succeeded` / `payment_intent.payment_failed`) in `paymentService.ts`. The account area (`accountRoutes.ts`, `AccountOrderDetailPage.tsx`) is currently read-only: `GET /orders` and `GET /orders/:id` only. The only existing cancellation path is the admin endpoint `PATCH /api/admin/customer-orders/:id/status`, and `validator.ts` does not currently restrict `PendingPayment → Cancelled`.

This design adds two new customer-facing, ownership-scoped endpoints so a customer can act on their own `PendingPayment` order without involving an admin.

## Goals / Non-Goals

**Goals:**
- Let an authenticated customer resume payment on their own `PendingPayment` order by retrieving a valid `clientSecret`, reusing the existing Stripe PaymentIntent when possible and reissuing one when it is no longer usable.
- Let an authenticated customer cancel their own `PendingPayment` order, releasing it from limbo without admin intervention.
- Guarantee the cancellation path cannot race the payment webhook: an order that has just been paid must never end up `Cancelled`.
- Keep `stripePaymentIntentId` / `stripeChargeId` internal-only in every response, per existing data-model rule.

**Non-Goals:**
- Guest/unauthenticated order resume or cancellation (needs an email + signed-token mechanism — follow-up change).
- Automatic expiration of stale pending orders via a scheduled job.
- Any change to how `paymentStatus` transitions to `Paid`/`Failed` — that remains exclusively webhook-driven.
- Any change to the Prisma schema — all required fields (`status`, `fulfillmentStatus`, `cancelledAt`, `stripePaymentIntentId`) already exist.

## Decisions

**1. Two separate endpoints instead of one combined "manage pending order" endpoint.**
`POST /api/public/account/orders/:id/payment-session` (resume) and `POST /api/public/account/orders/:id/cancel` are modeled as distinct actions with distinct preconditions and side effects, following the existing REST action-endpoint convention used elsewhere in `accountRoutes.ts` (e.g. `POST /account/reviews`). Alternative considered: a single `PATCH /orders/:id` with an `action` body field — rejected because it blurs two very different side-effect profiles (one talks to Stripe to create a payment intent, the other cancels one) and makes precondition error codes ambiguous.

**2. Resume reuses the existing PaymentIntent when possible; only reissues when necessary.**
On resume, retrieve the order's `stripePaymentIntentId` via `stripe.paymentIntents.retrieve`. If its status is one of `requires_payment_method | requires_confirmation | requires_action` and its `amount` still matches `order.totalAmount`, return its existing `client_secret` directly — this avoids creating orphaned PaymentIntents in Stripe for the common case (card declined, retried, or user simply reopened the tab). Only when the PI is `canceled`/missing/amount-mismatched do we create a new PaymentIntent (with idempotency key `order:${id}:pi:resume:${timestamp}`, distinct from the checkout-time key `order:${id}:pi`) and persist the new `stripePaymentIntentId`. Alternative considered: always reissue a fresh PaymentIntent on every resume — rejected as wasteful and because it complicates idempotency (a user re-clicking "Complete payment" would create a new Stripe object each time).

**3. Cancellation re-verifies `paymentStatus` inside a transaction immediately before mutating state (webhook race protection).**
Because `payment_intent.succeeded` is asynchronous and can arrive at any time, `cancelPendingOrder` must, inside a single Prisma transaction: (a) re-read the order's current `paymentStatus`, (b) abort with `409 ORDER_NOT_CANCELLABLE` if it is `Paid` (or any status other than `Pending`/`Failed`), (c) otherwise update `status = Cancelled`, `fulfillmentStatus = Cancelled`, `cancelledAt = now()`. The Stripe-side `paymentIntents.cancel` call happens after the DB transaction commits; if Stripe reports the PI as already captured/uncancellable, the order update is rolled back (compensating update back to `PendingPayment`) and `409` is returned. Alternative considered: cancel the Stripe PaymentIntent first, then update the DB — rejected because a Stripe-first approach risks the DB update failing after money has already been effectively locked/cancelled at Stripe, leaving the local order status wrong with no compensating action needed on Stripe's side (harder to reconcile than the chosen order).

**4. Ownership checks return `404`, not `403`, for orders belonging to another customer.**
This matches the existing pattern in `getOrderById` for the read-only account endpoints, avoiding order-existence enumeration by ID.

**5. Idempotent cancellation.**
If the order is already `Cancelled` when `cancel` is called again, the endpoint returns `200` with the current order state rather than an error — repeated clicks or retried requests must not fail.

**6. Reuse the existing `PaymentForm` / Stripe Elements component on the frontend.**
`AccountOrderDetailPage.tsx` mounts the same `PaymentForm` pattern already used in `CheckoutPage.tsx` (`stripe.confirmPayment`), fed with the `clientSecret` returned by the resume endpoint, instead of building a new payment UI.

## Risks / Trade-offs

- **[Risk] Webhook race: `payment_intent.succeeded` arrives between the client's cancel request and the DB transaction.** → Mitigation: transactional re-check of `paymentStatus` immediately before mutating (Decision 3); Stripe cancel-after-commit with compensating rollback if Stripe reports the PI as already captured.
- **[Risk] Duplicate/orphaned Stripe PaymentIntents from repeated resume calls.** → Mitigation: reuse the existing PI whenever it is still in a payable state (Decision 2); only reissue with a fresh idempotency key when necessary.
- **[Risk] Order enumeration by ID across customers.** → Mitigation: ownership check returns `404` for orders not owned by the caller, consistent with existing `getOrderById` behavior.
- **[Risk] Exposing internal Stripe identifiers.** → Mitigation: both endpoints return the order via the existing `toPublicOrder` mapper, which already omits `stripePaymentIntentId` / `stripeChargeId`.
- **[Trade-off] No automatic expiry of pending orders in this change.** Pending orders that the customer never touches again still accumulate. Accepted for MVP scope; flagged in the proposal as a follow-up (scheduled job).
- **[Trade-off] Rate limiting reuses the existing generic `accountLimiter` (200 req/15 min) rather than a dedicated limiter for payment actions.** Accepted since Stripe's own API is the primary rate-limited resource here, and per-account traffic on these two new routes is expected to be low volume.
