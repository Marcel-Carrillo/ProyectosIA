## Context

Once `paymentService.handleWebhookEvent`'s `payment_intent.succeeded` handler sets `CustomerOrder.status = 'Paid'` (`backend/src/application/services/paymentService.ts`), no code path ever advances it further. Meanwhile `Shipment` records (`backend/src/domain/models/shipment.ts`) — with `status: ShipmentStatus` (`Pending | Shipped | InTransit | Delivered | Failed | Returned`), `carrier`, `trackingNumber`, `trackingUrl`, `shippedAt`, `deliveredAt` — are created and transitioned manually by admins via `/api/admin/shipments`, and are associated to a `CustomerOrder` via `customerOrderId` (one order may have multiple shipments, one per supplier split). None of this reaches the customer: `toPublicOrder` in `backend/src/presentation/controllers/customerAccountController.ts` returns only `status`, `paymentStatus`, `fulfillmentStatus`, amounts, addresses, and `items[]`.

The admin-facing `shipmentSerializer.ts` includes `supplierOrderId` and a `supplierOrder` relation — per base-standards §4, supplier references must never reach customer-facing APIs, so that serializer must not be reused here.

## Goals / Non-Goals

**Goals:**
- Give the customer a derived, stable, customer-safe shipping status on their own orders, backed entirely by existing `Shipment` data (no schema changes).
- Whitelist shipment fields explicitly so supplier identifiers can never leak through this path, now or after future `Shipment` field additions.
- Keep the derivation a pure, unit-testable function, independent of Prisma/HTTP concerns.

**Non-Goals:**
- Changing how `Shipment` records are created, transitioned, or who manages them (remains fully manual, admin-only).
- Guest order tracking, per-item shipment UI, carrier-API integration, or notifications (see proposal's Non-goals).
- Advancing `CustomerOrder.status` itself — `status` stays `Paid`; shipping progress is conveyed by the new derived field, not by mutating the customer-facing order status enum.

## Decisions

**1. Compute `shippingStatus` at read time in the controller layer, not as a persisted column.**
A pure function `deriveShippingStatus(shipments: { status: ShipmentStatus }[]): CustomerShippingStatus` takes the order's loaded `Shipment[]` and returns one of `Preparing | Shipped | InTransit | Delivered | Problem`, using this precedence (first match wins):
1. Empty array, or every shipment `Pending` → `Preparing`
2. Any shipment `Failed` or `Returned` → `Problem`
3. Every shipment (non-empty) `Delivered` → `Delivered`
4. Any shipment `InTransit` → `InTransit`
5. Any shipment `Shipped` → `Shipped`
6. Fallback → `Preparing`

Alternative considered: persist a `shippingStatus` column on `CustomerOrder`, updated whenever a `Shipment` changes — rejected for this change because it would require touching `shipmentService`'s transition logic (out of scope per Non-Goals) and introduces a sync-drift risk (persisted status could get stale relative to the `Shipment` rows it's derived from). Deriving at read time is always consistent and needs zero writes.

**2. New customer-safe shipment mapper, not reuse of `shipmentSerializer.ts`.**
Add a small `toPublicShipment(shipment)` mapping function (co-located with `toPublicOrder` in `customerAccountController.ts`, matching the existing pattern where `toPublicOrder` is a local function in that file) that returns only `{ status, carrier, trackingNumber, trackingUrl, shippedAt, deliveredAt }`. It must be a strict allow-list (explicit field selection), not a deny-list, so a future field added to `Shipment` is excluded by default unless someone deliberately adds it here.

**3. Load shipments via a scoped Prisma `select`, not the full relation.**
`listOrders` and `getOrderById` add `shipments: { select: { status: true, carrier: true, trackingNumber: true, trackingUrl: true, shippedAt: true, deliveredAt: true } }` to their existing `include`. This guarantees `supplierOrderId` is never even fetched from the database for this code path (defense in depth beyond the mapper whitelist), and keeps the list endpoint lean (`listOrders` renders only the derived `shippingStatus` badge, not the full `shipments[]`, per Decision 5).

**4. Remove `fulfillmentStatus` from the customer-facing payload.**
`toPublicOrder` currently returns the internal `fulfillmentStatus` (order-level and per-item), which base-standards §4 says must be modeled separately from customer-facing status. No frontend code currently reads it (confirmed: `AccountOrderDetailPage.tsx`/`AccountOrdersPage.tsx` only render `status`/`paymentStatus`). This change removes it from `toPublicOrder`'s output and from `PublicOrder`/`PublicOrderItem` in `docs/api-spec.yml`, replacing the concern with the new derived `shippingStatus`. Alternative considered: keep `fulfillmentStatus` alongside the new field — rejected because it perpetuates the pre-existing base-standards violation for no benefit; the new derived field is a strict customer-safe superset of what `fulfillmentStatus` was trying to convey.

**5. List endpoint gets `shippingStatus` only; detail endpoint gets `shippingStatus` + full `shipments[]`.**
`GET /orders` (list) computes and returns `shippingStatus` per item for the badge, but does not include the full `shipments[]` array — avoids bloating a paginated list response with tracking details nobody reads from that view. `GET /orders/:id` (detail) includes both, since that's where tracking numbers/links/dates are actually useful.

**6. `shippingStatus` is only meaningful once `status !== 'PendingPayment'`.**
The frontend gates rendering of the shipping section/badge on `order.status !== 'PendingPayment'` (mirroring how the resume/cancel actions from the prior change are gated the opposite way, on `status === 'PendingPayment'`), so the two features never visually compete on the same order.

## Risks / Trade-offs

- **[Risk] Supplier data leakage through the new shipment fields.** → Mitigation: strict allow-list mapper (Decision 2) + scoped Prisma `select` that never fetches `supplierOrderId` in the first place (Decision 3); a dedicated test asserts `supplierOrderId`/`supplierOrder` are absent from both endpoints' response bodies.
- **[Risk] `fulfillmentStatus` removal is a breaking change for any undocumented external consumer.** → Mitigation: confirmed no frontend code reads it; documented explicitly as **BREAKING (internal API surface only)** in the proposal; called out in `docs/api-spec.yml` and the PR description.
- **[Risk] Ambiguous aggregation when shipments are in conflicting states (e.g., one `Delivered`, one `Failed`).** → Mitigation: explicit precedence order (Problem checked before Delivered) documented in Decision 1 and covered by dedicated unit tests for every precedence combination.
- **[Trade-off] No live carrier tracking, no ETA.** Accepted for MVP; customer sees the last state an admin recorded, same staleness characteristics as today's admin-only view.
