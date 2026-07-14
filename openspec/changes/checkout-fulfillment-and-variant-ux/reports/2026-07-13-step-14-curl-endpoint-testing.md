# Step 14 Report - Manual Endpoint Testing with curl

- Date: 2026-07-13
- Change: checkout-fulfillment-and-variant-ux
- Agent: Claude Code (Sonnet 5)

## Environment Setup

The docker-compose `backend` service failed to start after being rebuilt with the new Prisma schema: its `predev` npm script (`sync:api-spec`) copies `../docs/api-spec.yml` into `src/api-spec.yml`, but the Docker build context is `./backend` only, so `docs/` does not exist inside the container — this is a **pre-existing bug in the docker-compose dev setup**, unrelated to this change (confirmed via `git log` that this script predates this branch). Worked around by running the backend directly on the host via `npm run dev` (port 3000), against the same Postgres container (`ecommerce-db`, port 5432 published to the host) used by the rest of the stack. The Docker image itself was rebuilt (`docker compose build backend`) so its baked-in `prisma/schema.prisma` and generated Prisma Client reflect this change's migration; that step is unaffected by the `predev` bug and remains useful for any future container-based run once the bug is fixed separately.

Backend health check: `GET /health` → `200`.

## Commands Executed and Results

### Admin authentication
```
POST /api/admin/auth/login {"email":"admin@example.com","password":"AdminPass1"}
→ 200, accessToken obtained
```

### Shipping margin guardrail (`AutomationSettings`)
```
GET /api/admin/settings/automation
→ 200 {"id":1,"targetMargin":5,"defaultFreightDestinationCountry":"ES","carrierAllowList":[]}
  (singleton row lazily created with schema defaults on first read — confirmed)

PATCH /api/admin/settings/automation {"targetMargin": 8}
→ 200 {"...,"targetMargin":8,...}

PATCH /api/admin/settings/automation {"targetMargin": 5}
→ 200 (restored to original default)
```

### Stock-aware public/admin variant responses
```
GET /api/public/products?pageSize=1
→ 200, variants[].stockQuantity present (0), no supplierCost/supplierId

GET /api/public/products/120
→ 200, stockQuantity present: true; supplierCost/supplierId/shippingCostEstimate leaked: false (all confirmed via full-payload substring search)

GET /api/admin/products/120/variants
→ 200, variant includes stockQuantity, shippingCostEstimate, shippingEstimateMissing, netMargin, marginWarning
  (stockQuantity=0, shippingCostEstimate=null, shippingEstimateMissing=true, netMargin=165 [=publicPrice-0-0], marginWarning=false)

PATCH /api/admin/products/120/variants/1549 {"stockQuantity": 999}
→ 200, response stockQuantity still 0 — read-only guarantee confirmed live (client-supplied value silently ignored)

POST /api/admin/products/120/variants/1549/freight-estimate {}
→ 422 CJ_ITEM_NOT_MAPPED (variant has no linked CjCatalogItem in this dev DB — correct error path)
```

### Self-service address book (`/api/public/account/addresses`)
```
POST /api/public/auth/register (new test customer, id 1577)
GET /api/public/account/addresses → 200, []

POST .../addresses {"type":"Shipping","isDefault":true,...} (address id 4)
→ 201, isDefault: true

POST .../addresses {"type":"Shipping","isDefault":true,...} (address id 5)
→ 201, isDefault: true

GET .../addresses
→ 200, address 4 now isDefault:false, address 5 isDefault:true
  — one-default-per-type invariant confirmed live under the self-service path

PATCH .../addresses/4 {"city":"Barcelona"}
→ 200, partial update applied

Registered a second customer (id != 1577) and attempted:
PATCH /api/public/account/addresses/4 (as the second customer)
→ 404 ADDRESS_NOT_FOUND — cross-customer isolation confirmed live

DELETE .../addresses/4 → 204
DELETE .../addresses/5 → 204
```

### Admin address book (`/api/admin/customers/:id/addresses`) — isDefault parity
```
POST /api/admin/customers/1577/addresses {"type":"Billing","isDefault":true,...} (id 6)
→ 201, isDefault: true

POST /api/admin/customers/1577/addresses {"type":"Billing","isDefault":true,...} (id 7)
→ 201, isDefault: true

GET /api/admin/customers/1577
→ 200, addresses[]: id 6 isDefault:false, id 7 isDefault:true
  — same invariant enforced identically on the admin path, confirmed live

DELETE /api/admin/customers/1577/addresses/6 → 204
DELETE /api/admin/customers/1577/addresses/7 → 204
```

