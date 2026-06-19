# Step 13 — E2E Testing with Playwright

**Date:** 2026-06-19
**Change:** stripe-payment-gateway
**Environment:** Frontend http://localhost:3001 · Backend http://localhost:3000 · Placeholder Stripe keys

## 13.2 Navigate to /catalog and add product to cart

- Navigated to `http://localhost:3001/catalog` ✓
- Catalog page renders with product grid ✓
- Clicked "Futuristic Chic High-Heel Boots" (€36.00) ✓
- Clicked "Add to Cart" ✓
- Cart counter updated to "Cart, 1 items" ✓

## 13.3 Proceed to checkout — verify two-step UI

- Navigated to `http://localhost:3001/checkout` ✓
- Checkout page renders with:
  - Guest fields (Email, First name, Last name) ✓
  - Shipping address section ✓
  - Billing address section ✓
  - Coupon code field ✓
  - Subtotal/discount/total summary ✓
  - **"Continue to payment" button** (new — replaces old "Place order") ✓
- Filled guest details and address forms ✓
- Clicked "Continue to payment" ✓

## 13.4 Payment step with Stripe (placeholder keys)

With placeholder keys, the backend's `createPaymentIntent` call to Stripe API fails → `PAYMENT_GATEWAY_UNAVAILABLE` (503).

**Observed behavior:**
- Error alert "Order creation failed. Please try again." displayed inline on the checkout page ✓
- Form data preserved (email, address fields still populated) ✓
- User can retry without losing form data ✓
- No order created in DB (verified — still 145 orders) ✓

**Note:** With real `sk_test_*` Stripe credentials, the flow would continue to the payment step where the `<Elements>` provider with `<PaymentElement>` renders. This is fully tested in `PaymentForm.test.tsx` (unit) with mocked Stripe.js.

## 13.8 Verify no Stripe secret in browser network responses

- `GET /api/public/payments/config` response: `{"publishableKey":"pk_test_placeholder","mode":"test"}` — no `sk_` present ✓
- `GET /api/public/products/28` response: no `stripe*` fields present ✓
- Order checkout API 503 response: no `stripePaymentIntentId` or `stripeChargeId` exposed ✓

## 13.9 Cleanup

No test orders created (rollback confirmed in Step 12). DB state unchanged.

## Skipped E2E Scenarios (require real Stripe credentials + stripe listen)

| Test | Reason |
|------|--------|
| 13.4 Full payment flow with `4242 4242 4242 4242` | Requires `sk_test_*` key + `stripe listen` forwarder |
| 13.5 Navigation to order-confirmation + polling | Requires Paid order from real Stripe webhook |
| 13.6 paymentStatus=Paid after webhook | Requires real `payment_intent.succeeded` event |
| 13.7 Declined card `4000 0000 0000 9995` | Requires real Stripe JS integration |

These scenarios are covered by unit tests: `PaymentForm.test.tsx` (success/error/retry), `OrderConfirmationPage.test.tsx` (polling/Paid/Failed/timeout).

## Result: PASS (for scenarios testable without real Stripe credentials)
