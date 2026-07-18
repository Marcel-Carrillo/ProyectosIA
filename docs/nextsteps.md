# Next Steps — Scalability Backlog

Findings from the 2026-07-18 load-readiness review ("can the store handle ~500
concurrent users browsing and buying?"). The first finding was fixed
immediately; the rest are documented here and intentionally left on standby
until traffic justifies them.

## Done

### 1. Order number generation race condition — FIXED

`CustomerOrderRepository.generateNextOrderNumber()` used a
`SELECT MAX(orderNumber) + 1` scan computed outside the order-creation
transaction, so two simultaneous checkouts could compute the same number and
the second insert failed on the `orderNumber` unique constraint (HTTP 500 for
the customer at the payment step).

Fixed by an atomic Postgres sequence (`customer_order_number_seq`), seeded
from the highest existing `ORD-*` number in migration
`20260718090000_add_customer_order_number_sequence`. Note: numbers may now
skip values when a checkout rolls back after a Stripe failure — acceptable,
order numbers are customer references, not invoice numbers.

## Standby

### 2. Database connection exhaustion under Lambda burst (highest impact)

Each warm Lambda instance opens its own Prisma connection pool. Under a
traffic spike, N concurrent instances x pool size can exceed RDS
`max_connections` (~85 on t3.micro, ~170 on t3.small), producing
"too many connections" failures. There are already live signs of DB pressure:
"Transaction already closed" errors observed against RDS (see comment in
`backend/src/application/services/cjCatalogPromotionService.ts`).

Actions:

- Verify the `connection_limit` parameter currently set in the production
  `DATABASE_URL` (SSM `/ecommerce/prod/DATABASE_URL`) and the RDS instance
  class / `max_connections`.
- Put RDS Proxy (or PgBouncer) between Lambda and Postgres so connections are
  pooled across Lambda instances.
- Re-check the two scheduled jobs' pool usage after the change (they rely on
  a generous `connection_limit`, see
  `backend/src/application/services/supplierAutoProvisionService.ts`).

### 3. Rate limiters are in-memory and per-Lambda-instance

All `express-rate-limit` limiters (checkout 50/15min, auth 100/15min, admin
login 30/15min, etc.) keep counters in instance memory. With many concurrent
Lambda instances the effective limit multiplies by instance count (weaker
protection than configured), and users behind a shared NAT can exhaust a
shared counter. Options: shared store (Redis/DynamoDB) for express-rate-limit,
or move throttling to API Gateway usage plans / AWS WAF rate rules.

### 4. Load test before any high-traffic campaign

Run k6/artillery against a staging environment focused on the checkout flow
(create order + PaymentIntent) to validate items 2-3 empirically and find the
next bottleneck. Target: ~500 virtual users, sustained 10-15 min.

### 5. Minor / accepted for now

- **Cold starts**: 1-3s on the first request of each new Lambda instance
  (bundle load + Prisma connect). Mitigable with provisioned concurrency if
  it ever matters commercially.
- **Payment webhook runs the fulfillment automation chain synchronously**
  (`paymentService` -> `fulfillmentAutomationService.runForPaidOrder`):
  supplier-order generation + CJ push extend webhook duration. Stripe
  tolerates it and the customer is unaffected; if CJ latency grows, move the
  chain to an async invocation (SQS/EventBridge).
- **No stock guard at checkout**: variants only need to be `Active`
  (`stockPolicy: SupplierManaged`) — no overselling lock contention, but the
  store can sell above CJ's last-synced stock. Accepted dropshipping
  trade-off; revisit if internal stock (`stockPolicy: Internal`) is adopted.