### CJ push error paths
```
POST /api/admin/supplier-orders/3/cj/freight-quote
→ 404 CJ_CONNECTION_NOT_FOUND (supplier 3 has no CJ integration configured in this dev DB)

Simulated an already-pushed order via direct SQL (UPDATE "SupplierOrder" SET "externalOrderId"='curl-test-fake-id' WHERE id=3), then:
POST /api/admin/supplier-orders/3/cj/push {}
→ 409 CJ_ORDER_ALREADY_PUSHED
Reverted via SQL immediately after (externalOrderId back to NULL) — confirmed reverted.

GET /api/admin/supplier-orders/2/cj/order (never pushed)
→ 422 CJ_ORDER_NOT_PUSHED
```

### Fulfillment automation alerts
```
GET /api/admin/fulfillment-automation/alerts (authenticated)
→ 200 {"items":[],"total":0,"page":1,"pageSize":20}

GET /api/admin/fulfillment-automation/alerts (no token)
→ 401 UNAUTHORIZED
```

### Automatic fulfillment chain (direct service invocation against the real DB)

Full end-to-end via a real Stripe webhook was not exercised (would require a valid Stripe test signature and this dev environment's Stripe keys are for a different sandbox) — instead verified `fulfillmentAutomationService` and the scheduled job directly against real data with `FULFILLMENT_AUTOMATION_ENABLED=true`, via a temporary `scripts/curlTest*.ts` file deleted immediately after each run (not committed):

```
fulfillmentAutomationService.runForPaidOrder(271) — an already-Fulfilled order
→ isEnabled: true; 0 supplier orders created (idempotent no-op, no items left unfulfilled); no alert recorded

fulfillmentAutomationService.runForPaidOrder(345) — a Paid order with 1 pre-existing supplier order (supplierId 14, no CJ integration)
→ isEnabled: true; existing supplier order returned, no duplicate created; CJ push correctly skipped
  (supplier 14 has no SupplierIntegration row — the "only push for Connected CJDropshipping suppliers" guard confirmed live); no alert recorded (correctly not an error case)

cjOrderStatusSyncHandler.handler() with FULFILLMENT_AUTOMATION_ENABLED=true
→ {"enabled":true,"processed":0,"updated":0,"skipped":0,"failed":0} — correctly finds 0 candidates
  (no SupplierOrder in this dev DB has a non-null externalOrderId after the CJ-push test above was reverted)
```

## Database State Restoration

- All addresses created during self-service and admin testing (ids 4, 5, 6, 7): **deleted**.
- Supplier order 3's simulated `externalOrderId`/`externalProvider`: **reverted to NULL**.
- `AutomationSettings.targetMargin`: **restored** to its original default (5).
- `AutomationSettings` row count went from 0 → 1: **intentional, not reverted** — this is the feature's documented lazy-provisioning behavior (`GET` creates the singleton row with schema defaults on first read), not a test artifact. Reverting it would misrepresent the feature as broken.
- Two test `CustomerAccount`/`Customer` records were created via self-registration (ids 1144/1577 and one more for the cross-customer-isolation test) to exercise the address-book auth boundary. Attempting `DELETE /api/admin/customers/:id` on one of them surfaced a **pre-existing bug**, unrelated to this change: `CustomerRepository.delete()` calls a bare `prisma.customer.delete()` with no cascade/pre-delete for the `CustomerAccount` row, so deleting any self-registered customer (one with a `CustomerAccount`) fails with a `CustomerAccount_customerId_fkey` constraint violation (500 `INTERNAL_ERROR`). Confirmed via server logs this is not related to any file touched by this change. The two test customer rows were left in the dev database (harmless test data, consistent with the many other pre-existing customer/order fixtures already in this shared dev DB) since they could not be cleanly removed through the API and this change does not touch `customerController.ts`'s delete path. Flagged here for a separate follow-up fix, not addressed in this change to avoid unrelated scope creep.

## Outcome

- Step 14 status: **PASS**
- Blocking issues: none introduced by this change.
- Pre-existing issues discovered and documented (not fixed, out of scope): (1) docker-compose backend `predev` script assumes a bind-mounted `docs/` folder that isn't part of the build context; (2) `DELETE /api/admin/customers/:id` 500s for any customer with a `CustomerAccount` row due to a missing cascade/pre-delete step.
