# Step 13 Report - curl Endpoint Testing

- Date: 2026-06-18
- Change: customer-order-management
- Agent: Auto

## Commands Executed

- `GET http://localhost:3000/api/admin/customer-orders` → 200, envelope OK
- `GET http://localhost:3000/api/admin/customer-orders/99999` → 404 CUSTOMER_ORDER_NOT_FOUND
- `POST http://localhost:3000/api/admin/customer-orders` → 201, order ORD-000001, snapshots + totals
- `PATCH .../status` `{paymentStatus:Paid,status:Paid}` → 200
- `PATCH .../status` `{status:PendingPayment}` on paid order → 422
- `GET http://localhost:3000/api/public/customer-orders` → 404 (route not found)
- Response bodies contained no `supplierId`, `supplierReference`, or `supplierCost`

## Database Restoration

- Created test order deleted; CustomerOrder count restored to 0

## Outcome

- Step 13 status: PASS
- Blocking issues: none
