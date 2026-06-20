## Context

The checkout service (`checkoutService.createOrder`) persists `CustomerOrder` in `status=PendingPayment` / `paymentStatus=Pending` but never collects money. This change wires Stripe as the sole payment processor for the MVP: card payments via PaymentIntents, webhook-driven status transitions, and admin refund synchronization.

Existing relevant infrastructure:
- `CustomerOrder` has `paymentStatus` enum (`Pending | Authorized | Paid | Failed | Refunded | PartiallyRefunded`) — all states needed exist.
- `Refund` has `paymentProviderReference` (max 150 chars) — reused for Stripe refund id.
- Express app uses global `express.json()` in `index.ts` — webhook raw body requires mounting order change.
- `Refund` state machine (`Pending → Processing → Completed | Failed | Cancelled`) is preserved; Stripe call is added on `Processing` or `Completed` depending on implementation (see Decision 3).

## Goals / Non-Goals

**Goals:**
- Create Stripe PaymentIntent at checkout; return `clientSecret` to the frontend.
- Secure publishable key delivery via `GET /api/public/payments/config`.
- Signature-verified, idempotent webhook handler for `payment_intent.succeeded`, `payment_intent.payment_failed`, and `charge.refunded`.
- Payment status transitions driven exclusively by verified webhook — never by client-side confirmation.
- Admin refund flow creates a Stripe refund via `stripe.refunds.create` before transitioning to `Completed`.
- `StripeWebhookEvent` model for idempotency and audit.
- Test/live mode switch via environment variables.

**Non-Goals:**
Saved cards, off-session/recurring payments, multi-currency, Apple/Google Pay, authorize-then-capture, automated retry UI, Stripe Tax, alternative payment methods (SEPA, Klarna), multi-provider abstraction layer, payment analytics dashboard.

## Decisions

### Decision 1 — Collect payment at checkout (not authorize-then-capture)

**Chosen:** Create the PaymentIntent with `capture_method=automatic` (default) immediately during checkout order creation. The intent is confirmed client-side by the buyer; funds are captured simultaneously.

**Alternative considered:** Authorize-only at checkout, capture when admin confirms the supplier order. Deferred: adds complexity without MVP benefit; manual supplier model means admins can cancel before capture, but the added state surface isn't worth it yet.

**Why:** Simpler flow, single backend call per checkout, no uncaptured auth management overhead, and the existing `paymentStatus` machine handles refunds well enough.

---

### Decision 2 — Webhook as sole authoritative signal for `Paid`

**Chosen:** The backend NEVER marks `status = Paid` based on a client-side confirmation result. Only a verified `payment_intent.succeeded` webhook triggers the `Pending → Paid` transition.

**Why:** Client-side confirmation result can be spoofed or dropped. The webhook is signed, delivered by Stripe's infrastructure, and retried on failure. This is the industry standard for fraud resistance.

**Implication:** On successful client-side confirmation the frontend navigates to a "processing" screen and polls `GET /api/public/account/orders/:id` (or the order confirmation page refreshes) until `paymentStatus = Paid`. Webhook latency is typically < 2 s.

---

### Decision 3 — Stripe refund created when refund transitions to `Processing`

**Chosen:** When an admin advances a refund from `Pending → Processing`, the service calls `stripe.refunds.create(...)` with idempotency key `refund:{refundId}` and stores the Stripe refund id in `paymentProviderReference`. If the Stripe call fails, the refund stays `Pending` and an error is returned.

**Alternative considered:** Create Stripe refund on `Completed`. Rejected: `Completed` represents "money returned"; creating the Stripe refund is the action that causes money to be returned. Triggering it at `Processing` aligns intent with action.

**Idempotency with `charge.refunded` webhook:** When Stripe delivers `charge.refunded`, the handler looks up the `Refund` by `paymentProviderReference`. If already `Completed`, it's a no-op; if `Processing`, it advances to `Completed`. This prevents double state transitions.

---

### Decision 4 — `StripeWebhookEvent` table for idempotency

**Chosen:** Persist each processed Stripe `event.id` in a `StripeWebhookEvent` table. Before processing, check existence; if found, return `200` immediately.

**Alternative considered:** In-memory dedup or Redis. Rejected: restarts lose in-memory state; Redis adds infra dependency. The DB approach is consistent with existing persistence patterns and survives Lambda cold-starts.

