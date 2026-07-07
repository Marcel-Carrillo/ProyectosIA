# Step 8 Report - Manual Endpoint Testing with curl

- Date: 2026-07-05
- Change: customer-order-shipment-status
- Agent: Cursor (Claude)

## Environment Setup

- Backend dev server (`npm run dev`, port 3000) against Docker Postgres (`ecommerce-db`), verified via `GET /health` → `{"status":"ok","db":"up"}`.
- Automated script: `openspec/changes/customer-order-shipment-status/reports/run-curl-shipment-status.cjs`
- Test customers registered via `POST /api/public/auth/register`; `Paid` order inserted via `psql` (same pattern as prior changes — checkout integration has unrelated pre-existing failures).

## Commands Executed and Responses

1. **No shipments** → `GET /api/public/account/orders/:id`
   - `shippingStatus: "Preparing"`, `shipments: []`, no `fulfillmentStatus` anywhere. ✅

2. **Two `Shipped` shipments** (one with `supplierOrderId`, one without) → detail
   - `shippingStatus: "Shipped"`, two whitelisted shipment objects (`carrier`, `trackingNumber`, `trackingUrl`, `shippedAt`), no `supplierOrderId`/`supplierOrder` in full JSON body. ✅

3. **One shipment set to `Failed`** → detail
   - `shippingStatus: "Problem"`. ✅

4. **All shipments set to `Delivered`** → detail
   - `shippingStatus: "Delivered"`. ✅

5. **`GET /api/public/account/orders`** (list)
   - Item includes `shippingStatus: "Delivered"`, no `shipments` key on list items. ✅

6. **Ownership** — customer B reads customer A's order
   - `404 CUSTOMER_ORDER_NOT_FOUND`. ✅

## Database State Restoration

- Deleted test `Shipment`, `SupplierOrder`, `Supplier`, `CustomerOrder`, `CustomerAccount`, `Customer` rows created by the script.
- Post-cleanup baseline matches Step 7: `Shipment` Pending=1/Shipped=1; `CustomerOrder` Paid=6/PendingPayment=25.

## Outcome

- Step 8 status: **PASS**
- Blocking issues: None
