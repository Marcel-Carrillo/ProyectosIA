# Step 4 Report — curl Endpoint Testing

- Date: 2026-06-19
- Change: customer-order-management-integration
- Agent: Auto

## Environment

- Backend: `http://localhost:3000` (running)
- Admin login: `POST /api/admin/auth/login` → 200
- Verification script: `scripts/kan30-curl-verify.js`

## Results (all pass)

| ID | Case | Status |
|----|------|--------|
| C1 | Admin login | 200 |
| C2 | GET list | 200, no supplier fields |
| C3 | GET list with filters/search/date/sort | 200 |
| C4 | pageSize clamp | 100 |
| C5 | GET :id | 200, no supplier fields |
| C6 | GET missing id | 404 |
| C7 | POST create | 201, snapshots/totals |
| C8 | PATCH status+payment Paid | 200 |
| C9 | PATCH paid→PendingPayment | 422 |
| C10 | PATCH cancelled fulfillment advance | 422 |
| C11 | POST missing customer | 404 |
| C12 | POST invalid variant | 404 |
| C13 | POST invalid quantity | 400 |
| C14 | GET /api/public/customer-orders | 404 |
| C15 | Cleanup delete test order | OK |

## Supplier isolation

Grep on all JSON bodies: no `supplierId`, `supplierReference`, or `supplierCost`.

## Database restoration

- Pre-test: CustomerOrder 108, CustomerOrderItem 108
- Post-test: CustomerOrder 108, CustomerOrderItem 108

## Outcome

Step 4 status: **PASS**
