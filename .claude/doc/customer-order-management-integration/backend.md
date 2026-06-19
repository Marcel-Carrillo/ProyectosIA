# Backend Verification Plan — customer-order-management-integration (KAN-30)

Generated: 2026-06-19  
Jira: **KAN-30** (integration subtask of KAN-18)  
Branch: `feature/KAN-30-customer-order-management-integration`  
Session: `.claude/sessions/context_session_customer-order-management-integration.md`

---

## Mandate

**Verification-first.** KAN-28 (backend) and KAN-29 (frontend) already delivered the customer-order admin module on `master`. This plan certifies existing backend behavior against `openspec/specs/customer-order-management/spec.md`. **Do not add features, schema changes, or new endpoints** unless audit or curl/E2E surfaces a blocking defect.

Prior KAN-28 curl report (reference): `openspec/changes/archive/2026-06-19-customer-order-management-backend/reports/2026-06-19-step-4-curl-endpoint-testing.md`.

---

## Backend module inventory (audit targets)

| Layer | File | What to verify |
|-------|------|----------------|
| Wiring | `backend/src/index.ts` | `customerOrderAdminRoutes` mounted at `/api/admin/customer-orders` **after** `requireAdminAuth` (lines 71–77, 82) |
| Routes | `backend/src/routes/admin/customerOrderRoutes.ts` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id/status`, `POST /:id/supplier-orders` (supplier-orders is KAN-19 — out of KAN-30 curl scope unless audit gap) |
| Controller | `backend/src/presentation/controllers/customerOrderController.ts` | Thin handlers; list forwards all query params including `createdFrom`/`createdTo`; standard `{ success, data, message }` envelope |
| Service | `backend/src/application/services/customerOrderService.ts` | Snapshot resolution from variant `publicPrice`; server-side totals; `MAX_PAGE_SIZE = 100`; `paidAt`/`cancelledAt` side effects on status update |
| Validator | `backend/src/application/validator.ts` | `validateCustomerOrderCreateData`, `validateCustomerOrderStatusUpdate` — three independent dimensions; paid→PendingPayment blocked; cancelled fulfillment advance blocked |
| Domain | `backend/src/domain/models/customerOrder.ts` | Status unions; `CustomerOrder` / `CustomerOrderItem` entities |
| Domain | `backend/src/domain/repositories/customerOrderRepository.ts` | `CustomerOrderListFilters` includes `createdFrom`/`createdTo` |
| Infrastructure | `backend/src/infrastructure/repositories/customerOrderRepository.ts` | **`orderSelect` / `itemSelect` explicit allow-lists** — no `supplierId`, `supplierReference`, `supplierCost`; UTC day-bound date filters; list omits nested `items` |
| Errors | `backend/src/infrastructure/repositories/customerOrderRepository.ts` | `CustomerOrderNotFoundError` (404), transition errors (422) with stable `code` fields |
| Schema | `backend/prisma/schema.prisma` | `CustomerOrder`, `CustomerOrderItem` models exist; no migration expected for KAN-30 |

### Tests already in tree (do not rewrite unless gap found)

| File | Coverage |
|------|----------|
| `backend/src/application/services/__tests__/customerOrderService.test.ts` | create (snapshots, totals, 404 customer/variant), updateStatus |
| `backend/src/application/__tests__/validator.customerOrder.test.ts` | create validation, status transition rules |
| `backend/src/presentation/controllers/__tests__/customerOrderController.test.ts` | controller delegation, query param forwarding |
| `backend/src/infrastructure/repositories/__tests__/customerOrderRepository.dateFilter.test.ts` | `createdFrom`/`createdTo` Prisma `where.createdAt` bounds |
| `backend/src/routes/admin/__tests__/customerOrderIsolation.test.ts` | list response has no supplier keys |
| `backend/src/routes/public/__tests__/customerOrderIsolation.test.ts` | public surface isolation (related gate) |

---

## Step 1 — Audit checklist (tasks.md §1.1–1.6)

Execute **before** any code edits. Record pass/fail per row in the step-3 or a dedicated audit note inside the curl report.

### 1.1 Module presence and auth

- [ ] `GET /api/admin/customer-orders` without `Authorization` → **401** `UNAUTHORIZED`
- [ ] `GET /api/admin/customer-orders` with valid admin bearer → **200**
- [ ] No route registered at `GET /api/public/customer-orders` → **404**
- [ ] Legacy paths `/customer-orders` (no `/api/admin` prefix) — document whether still mounted; spec says superseded by admin paths (tasks §6.2)

### 1.2 Three status dimensions (independent)

- [ ] `PATCH /:id/status` with **only** `paymentStatus` leaves `status` and `fulfillmentStatus` unchanged
- [ ] `PATCH /:id/status` with **only** `fulfillmentStatus` leaves `status` and `paymentStatus` unchanged
- [ ] `PATCH /:id/status` with **only** `status` leaves other fields unchanged unless explicitly sent
- [ ] Validator enforces: paid order cannot revert to `PendingPayment` → **422** `ORDER_STATUS_TRANSITION_INVALID`
- [ ] Validator enforces: cancelled order cannot advance `fulfillmentStatus` → **422** `FULFILLMENT_STATUS_TRANSITION_INVALID`
- [ ] `paymentStatus: Paid` sets `paidAt` when previously null
- [ ] `status: Cancelled` sets `cancelledAt` when applicable (verify in curl on disposable order)

### 1.3 List filters and pagination

- [ ] Default `page=1`, `pageSize=20`, `sort=createdAt`, `order=desc`
- [ ] `pageSize=200` clamped to **100**
- [ ] Filters: `customerId`, `status`, `paymentStatus`, `fulfillmentStatus`, `search`
- [ ] Date range: `createdFrom=YYYY-MM-DD` and `createdTo=YYYY-MM-DD` (inclusive UTC day bounds)
- [ ] Sort: `sort=totalAmount|orderNumber`, `order=asc|desc`

### 1.4 Detail and create

- [ ] `GET /:id` returns items with snapshots (`productNameSnapshot`, `variantSnapshot`, `skuSnapshot`, `unitPrice`, `totalPrice`)
- [ ] `GET /:id` returns `shippingAddressSnapshot`, `billingAddressSnapshot`, customer ref (`id`, `firstName`, `lastName`, `email`)
- [ ] `GET /:id` missing → **404** `CUSTOMER_ORDER_NOT_FOUND`
- [ ] `POST /` creates with initial `status=PendingPayment`, `paymentStatus=Pending`, `fulfillmentStatus=NotStarted`
- [ ] `POST /` generates unique `orderNumber` (`ORD-######`)
- [ ] `POST /` missing customer → **404** `CUSTOMER_NOT_FOUND`; missing variant → **404** `VARIANT_NOT_FOUND`
- [ ] `POST /` `quantity <= 0` → **400** `VALIDATION_ERROR`

