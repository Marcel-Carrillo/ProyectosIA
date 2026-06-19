## Why

Administrators have no way to register or track deliveries to customers: `ShipmentsPage` shows "Coming soon" and `shipmentService` is a stub. Completing this closes the fulfillment loop started by KAN-18 (customer orders) and KAN-19 (supplier orders), giving the back-office team full delivery traceability in the supplier-fulfilled model.

## What Changes

- **New Prisma model `Shipment`** — the entity is documented in `docs/data-model.md` §12 and `docs/api-spec.yml` but does not exist in `prisma/schema.prisma`. A new model + migration is required.
- **Back-relations added** — `CustomerOrder` and `SupplierOrder` Prisma models gain a `shipments Shipment[]` relation (described in data-model but missing from schema).
- **Admin API** `/api/admin/shipments` — list (with filters), create, get by id, and update status; behind `requireAdminAuth`.
- **State machine enforced in service layer** — `Pending → Shipped → InTransit → Delivered / Failed / Returned` (terminals). `shippedAt` / `deliveredAt` set automatically on transition.
- **Admin UI** — `ShipmentsPage` (list + filters) and `ShipmentDetailPage` (detail + status controls + cross-links to customer order and supplier order) replace the "Coming soon" stub.
- **`shipmentService.ts` stub replaced** — full implementation of `list`, `getById`, `create`, and `updateStatus`.
- **`api-spec.yml` corrected** — current spec declares `/shipments`; must be `/api/admin/shipments`. Endpoints `GET /:id` and `PATCH /:id/status` are also missing and will be added.
- **Design decision documented** — `SupplierOrder.trackingNumber/trackingUrl` (procurement-level) and `Shipment` (customer-delivery) are **complementary**, not synchronized. Creating a shipment from a supplier order pre-fills tracking fields from the supplier order; no bidirectional sync.

### Non-goals

- Automatic integration with carrier APIs (Out of scope for MVP).
- Customer-facing shipment tracking portal or email notifications.
- Automatic recalculation of `CustomerOrder.fulfillmentStatus` on shipment events (noted as follow-up).
- Bidirectional sync between `SupplierOrder` tracking fields and `Shipment`.

## Capabilities

### New Capabilities

- `shipment-management`: Full CRUD admin management of shipments — Prisma model, state machine, admin API (`/api/admin/shipments`), and admin UI (`ShipmentsPage`, `ShipmentDetailPage`).

### Modified Capabilities

- `customer-order-management`: Adds `shipments Shipment[]` back-relation to `CustomerOrder` in Prisma schema. No API behavior change.
- `supplier-order-management`: Adds `shipments Shipment[]` back-relation to `SupplierOrder` in Prisma schema. No API behavior change.

## Impact

- **Backend:** new Prisma migration, new domain/repository/service/controller/routes for `Shipment`; minor schema change to `CustomerOrder` and `SupplierOrder` models.
- **Frontend:** `ShipmentsPage.tsx` and `shipmentService.ts` stubs replaced; new `ShipmentDetailPage.tsx`; admin routing updated.
- **Docs:** `docs/api-spec.yml` (path correction + missing endpoints/schemas), `docs/data-model.md` (confirm §12 + tracking decision).
- **Dependencies:** KAN-18 (customer orders) ✅, KAN-19 (supplier orders) ✅.
- **No customer-facing API changes.**
