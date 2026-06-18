# Step 14 Report - curl Endpoint Testing

- Date: 2026-06-18
- Change: supplier-order-management
- Agent: Auto

## Commands Executed

- `node backend/scripts/verify-supplier-orders-api.js` (fetch-based curl equivalent against `http://localhost:3000`)

## Results Summary

| Test | Status | Notes |
|------|--------|-------|
| GET /api/admin/supplier-orders | 200 | Empty list envelope OK |
| GET /api/admin/supplier-orders/99999 | 404 | `SUPPLIER_ORDER_NOT_FOUND` |
| GET /api/public/supplier-orders | 404 | `NOT_FOUND` |
| POST /api/admin/customer-orders | 201 | Seed paid order |
| POST /api/admin/customer-orders/:id/supplier-orders | 201 | Created `SPO-000001` |
| GET /api/admin/supplier-orders/:id | 200 | Detail with items |
| PATCH /api/admin/supplier-orders/:id/status | 200 | `Requested` + tracking |
| Invalid PATCH (Delivered from Requested) | 422 | `SUPPLIER_ORDER_STATUS_TRANSITION_INVALID` |
| POST generate on unpaid order | 422 | `CUSTOMER_ORDER_NOT_ELIGIBLE` |
| Customer order response leak check | PASS | No `supplierCost`/`supplierReference` |

## Database State Verification

- Pre-test: `{ supplierOrders: 0, customerOrders: 0 }`
- Post-test after cleanup: `{ supplierOrders: 0, customerOrders: 0 }`
- Variant 1 supplier fields restored after test setup
- State restored: Yes

## Outcome

- Step 14 status: PASS
- Blocking issues: none
