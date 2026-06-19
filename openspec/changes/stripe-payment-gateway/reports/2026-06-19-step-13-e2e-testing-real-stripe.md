# Step 13 — E2E Testing with Playwright (Real Stripe Keys)

**Date:** 2026-06-19
**Change:** stripe-payment-gateway
**Environment:** Frontend http://localhost:3001 · Backend http://localhost:3000 · Real Stripe test keys
**Test file:** `e2e/stripe-checkout.spec.ts`

## Command

```bash
npx playwright test e2e/stripe-checkout.spec.ts --project=chromium
```

**Result:** 3 passed (21.2s)

## 13.4 Success payment with card 4242 4242 4242 4242

- Catalog → product → cart → guest checkout → payment step
- Stripe Payment Element: Card tab selected, card `4242 4242 4242 4242`, exp `12/34`, CVC `123`
- `Pay now` → navigation to `/order-confirmation/:orderNumber`

## 13.5 Polling begins

- Confirmation page shows `data-testid="payment-polling"` spinner ("Confirming payment…")

## 13.6 paymentStatus = Paid + success UI

- After client-side payment success, test fires signed `payment_intent.succeeded` webhook (local `STRIPE_WEBHOOK_SECRET`)
- New public endpoint `GET /api/public/payments/orders/:orderNumber/payment-status` enables guest polling
- Confirmation page shows `data-testid="payment-success"` within 15 s

## 13.7 Declined card 4000 0000 0000 9995

- Payment step shows `data-testid="payment-error"` with Stripe decline message
- `Pay now` button remains enabled for retry

## 13.8 No secret key in network

- Covered in prior report; re-verified during E2E run (config returns `pk_test_*` only)

## 13.9 Cleanup

- `afterEach` deletes test orders via Prisma (refunds + webhook events + order)

## Result: PASS
