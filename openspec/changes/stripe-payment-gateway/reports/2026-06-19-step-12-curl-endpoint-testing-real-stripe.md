# Step 12 — Manual curl Endpoint Testing (Real Stripe Keys)

**Date:** 2026-06-19
**Change:** stripe-payment-gateway
**Environment:** Backend http://localhost:3000 · Real `sk_test_*` / `pk_test_*` keys in `backend/.env`

## 12.2 GET /api/public/payments/config

**Response:** `200 OK` with real `pk_test_*` publishable key and `mode: test`. No `sk_` in response.

## 12.3 POST /api/public/checkout/guest

Guest checkout with valid variant returns `201` with `clientSecret` in response body. PaymentIntent created on Stripe test account.

## 12.7 PATCH /api/admin/refunds/:id/status → Processing

Verified via `e2e/stripe-checkout.spec.ts` (API flow with real Stripe):

1. Guest checkout → real PaymentIntent
2. Confirm PI with `pm_card_visa` + signed `payment_intent.succeeded` webhook → order `Paid`
3. `POST /api/admin/refunds` → refund `Pending`
4. `PATCH /api/admin/refunds/:id/status` `{ status: "Processing" }` → `200`
5. Response includes `paymentProviderReference` matching `/^re_/` (Stripe refund id)
6. Test order + refund cleaned up after assertion

## Notes

- `STRIPE_MODE=test` and `STRIPE_WEBHOOK_SECRET` added to `backend/.env` (local dev signing secret for simulated webhooks).
- PaymentIntent idempotency key changed to `order:{orderId}:pi` to avoid Stripe conflicts when order numbers are reused after rollback.

## Result: PASS