### 1.5 Supplier isolation (hard gate — D4)

- [ ] `orderSelect` and `itemSelect` in repository contain **no** supplier fields
- [ ] Service `variantSelectForOrder` uses `publicPrice` only (not `supplierCost`)
- [ ] Every curl response body (list, detail, create, patch) — grep for `supplierId|supplierReference|supplierCost` → **no matches**
- [ ] Unit test `customerOrderIsolation.test.ts` passes
- [ ] Confirm `ProductVariant` in DB has `supplierCost` populated (seed) so absence in API is meaningful, not vacuous

### 1.6 Audit outcome

- If **all pass**: proceed to unit tests and curl matrix; **no `backend/src/**` edits**.
- If **any fail**: apply minimal fix (see §Minimal fix scope) before continuing.

---

## Step 2 — Unit test commands

Run from repo root. Mark `tasks.md` §2.x only after commands exit 0.

### Targeted customer-order suite (tasks §2.1)

```bash
cd backend && npm run lint && npx jest --testPathPattern="customerOrder" --watchAll=false
```

Covers: `customerOrderService`, `customerOrderController`, `customerOrderRepository.dateFilter`, `customerOrderIsolation` (admin + public), `validator.customerOrder`.

### Supplier-isolation regression (tasks §2.3)

```bash
cd backend && npx jest src/routes/admin/__tests__/customerOrderIsolation.test.ts --watchAll=false
```