**Schema:** `id`, `stripeEventId @unique`, `type`, `customerOrderId (optional)`, `createdAt`.

---

### Decision 5 — Raw body middleware scoped to webhook route only

**Chosen:** In `index.ts`, mount `express.raw({ type: 'application/json' })` on the webhook route path (`/api/public/payments/webhook`) **before** the global `express.json()`. Achieved by adding the raw-body route import and registration prior to the `app.use(express.json())` line, or by using a path-specific middleware on the router.

**Why:** Stripe signature verification requires the original raw request body; `express.json()` replaces it with a parsed object. Scoping prevents side effects on other routes.

---

### Decision 6 — Publishable key via runtime config endpoint

**Chosen:** `GET /api/public/payments/config` returns `{ publishableKey, mode }`. The frontend calls this once at app start (or at checkout entry) and initializes `loadStripe(publishableKey)`.

**Alternative considered:** Build-time env injection (`REACT_APP_STRIPE_PUBLISHABLE_KEY`). Viable but couples the frontend build to the key; the config endpoint approach allows key rotation without a frontend redeploy.

---

### Decision 7 — EUR minor-unit conversion in shared helper

**Chosen:** A single `toStripeAmount(amount: Decimal, currency: string): number` helper converts Prisma `Decimal` to integer minor units using `Math.round(amount.times(100).toNumber())`. All callers use this helper.

**Why:** Prevents off-by-one rounding errors; centralized and unit-testable.

## Risks / Trade-offs

- **Webhook not received** → Order stuck in `PendingPayment`. Mitigation: Stripe retries for 3 days; expose a manual "Mark as Paid" admin action as a future fallback; alert on orders > N hours in `PendingPayment`.
- **Duplicate webhook delivery** → `StripeWebhookEvent` idempotency table prevents double-processing.
- **Raw-body middleware ordering regression** → Signature verification fails silently if `express.json()` runs first. Mitigation: integration test that sends a real Stripe test event with valid signature.
- **Secret key leakage** → Env validation at startup rejects missing keys; secrets never serialized in responses or logs; unit test asserts no `STRIPE_SECRET_KEY` appears in any response body.
- **Decimal rounding** → Covered by unit tests on `toStripeAmount` for edge values.
- **Stripe API downtime during checkout** → PaymentIntent creation failure returns `503 PAYMENT_GATEWAY_UNAVAILABLE`; order is not persisted (atomic: create order + create intent, rollback on Stripe error).
- **Refund Stripe call fails** → Refund stays `Pending`; error code `REFUND_STRIPE_ERROR` returned; admin can retry.

## Migration Plan

1. Add Prisma migration: `stripePaymentIntentId`, `stripeChargeId` on `CustomerOrder`; new `StripeWebhookEvent` model. Both new columns are nullable — zero downtime.
2. Deploy backend with Stripe integration behind `STRIPE_MODE=test`. All existing orders (no `stripePaymentIntentId`) are unaffected; webhook handler ignores events for unknown payment intents (logs warning, returns 200).
3. Deploy frontend with Stripe Elements payment step.
4. Register Stripe webhook endpoint in Stripe Dashboard (test mode); verify delivery.
5. Smoke test full checkout flow with test card `4242 4242 4242 4242`.
6. Switch to live keys (`STRIPE_MODE=live`) at go-live.

**Rollback:** Revert backend + frontend deploy. Existing `CustomerOrder` rows with `stripePaymentIntentId` are benign; new orders fall back to `PendingPayment` without capture. Rollback the Stripe migration only if needed (columns are nullable, so the app runs without them).

## Open Questions

1. ~~Collect-at-checkout vs authorize/capture~~ — resolved: collect at checkout (Decision 1).
2. ~~`StripeWebhookEvent` audit table~~ — resolved: yes, include it (Decision 4).
3. ~~Publishable key delivery~~ — resolved: config endpoint (Decision 6).
4. Should a "Manual Mark as Paid" admin action be included in this change? (Recommended: no — defer to a future admin-tools change to keep scope focused.)
5. Frontend polling strategy for `Paid` confirmation — simple setTimeout loop on the order status endpoint, or WebSocket / SSE? (Recommended for MVP: poll `GET /api/public/account/orders` every 2 s, max 30 s, then show "payment processing — check your email" message.)
