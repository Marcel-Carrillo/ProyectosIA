## Why

Today, when a customer starts checkout but does not complete payment (closes the tab, a card declines, a wallet redirect like Google Pay/PayPal is cancelled), the resulting `CustomerOrder` is stuck permanently in `status: PendingPayment`. The Stripe `clientSecret` only lives in transient React state during checkout and is never persisted in a recoverable way, so the customer has no way to resume that same order's payment (they would have to rebuild the cart and create a duplicate order) or to cancel it themselves. The only existing cancellation path is the admin panel (`PATCH /api/admin/customer-orders/:id/status`). This change recovers otherwise-lost conversions and gives customers self-service control over abandoned pending orders, reducing manual admin cleanup.

## What Changes

- Add a customer-facing endpoint to resume payment on an existing `PendingPayment` order: reuse the existing Stripe PaymentIntent if it is still payable, or reissue a new one if it expired/was cancelled, and return a fresh `clientSecret`.
- Add a customer-facing endpoint to cancel an order while it is still `PendingPayment`, setting `status = Cancelled`, `fulfillmentStatus = Cancelled`, `cancelledAt = now()`, and cancelling the associated Stripe PaymentIntent.
- Both actions are restricted to the order's owning authenticated customer and only apply while `status = PendingPayment` and `paymentStatus ≠ Paid`.
- Add a transactional re-check of `paymentStatus` before cancelling, to protect against a race with the `payment_intent.succeeded` webhook (an order that has just been paid must not be cancelled).
- Update `AccountOrderDetailPage` to show "Complete payment" and "Cancel order" actions only when the order is `PendingPayment`, reusing the existing Stripe `PaymentForm` component for the resume flow.
- Add a "Payment pending" indicator/quick action on `AccountOrdersPage` linking to the order detail page.
- Add ES/EN i18n strings for the new actions and their confirmation/error messages.

Out of scope for this change (explicitly not included):
- Guest (unauthenticated) orders — resume/cancel for guest checkout orders is a follow-up that would require an email + signed token flow.
- Automatic expiration of stale pending orders via a scheduled job.
- Retry flow from a `paymentStatus: Failed` order in order history beyond what resume already covers.

## Capabilities

### New Capabilities
- `pending-order-payment-actions`: Customer-facing ability to resume payment or cancel an order that is in `PendingPayment` status, including ownership checks, Stripe PaymentIntent reuse/reissue, and the webhook-race safeguard on cancellation.

### Modified Capabilities
(none — no existing `openspec/specs/` capabilities exist yet for this project)

## Impact

- **Affected code**: `backend/src/application/services/paymentService.ts`, `backend/src/application/services/customerOrderService.ts` (or a new order-payment-session service), `backend/src/presentation/controllers/customerAccountController.ts`, `backend/src/routes/public/accountRoutes.ts`, `backend/src/application/validator.ts`, `frontend/src/services/customerAuthService.ts`, `frontend/src/pages/storefront/AccountOrderDetailPage.tsx`, `frontend/src/pages/storefront/AccountOrdersPage.tsx`, `frontend/src/i18n/locales/{es,en}/account.json`.
- **Affected APIs**: two new endpoints under `/api/public/account/orders/:id/` (`payment-session`, `cancel`), protected by `requireCustomerAuth` and `accountLimiter`.
- **Data model**: no schema changes required — all fields (`status`, `fulfillmentStatus`, `cancelledAt`, `stripePaymentIntentId`) already exist. Only the documented state-transition rules in `docs/data-model.md` change (customer-initiated `PendingPayment → Cancelled`).
- **Customer-facing vs internal**: primarily customer-facing (new self-service actions in the account area). No impact on supplier order generation or fulfillment status transitions, since a `PendingPayment` order never generates supplier orders.
- **Dependencies**: Stripe PaymentIntents API (retrieve, create, cancel); existing webhook handler in `paymentService.ts` remains the single source of truth for marking an order `Paid`.