Assert: `JSON.stringify(res.body)` does not match `/supplierId|supplierReference|supplierCost/i`.

### Full backend gate (tasks §3.2–3.4)

```bash
cd backend && npm run lint
cd backend && npm test -- --watchAll=false
cd backend && npx tsc --noEmit
```

### ESLint / CI notes

- Prefix unused params with `_` (`@typescript-eslint/no-unused-vars`)
- No `any` in new test code
- Mirror existing `jest.mock()` at top + `beforeEach(() => jest.clearAllMocks())`
- New RTL is frontend scope; backend only updates tests if audit/curl reveals gaps

### Report

`openspec/changes/customer-order-management-integration/reports/YYYY-MM-DD-step-3-unit-test-and-db-verification.md`

---

## Step 3 — Database baseline and restore

### Pre-test baseline (tasks §3.1, §4.8)

Capture **before** any mutating curl or E2E:

```bash
cd backend && npx prisma db execute --stdin <<'SQL'
SELECT COUNT(*) AS customer_order_count FROM "CustomerOrder";
SELECT COUNT(*) AS customer_order_item_count FROM "CustomerOrderItem";
SQL
```

**PowerShell alternative** (if heredoc unavailable):

```powershell
cd backend
npx prisma db execute --stdin @"
SELECT COUNT(*) AS customer_order_count FROM \"CustomerOrder\";
SELECT COUNT(*) AS customer_order_item_count FROM \"CustomerOrderItem\";
"@
```

Record both counts in the report. Optionally note max `id` and latest `orderNumber` for create-idempotency checks.

### Mutating test discipline

| Operation | Restore action |
|-----------|----------------|
| `POST /api/admin/customer-orders` (curl or E2E) | Delete created order **and** its items (cascade if FK `onDelete: Cascade` on items) |
| `PATCH /:id/status` on **seed/existing** order | Revert fields to pre-test values via second PATCH, or use a disposable POST-created order only |
| E2E Cypress `after` hook | Delete orders created in spec; verify counts |

### Cleanup script pattern (no admin DELETE endpoint)

Use Prisma one-liner or small script (pattern from `backend/scripts/verify-supplier-orders-api.js`):

```bash
cd backend && node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const id = Number(process.argv[1]);
  await prisma.customerOrderItem.deleteMany({ where: { customerOrderId: id } });
  await prisma.customerOrder.delete({ where: { id } });
  console.log('Deleted order', id);
  await prisma.\$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
" -- <CREATED_ORDER_ID>
```

### Post-test verification

Re-run baseline counts. **Pass criterion:** `customer_order_count` and `customer_order_item_count` match pre-test values exactly.

---

## Step 4 — curl test matrix (`/api/admin/customer-orders*`)

**Prerequisites**

1. PostgreSQL running (`DATABASE_URL` from `backend/.env`)
2. Backend: `cd backend && npm run dev` (port **3000**)
3. Admin seeded: `cd backend && npx ts-node prisma/seedAdmin.ts` (requires `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env.example`: `admin@example.com` / `AdminPass1`)
4. Obtain token:

```bash
curl -s -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPass1"}' \
  | jq -r '.data.accessToken'
```

Set shell variable: `TOKEN=<accessToken>`  
All admin requests: `-H "Authorization: Bearer $TOKEN"`

**Fixture discovery** (run once, record in report):

```bash
# Existing order id for GET/detail/PATCH (pick any from list)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/admin/customer-orders?pageSize=1" | jq '.data.items[0].id'

# Customer + variant for POST (from seed)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/admin/customers?pageSize=1" | jq '.data.items[0].id'

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/admin/products?pageSize=1" | jq '.data.items[0].variants[0].id'
```

### Matrix

