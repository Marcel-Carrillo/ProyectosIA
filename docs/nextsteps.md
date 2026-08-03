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

## Security backlog

### 6. Restrict admin panel access to home IP only

Requested 2026-07-20. Today `/admin/*` (frontend SPA route, no data exposure
by itself) and `/api/admin/*` (all real admin endpoints, mounted in
`backend/src/index.ts:134` and `:155`) are reachable from anywhere on the
internet, protected only by the `ADMIN_JWT_SECRET` login. Goal: add a
network-level layer so the admin API is only reachable from the user's home
IP, without adding a fixed recurring cost (ruled out AWS WAF — ~$5-6/mo per
Web ACL — for this reason).

Chosen design (not yet implemented):

- **API Gateway resource policy** on `g54xfd8lja`, scoped to the
  `/api/admin/*` methods only, with an `aws:SourceIp` deny-by-default
  condition. Resource policies are a native, free feature of API Gateway
  (no WAF needed). Public storefront routes stay untouched.
- **Home IP is dynamic** (changes often), so a static IP in the policy would
  break silently. Mitigation: a free DDNS hostname (DuckDNS or No-IP) updated
  by the home router's built-in DDNS client (most consumer routers support
  this natively — no extra software to run at home).
- **Sync Lambda**: a new scheduled Lambda (EventBridge rate, e.g. every
  10-15 min — same pattern as `supplierAutoProvision` /
  `cjOrderStatusSync`) resolves the DDNS hostname, compares it to the IP
  currently baked into the resource policy, and if it changed, calls
  `aws apigateway update-rest-api` to patch the policy and redeploys the
  `prod` stage (required for a resource policy change to take effect; brief,
  no downtime for the rest of the API). Cost: effectively $0 at this
  invocation volume, same as the two existing scheduled jobs.
- Optional, cosmetic: a CloudFront Function (no fixed fee, ~$0.10/million
  invocations) applying the same IP check to the `/admin` SPA route. Low
  priority since the SPA bundle itself carries no admin data.
- The existing JWT admin login stays as-is — this is defense in depth on top
  of it, not a replacement.

Considered and rejected:

- **AWS WAF IP set**: same outcome, but ~$5-6/mo fixed Web ACL fee just for
  this.
- **Real VPN/tunnel (Cloudflare Tunnel, WireGuard)**: would fully hide the
  admin surface regardless of source IP, but needs a persistent process
  (EC2 or an always-on box at home) — heavier than justified right now for a
  single-admin store on a cost-conscious serverless stack.

Needs from the user before implementation: a free DDNS account (DuckDNS
suggested) and the home router's DDNS hostname configured — or, if the
router doesn't support DDNS, a lightweight alternative to design.
