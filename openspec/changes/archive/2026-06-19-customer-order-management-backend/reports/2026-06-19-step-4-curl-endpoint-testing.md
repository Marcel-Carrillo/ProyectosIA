# Step 4 — curl endpoint testing

**Change:** customer-order-management-backend (KAN-28)  
**Date:** 2026-06-19  
**Base URL:** `http://localhost:3000`  
**Auth:** `POST /api/admin/auth/login` (`admin@example.com`)

## Results

| # | Request | Expected | Actual | Pass |
|---|---------|----------|--------|------|
| 4.3 | `GET /api/admin/customer-orders` (auth) | 200 paginated | 200, `{ success, data: { items, total, page, pageSize } }` | ✓ |
| 4.4 | `GET /api/admin/customer-orders/107` | 200, items, no supplier fields | 200; items with snapshots; no `supplierId`/`supplierCost` | ✓ |
| 4.5 | `POST /api/admin/customer-orders` | 201, orderNumber, snapshots | 201; id=107, `ORD-000100` | ✓ |
| 4.6 | `PATCH .../107/status` `{ "paymentStatus": "Paid" }` | 200 | 200; `paymentStatus: Paid`, `paidAt` set | ✓ |
| 4.7 | `PATCH .../107/status` `{ "status": "PendingPayment" }` on paid order | 422 | 422; `ORDER_STATUS_TRANSITION_INVALID` | ✓ |
| 4.8 | `GET /api/admin/customer-orders` (no auth) | 401 | 401 `UNAUTHORIZED` | ✓ |

## Notes

- Single status endpoint `PATCH /:id/status` updates `status`, `paymentStatus`, and/or `fulfillmentStatus` (per design).
- Invalid transition test uses `status: PendingPayment` when `paymentStatus` is already `Paid` (validator rule).
- `POST /:id/supplier-orders` exists but is KAN-19 scope (not tested here).

## Database cleanup (4.9)

Test order id **107** deleted after curl tests.

**Post-cleanup counts:** CustomerOrder **99**, CustomerOrderItem **99** (restored to baseline).