| ID | Method | Path / query | Body | Expected | Supplier grep | DB impact |
|----|--------|--------------|------|----------|---------------|-----------|
| C0 | POST | `/api/admin/auth/login` | `{email,password}` | 200, `accessToken` | — | none |
| C1 | GET | `/api/admin/customer-orders` | — | 200; envelope `{items,total,page,pageSize}` | pass | none |
| C2 | GET | `/api/admin/customer-orders` (no auth) | — | 401 | — | none |
| C3 | GET | `?customerId={id}&status=Paid` | — | 200; filtered items | pass | none |
| C4 | GET | `?paymentStatus=Pending&fulfillmentStatus=NotStarted` | — | 200 | pass | none |
| C5 | GET | `?search=ORD-` | — | 200; matching orderNumbers | pass | none |
| C6 | GET | `?createdFrom=2026-01-01&createdTo=2026-12-31` | — | 200; dates in range | pass | none |
| C7 | GET | `?pageSize=500` | — | 200; `pageSize` ≤ 100 | pass | none |
| C8 | GET | `?sort=totalAmount&order=asc` | — | 200 | pass | none |
| C9 | GET | `/api/admin/customer-orders/{existingId}` | — | 200; items[], snapshots, 3 statuses | pass | none |
| C10 | GET | `/api/admin/customer-orders/999999` | — | 404 `CUSTOMER_ORDER_NOT_FOUND` | pass | none |
| C11 | POST | `/api/admin/customer-orders` | see payload below | 201; snapshots; totals; `orderNumber` | pass | **create** → note `id` |
| C12 | PATCH | `/api/admin/customer-orders/{newId}/status` | `{"paymentStatus":"Paid"}` | 200; `paidAt` set | pass | mutate disposable |
| C13 | PATCH | same | `{"fulfillmentStatus":"PendingSupplierOrder"}` | 200; only fulfillment changes | pass | mutate disposable |
| C14 | PATCH | same | `{"status":"Paid"}` | 200 | pass | mutate disposable |
| C15 | PATCH | same (after paid) | `{"status":"PendingPayment"}` | 422 `ORDER_STATUS_TRANSITION_INVALID` | pass | none |
| C16 | PATCH | `/api/admin/customer-orders/{newId}/status` | `{"status":"Cancelled"}` then `{"fulfillmentStatus":"Fulfilled"}` | 422 `FULFILLMENT_STATUS_TRANSITION_INVALID` | pass | mutate disposable |
| C17 | POST | `/api/admin/customer-orders` | `customerId: 999999` | 404 `CUSTOMER_NOT_FOUND` | pass | none |
| C18 | POST | `/api/admin/customer-orders` | `productVariantId: 999999` | 404 `VARIANT_NOT_FOUND` | pass | none |
| C19 | POST | `/api/admin/customer-orders` | `quantity: 0` | 400 `VALIDATION_ERROR` | pass | none |
| C20 | GET | `/api/public/customer-orders` | — | 404 route not found | — | none |
| C21 | — | All C1,C9,C11,C12–C14 bodies | — | `grep -E 'supplierId|supplierReference|supplierCost'` on saved JSON → empty | **hard gate** | — |
| C22 | — | Delete order `{newId}` | Prisma script | — | — | **restore** |
| C23 | — | Re-count `CustomerOrder` / `CustomerOrderItem` | — | matches baseline | — | verify |

**POST payload template (C11)**

```json
{
  "customerId": 1,
  "items": [{ "productVariantId": 1, "quantity": 1 }],
  "shippingAddressSnapshot": {
    "fullName": "KAN-30 Curl Test",
    "streetLine1": "Test St",
    "city": "Malaga",
    "province": "Malaga",
    "postalCode": "29001",
    "country": "Spain"
  },
  "billingAddressSnapshot": {
    "fullName": "KAN-30 Curl Test",
    "streetLine1": "Test St",
    "city": "Malaga",
    "province": "Malaga",
    "postalCode": "29001",
    "country": "Spain"
  }
}
```

**Out of scope for KAN-30 curl** (unless audit finds broken wiring): `POST /:id/supplier-orders` (KAN-19).

### Supplier isolation check procedure (every response)

```bash
# After each GET/POST/PATCH, pipe body:
echo "$BODY" | grep -E 'supplierId|supplierReference|supplierCost' && echo FAIL || echo PASS
```

PowerShell:

```powershell
if ($body -match 'supplierId|supplierReference|supplierCost') { 'FAIL' } else { 'PASS' }
```

### Report

`openspec/changes/customer-order-management-integration/reports/YYYY-MM-DD-step-4-curl-endpoint-testing.md`  
Include: command, status, key JSON fields, supplier grep result, cleanup id, post-counts.

