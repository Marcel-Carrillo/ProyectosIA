## Why

Once a customer pays, their order in the account area is frozen at "Paid" forever — no code path ever advances `CustomerOrder.status` further, and the existing `Shipment` records (carrier, tracking number, shipped/delivered dates, status) are only reachable through admin endpoints. The customer has no way to know whether their order is being prepared, has shipped, is in transit, was delivered, or hit a problem, which drives avoidable "where is my order?" support contacts — a real risk in this supplier-fulfilled model where suppliers ship directly and lead times vary by supplier.

## What Changes

- Derive a customer-facing `shippingStatus` (`Preparing | Shipped | InTransit | Delivered | Problem`) for each paid `CustomerOrder`, aggregated from its associated `Shipment` records using a documented precedence rule (Problem > Delivered(all) > InTransit > Shipped > Preparing).
- Extend `GET /api/public/account/orders` to include the derived `shippingStatus` per order (list badge).
- Extend `GET /api/public/account/orders/:id` to include `shippingStatus` plus a whitelisted `shipments[]` array (`status`, `carrier`, `trackingNumber`, `trackingUrl`, `shippedAt`, `deliveredAt` only — no `id`, `customerOrderId`, `supplierOrderId`, or `supplierOrder` relation).
- **BREAKING (internal API surface only)**: remove the internal `fulfillmentStatus` field (order-level and per-item) from the customer-facing `toPublicOrder` payload, replacing it with the customer-safe derived `shippingStatus`. No current frontend code reads `fulfillmentStatus` from this payload, so this has no observable frontend impact, but any external consumer relying on that field would need to migrate.
- Add a "Shipping" section to `AccountOrderDetailPage.tsx` (status + tracking link(s) + shipped/delivered dates) and a shipping-status badge to `AccountOrdersPage.tsx`, shown only for orders past `PendingPayment`.
- Add ES/EN i18n labels for the new `Preparing` / `InTransit` / `Problem` status values (`Shipped`/`Delivered` labels already exist).

Non-goals for this change:
- Guest checkout order tracking (no authenticated order-detail view exists for guests today; a separate email/token-based tracking flow would be a follow-up change).
- Per-item shipment breakdown in the UI (order-level status only for MVP).
- Live carrier-API tracking integration, delivery ETA estimates, or push/email shipping notifications.
- Any change to how `Shipment` records are created or transitioned — that remains entirely manual, admin-only, and untouched by this change.

## Capabilities

### New Capabilities
- `customer-order-shipping-status`: Derivation and customer-facing exposure of a post-payment shipping status (and whitelisted tracking details) on the customer's own orders, without exposing any supplier-facing data.

### Modified Capabilities
(none — no existing `openspec/specs/` capabilities exist yet for this project; the related `pending-order-payment-actions` capability from the `resume-cancel-pending-order-payment` change has not yet been synced to `openspec/specs/`)

## Impact

- **Affected code**: `backend/src/presentation/controllers/customerAccountController.ts` (`toPublicOrder`, `listOrders`, `getOrderById` — extend Prisma `include` to load `shipments`, add a pure `deriveShippingStatus` helper, add a customer-safe shipment mapper distinct from the admin `shipmentSerializer.ts`), `frontend/src/pages/storefront/AccountOrderDetailPage.tsx`, `frontend/src/pages/storefront/AccountOrdersPage.tsx`, `frontend/src/i18n/locales/{es,en}/account.json`.
- **Affected APIs**: response bodies of the two existing customer-facing endpoints `GET /api/public/account/orders` and `GET /api/public/account/orders/:id` gain new fields; no new routes, no schema/migration changes (all data already exists via the `Shipment` model).
- **Customer-facing vs internal**: purely customer-facing exposure change. No impact on `Shipment` creation/transition logic, `SupplierOrder`, or any admin workflow — those remain manual and unchanged.
- **Supplier data exposure**: critical constraint carried through design — the new customer-safe shipment mapping must whitelist fields explicitly and must never reuse the admin `shipmentSerializer.ts`, which includes `supplierOrderId` and the `supplierOrder` relation.
- **Order lifecycle / fulfillment status**: does not change `CustomerOrder.status`, `paymentStatus`, or internal `fulfillmentStatus` semantics or transitions — it only stops re-exposing the internal `fulfillmentStatus` field to customers and replaces it with a derived, customer-safe view built from `Shipment` data.
