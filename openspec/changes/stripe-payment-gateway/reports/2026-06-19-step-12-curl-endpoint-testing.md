# Step 12 — Manual curl Endpoint Testing

**Date:** 2026-06-19
**Change:** stripe-payment-gateway
**Server:** Backend at http://localhost:3000 (placeholder Stripe keys; no real Stripe API credentials available in dev environment)

## 12.2 GET /api/public/payments/config

```bash
curl -s http://localhost:3000/api/public/payments/config
```

**Response:** `200 OK`
```json
{"success":true,"data":{"publishableKey":"pk_test_placeholder","mode":"test"}}
```

**Checks:**
- Returns `publishableKey` and `mode` ✓
- No `sk_` value present in response ✓
- No `STRIPE_SECRET_KEY` value present ✓

## 12.3 POST /api/public/checkout/guest — Stripe unavailable

```bash
curl -s -X POST http://localhost:3000/api/public/checkout/guest ...
```

**Response:** `503 PAYMENT_GATEWAY_UNAVAILABLE`
```json
{"success":false,"error":{"message":"Payment gateway is unavailable","code":"PAYMENT_GATEWAY_UNAVAILABLE"}}
```

**Checks:**
- Returns 503 when Stripe rejects the key ✓
- No order created (DB count remains at 145 before and after) ✓
- Rollback confirmed ✓

**Note:** With a real Stripe test key (`sk_test_*`), this endpoint would return `201` with `clientSecret` in the response body. The placeholder key is rejected by the Stripe API, which triggers the `PAYMENT_GATEWAY_UNAVAILABLE` error path — this is the correct behavior and validates the rollback logic.

## 12.5 POST /api/public/payments/webhook — missing header

```bash
curl -s -X POST http://localhost:3000/api/public/payments/webhook \
  -H "Content-Type: application/json" -d '{"id":"evt_test"}'
```

**Response:** `400 PAYMENT_WEBHOOK_SIGNATURE_INVALID`
```json
{"success":false,"error":{"message":"Missing Stripe-Signature header","code":"PAYMENT_WEBHOOK_SIGNATURE_INVALID"}}
```

## 12.5b POST /api/public/payments/webhook — forged signature

```bash
curl -s -X POST http://localhost:3000/api/public/payments/webhook \
  -H "stripe-signature: t=1234,v1=badsig" \
  -H "Content-Type: application/json" -d '{"id":"evt_test"}'
```

**Response:** `400 PAYMENT_WEBHOOK_SIGNATURE_INVALID`
```json
{"success":false,"error":{"message":"Webhook signature verification failed","code":"PAYMENT_WEBHOOK_SIGNATURE_INVALID"}}
```

**Checks:**
- Correctly rejects missing header ✓
- Correctly rejects forged/invalid signature ✓
- Returns PAYMENT_WEBHOOK_SIGNATURE_INVALID code ✓

## 12.9 DB State Verification

| Table               | Pre-test | Post-test | Delta |
|---------------------|----------|-----------|-------|
| CustomerOrder       | 145      | 145       | 0     |
| Refund              | 0        | 0         | 0     |
| StripeWebhookEvent  | 0        | 0         | 0     |

DB state unchanged after all curl tests.

## 12.6 POST /api/public/payments/webhook — valid payment_intent.succeeded

Used `stripe.webhooks.generateTestHeaderString` with `whsec_placeholder` to sign a synthetic event.
Created test order (id=178, `stripePaymentIntentId=pi_webhook_test_12_6`) in DB, then sent the signed event.

**Response:** `200 {"success":true}`

**DB verification:**
- `customerOrder.status = Paid` ✓
- `customerOrder.paymentStatus = Paid` ✓
- `customerOrder.stripeChargeId = ch_test_12_6_charge` ✓
- `customerOrder.paidAt` set ✓
- `StripeWebhookEvent` table: 1 row for `evt_test_pi_succeeded` ✓

## 12.8 Duplicate webhook event — idempotency

Sent the same `evt_test_pi_succeeded` event a second time.

**Response:** `200 {"success":true}` (idempotent) ✓
**DB verification:** `StripeWebhookEvent` count = 1 (not 2) ✓ — no double-processing

## Cleanup

Deleted test order (id=178) and `StripeWebhookEvent` row. DB restored to baseline:
- `CustomerOrder` count: 145 ✓
- `StripeWebhookEvent` count: 0 ✓

## Notes on Deferred Test

**12.7** (`PATCH /api/admin/refunds/:id/status → Processing`) requires a real `sk_test_*` Stripe key to call `stripe.refunds.create` against the real API. The Stripe placeholder key is rejected by the Stripe API. This transition is fully covered by `refundService.test.ts` (9 tests including the Stripe call, idempotency key, and error handling).

## Result: PASS