---

## Step 5 — Minimal fix scope (only if verification fails)

Touch the **smallest** file that owns the defect. Do **not** refactor unrelated modules.

| Defect symptom | Likely file(s) | Minimal fix |
|----------------|----------------|-------------|
| Supplier field in API JSON | `customerOrderRepository.ts` `orderSelect`/`itemSelect`; service `variantSelectForOrder` | Remove field from select; never map to response |
| `createdFrom`/`createdTo` ignored | `customerOrderController.ts`, `customerOrderRepository.ts` | Forward query params; add `where.createdAt` bounds (KAN-29 pattern already merged — regression only) |
| Wrong HTTP status / error code | `customerOrderRepository.ts` error classes, `errorHandler.ts` | Add or fix `code` + `status` mapping for domain error |
| Invalid transition not 422 | `validator.ts` `validateCustomerOrderStatusUpdate` | Add/adjust rule; extend `validator.customerOrder.test.ts` |
| `pageSize` not clamped | `customerOrderService.ts` `findAll` | Confirm `Math.min(..., MAX_PAGE_SIZE)` |
| Missing `paidAt`/`cancelledAt` | `customerOrderService.ts` `updateStatus` | Set timestamps on Paid/Cancelled transitions |
| 401 missing on unauthenticated admin | `index.ts` `requireAdminAuth` mount order | Ensure auth middleware applies before customer-order routes |
| Public route leak | `index.ts` | Confirm no `/api/public/customer-orders` registration |
| Test gap only (prod code correct) | relevant `__tests__/*.test.ts` | Add case mirroring existing mock patterns |

**Explicit non-goals for fixes:** new endpoints, schema migrations, supplier-order generation behavior, refund/return flows, order status history model.

After any fix: re-run §2 unit commands + failed curl rows only + DB restore check.

---

## Step 6 — Documentation alignment (tasks §6)

Only if curl reveals response drift:

- `docs/api-spec.yml` — `/api/admin/customer-orders*` block; mark legacy `/customer-orders*` `deprecated: true`
- Error codes: `CUSTOMER_ORDER_NOT_FOUND`, `ORDER_STATUS_TRANSITION_INVALID`, `PAYMENT_STATUS_TRANSITION_INVALID`, `FULFILLMENT_STATUS_TRANSITION_INVALID`, `CUSTOMER_NOT_FOUND`, `VARIANT_NOT_FOUND`, `VALIDATION_ERROR`

---

## Step 7 — Adversarial review focus (backend slice)

Before PR, verify:

1. **Three-dimension separation** — PATCH partial updates do not cross-contaminate fields
2. **Snapshot immutability** — `unitPrice` on GET unchanged after catalog price update (optional spot-check via DB `UPDATE` on variant then GET order)
3. **Supplier-field absence** — repository allow-list is the enforcement point, not serializer post-filter
4. **Monetary correctness** — `totalAmount = subtotal + shipping - discount`; line `totalPrice = unitPrice * quantity`

Report: `openspec/changes/customer-order-management-integration/reports/YYYY-MM-DD-adversarial-review.md`

---

## Execution order summary

1. Audit checklist (§1) — no code unless gaps  
2. DB baseline (§3)  
3. Targeted + full unit tests (§2)  
4. curl matrix (§4) with supplier grep on every body  
5. DB restore + post-count verify (§3)  
6. Minimal fixes only if needed (§5)  
7. Reports under `openspec/changes/customer-order-management-integration/reports/`  
8. Mark `tasks.md` checkboxes `[x]` immediately after each sub-task passes  

---

## References

- Main spec: `openspec/specs/customer-order-management/spec.md`
- Integration spec delta: `openspec/changes/customer-order-management-integration/specs/customer-order-management/spec.md`
- Design: `openspec/changes/customer-order-management-integration/design.md`
- Tasks: `openspec/changes/customer-order-management-integration/tasks.md`
- Standards: `docs/backend-standards.md`, `docs/data-model.md`, `docs/api-spec.yml`
- Mandatory steps: `docs/openspec-tasks-mandatory-steps.md`
