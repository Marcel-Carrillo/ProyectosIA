# Context Session: customer-order-shipment-status

## Change location
`openspec/changes/customer-order-shipment-status/`

- Proposal: `openspec/changes/customer-order-shipment-status/proposal.md`
- Design: `openspec/changes/customer-order-shipment-status/design.md`
- Specs: `openspec/changes/customer-order-shipment-status/specs/customer-order-shipping-status/spec.md`
- Tasks: `openspec/changes/customer-order-shipment-status/tasks.md`

## Summary

Today, once a `CustomerOrder` is paid, the customer-facing account UI only ever shows `status: 'Paid'` — nothing tells the customer whether the order is being prepared, has shipped, is in transit, was delivered, or has a shipping problem. `Shipment` records (carrier, tracking number, tracking URL, shipped/delivered dates, status) already exist and are admin-managed via `/api/admin/shipments`, but are never exposed to the customer.

This change:
1. Adds a pure function `deriveShippingStatus(shipments)` that aggregates an order's `Shipment[]` into one of `Preparing | Shipped | InTransit | Delivered | Problem`, using this precedence (first match wins): empty/all-Pending → `Preparing`; any `Failed`/`Returned` → `Problem`; all non-empty `Delivered` → `Delivered`; any `InTransit` → `InTransit`; any `Shipped` → `Shipped`; fallback → `Preparing`.
2. Extends `GET /api/public/account/orders` (list) to include `shippingStatus` per item (no full `shipments[]` — keep list lean).
3. Extends `GET /api/public/account/orders/:id` (detail) to include `shippingStatus` AND a whitelisted `shipments[]` array: `{ status, carrier, trackingNumber, trackingUrl, shippedAt, deliveredAt }` only — never `id`, `customerOrderId`, `supplierOrderId`, or the `supplierOrder` relation (the admin `shipmentSerializer.ts` leaks these; must NOT be reused).
4. **Removes** the internal `fulfillmentStatus` field (order-level and per-item) from the customer-facing `toPublicOrder` payload — this is the ONE breaking change (internal API surface only; no frontend code currently reads it).
5. Adds a "Shipping" section to `AccountOrderDetailPage.tsx` and a shipping-status badge to `AccountOrdersPage.tsx`, both gated on `order.status !== 'PendingPayment'` (the opposite gate from the resume/cancel-payment actions added in the prior `resume-cancel-pending-order-payment` change, so the two features never visually compete on the same order).
6. Adds ES/EN i18n labels for `Preparing`/`InTransit`/`Problem` (`Shipped`/`Delivered`/`Processing` already exist in `account.json`).

No Prisma schema changes — this is purely a read-side derivation + exposure + UI change.

## Key existing files (read before planning)

Backend:
- `backend/src/presentation/controllers/customerAccountController.ts` — `toPublicOrder` (local function, also has `resumeOrderPayment`/`cancelOrder` from the prior change), `listOrders`, `getOrderById`. This is where `deriveShippingStatus` and `toPublicShipment` get added/wired in.
- `backend/src/domain/models/shipment.ts` — `ShipmentStatus` type (`Pending | Shipped | InTransit | Delivered | Failed | Returned`), `Shipment` class fields (`customerOrderId`, `supplierOrderId`, `carrier`, `trackingNumber`, `trackingUrl`, `status`, `shippedAt`, `deliveredAt`).
- `backend/src/presentation/serializers/shipmentSerializer.ts` — the ADMIN serializer; leaks `supplierOrderId`/`supplierOrder`. Do NOT reuse for the customer-facing mapper.
- `backend/src/routes/public/accountRoutes.ts` — existing routes, no new routes needed for this change.
- `backend/src/routes/public/__tests__/customerOrderIsolation.test.ts` — existing ownership isolation test pattern to extend with a supplier-leakage regression case.
- `backend/prisma/schema.prisma` — `Shipment` model (for confirming exact Prisma field names/relations when writing the scoped `select`).

Frontend:
- `frontend/src/pages/storefront/AccountOrderDetailPage.tsx` — already has the pending-payment actions block (from the prior change) gated on `status === 'PendingPayment'`; add the new Shipping section gated the opposite way.
- `frontend/src/pages/storefront/AccountOrdersPage.tsx` — already has a "Complete payment" quick-action link for pending orders; add the shipping-status badge for non-pending orders.
- `frontend/src/utils/orderStatusLabel.ts` — reused as-is for label resolution.
- `frontend/src/i18n/locales/{es,en}/account.json` — `status.*` block already has `Shipped`/`Delivered`/`Processing`; add `Preparing`/`InTransit`/`Problem`.
- `frontend/src/pages/storefront/__tests__/AccountOrderDetailPage.test.tsx` and `AccountOrdersPage.test.tsx` — existing test files from the prior change to extend, NOT replace.

## Task list

Full task breakdown is in `tasks.md` (60 tasks). Planning agents should produce a **per-file implementation plan** (function signatures, test cases, exact Prisma `select` shape, exact JSX insertion points) for their layer — they do not write code themselves.

**IMPORTANT for the frontend plan**: the storefront uses NO React Bootstrap (confirmed in the prior change) — it's custom `storefront-*` CSS classes only. Follow that same pattern for the new Shipping section/badge.

**IMPORTANT for both plans**: `docs/api-spec.yml`'s `PublicOrder`/`PublicOrderItem` schemas (added in the prior change, lines ~3202/3214) currently DO document `fulfillmentStatus: { type: string }`, matching what `toPublicOrder` actually returns today (confirmed via grep: lines 15, 33, 41, 59 in `customerAccountController.ts`). Both the doc schema and the runtime code must be updated together to remove it — there is no pre-existing discrepancy to reconcile, just a consistent removal across both.
