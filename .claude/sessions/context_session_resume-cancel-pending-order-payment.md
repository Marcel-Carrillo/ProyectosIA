# Context Session: resume-cancel-pending-order-payment

## Change location
`openspec/changes/resume-cancel-pending-order-payment/`

- Proposal: `openspec/changes/resume-cancel-pending-order-payment/proposal.md`
- Design: `openspec/changes/resume-cancel-pending-order-payment/design.md`
- Specs: `openspec/changes/resume-cancel-pending-order-payment/specs/pending-order-payment-actions/spec.md`
- Tasks: `openspec/changes/resume-cancel-pending-order-payment/tasks.md`

## Summary

Allow an authenticated customer to, on their own `CustomerOrder` while `status = PendingPayment`:
1. **Resume payment**: `POST /api/public/account/orders/:id/payment-session` — reuse the existing Stripe PaymentIntent if still payable (status `requires_payment_method`/`requires_confirmation`/`requires_action` and amount matches `totalAmount`), otherwise reissue a new one with a distinct idempotency key (`order:${id}:pi:resume:${timestamp}`). Returns `{ order, clientSecret }`. `404 CUSTOMER_ORDER_NOT_FOUND` for orders not owned by the caller; `409 ORDER_NOT_PAYABLE` when not payable.
2. **Cancel order**: `POST /api/public/account/orders/:id/cancel` — sets `status=Cancelled`, `fulfillmentStatus=Cancelled`, `cancelledAt=now()`, cancels the Stripe PaymentIntent. Re-verifies `paymentStatus` inside a Prisma transaction immediately before committing (protects against a race with the `payment_intent.succeeded` webhook — abort with `409 ORDER_NOT_CANCELLABLE` if already `Paid`). Idempotent if already `Cancelled`. Rolls back to prior status and returns `409` if Stripe reports the PI as already captured.

No Prisma schema changes needed — all fields (`status`, `fulfillmentStatus`, `cancelledAt`, `stripePaymentIntentId`) already exist.

## Key existing files (read before planning)

- `backend/src/application/services/checkoutService.ts` — how PaymentIntents are created at checkout (idempotency key pattern, `toStripeAmount` usage)
- `backend/src/application/services/paymentService.ts` — existing Stripe wrappers, webhook handling, `PaymentGatewayUnavailableError` pattern
- `backend/src/application/services/customerOrderService.ts` — where `getOrCreatePaymentSession`/`cancelPendingOrder` should live
- `backend/src/presentation/controllers/customerAccountController.ts` — existing `getOrderById`/`listOrders`, `toPublicOrder` mapper (never expose `stripePaymentIntentId`/`stripeChargeId`)
- `backend/src/routes/public/accountRoutes.ts` — existing `requireCustomerAuth` + `accountLimiter` wiring
- `backend/src/application/validator.ts` — where to add `validatePendingOrderPayable`/`validatePendingOrderCancellable`
- `backend/src/infrastructure/stripe/stripeClient.ts`, `backend/src/infrastructure/stripe/toStripeAmount.ts`
- `frontend/src/services/customerAuthService.ts` — where `getMyOrder`-style methods live; add `resumeOrderPayment`/`cancelOrder`
- `frontend/src/pages/storefront/AccountOrderDetailPage.tsx` — add conditional "Complete payment"/"Cancel order" actions
- `frontend/src/pages/storefront/AccountOrdersPage.tsx` — add "Payment pending" indicator
- `frontend/src/pages/storefront/CheckoutPage.tsx` — existing `PaymentForm`/Stripe Elements pattern to reuse (`stripe.confirmPayment`, `redirect: 'if_required'`)
- `frontend/src/i18n/locales/{es,en}/account.json` — new i18n keys

## Task list

Full task breakdown is in `tasks.md`. Planning agents should produce a **per-file implementation plan** (function signatures, test cases, error codes) for their layer — they do not write code themselves.
