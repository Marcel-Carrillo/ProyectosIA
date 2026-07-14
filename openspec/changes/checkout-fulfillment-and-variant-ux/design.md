## Context

This change bundles four fixes surfaced by a real test order, spanning checkout, admin pricing, CJ Dropshipping fulfillment automation, and the storefront product page. Current-state grounding (verified in code):

- Customer shipping is already hard-coded free: `checkoutService.ts:137` sets `shipping = new Decimal(0)`.
- `CheckoutPage.tsx` starts shipping/billing from `emptyAddress` with no prefill, no defaults, no clone control.
- `CustomerAddress` (`schema.prisma:114`) has `type` (`Shipping`/`Billing`) but no `isDefault`; admin CRUD exists at `/api/admin/customers/:customerId/addresses/*`, but there is no self-service `/api/public/account/addresses/*` surface.
- `payment_intent.succeeded` (`paymentService.ts:199-252`) marks the order `Paid` but triggers nothing else — supplier-order generation and CJ push are both manual admin actions today (`POST /api/admin/customer-orders/:id/supplier-orders`, `POST /api/admin/supplier-orders/:supplierOrderId/cj/push`).
- CJ push requires a hand-picked `logisticName` after a manual freight quote (`cjOrderPushService.ts:67-154`); the endpoint is locked to `isSandbox: 1` by server config (`CJ_SANDBOX_ORDERS`) and explicitly rejects a client-supplied `isSandbox` override — this lock is a hard constraint we keep, not something this change relaxes.
- No scheduled job pulls CJ order status; only catalog auto-provisioning has a scheduled job today (`jobs/supplierAutoProvisionHandler.ts`, `serverless.yml:87-90`), which this change's status-sync job mirrors.
- `Shipment` has an existing, documented status state machine (`Pending → Shipped/Failed/Returned`, `Shipped → InTransit/Delivered/Failed/Returned`, `InTransit → Delivered/Failed/Returned`, terminal states final) that the status-sync job must map into, not bypass.
- `customer-order-shipping-status` already derives the customer-facing `shippingStatus` purely from `Shipment` records at read time — automation only needs to keep `Shipment` current; no separate customer-facing propagation step is needed.
- `VariantSelector.isCombinationAvailable` (`VariantSelector.tsx:61-62`) checks only variant existence, never stock; `ProductVariant` has no stock column today — stock lives only on `CjCatalogItem.stockQuantity`.
- `ProductGallery` (`ProductGallery.tsx:20-26`) filters both thumbnails and the main image by selected color; this behavior was never captured in the `product-detail` spec, so it is treated as new documented behavior (main-image-only) rather than a spec regression.

`docs/base-standards.md` states the first version should prioritize manual supplier-order processing over premature automation. The store owner explicitly requested full automation for the CJ chain after observing it fail in a real order — this is the explicit approval required by the base-standards approval rules to change that default, and it is guarded by a feature flag, the pre-existing sandbox lock, and retained manual fallback (see `fulfillment-automation` spec).

## Goals / Non-Goals

**Goals:**
- Reduce checkout friction via prefill, saved defaults, and a shipping→billing clone action.
- Give admins a reliable per-variant view proving `publicPrice` covers `supplierCost + providerShipping + targetMargin`, with customer shipping staying free.
- Automate customer-order-paid → supplier-order → CJ push → status sync → customer-facing shipping status, safely, behind a flag, with manual fallback intact.
- Make the storefront variant selector and gallery reflect real stock and change only the hero image on color selection.

**Non-Goals:**
- No per-country shipping-cost tables baked into `publicPrice`; a single admin-configurable default destination drives the margin estimate.
- No multi-supplier freight-rate-shopping engine; auto-selection covers CJ Dropshipping only, cheapest-by-default or an admin allow-list.
- No relaxation of the existing `CJ_SANDBOX_ORDERS` lock — automatic pushes stay sandbox-only in this increment, identical to manual pushes today.
- No refund/return automation tied to CJ cancellations.
- No address book beyond one default `Shipping` + one default `Billing` address per customer.

## Decisions

### 1. Stock lives on `ProductVariant.stockQuantity`, synced from `CjCatalogItem`, not joined at read time
**Decision:** Add `stockQuantity` directly to `ProductVariant`, written during the existing catalog sync/promotion jobs (`cjCatalogSyncService.ts`/`cjCatalogPromotionService.ts`), rather than joining through `cjCatalogItemId` on every product-detail read.
**Alternative considered:** Live join through `cjCatalogItemId` on every read — always fresh, but adds a join to the hottest public read path (product detail) and complicates the existing `publicProduct.ts` allow-list serializer. Rejected for performance and for keeping the public serializer's supplier-isolation guarantee simple (one flat field to allow-list, not a nested supplier-owned relation).

### 2. Fulfillment automation is a new orchestration service, not inline logic in `paymentService`
**Decision:** Add `fulfillmentAutomationService.ts` that `paymentService.handlePaymentIntentSucceeded` calls after existing payment-success handling, composing the existing `generateFromCustomerOrder` and `cjOrderPushService.pushOrder` calls. The scheduled status-sync job (`jobs/cjOrderStatusSyncHandler.ts`) calls the same underlying pull logic as the manual `GET .../cj/order` endpoint.
**Alternative considered:** Trigger CJ push directly from inside `paymentService`. Rejected — `paymentService` should stay focused on payment/webhook concerns; composing supplier-order + CJ push + failure handling in a dedicated service keeps each existing service's contract unchanged and makes the automation independently testable and independently disable-able via the feature flag.

### 3. Idempotency comes from existing guards, not a new dedup table
**Decision:** Reuse `SupplierOrder` generation's existing idempotent re-generation behavior and the CJ push's existing `externalOrderId`-not-null rejection (`409 CJ_ORDER_ALREADY_PUSHED`) as the idempotency mechanism for automatic triggers under Stripe webhook retries, combined with the existing `StripeWebhookEvent` dedupe for the webhook itself.
**Alternative considered:** A new automation-run ledger table. Rejected as unnecessary — the two existing guards already make both steps safe to re-invoke, and adding a third tracking mechanism would duplicate state that can drift.

### 4. CJ status → Shipment mapping is explicit and one-directional, respecting the existing state machine
**Decision:** The status-sync job computes a target `Shipment.status` from the CJ `externalOrderStatus` and applies it only if it is a legal transition from the shipment's current status per the existing `shipment-management` state machine; illegal target transitions are skipped and alerted, never forced.
**Alternative considered:** Let the sync job set `Shipment.status` directly to whatever CJ reports. Rejected — this could skip states (e.g. jump straight to `Delivered` from `Pending`) or attempt invalid transitions from terminal states, undermining the state machine's guarantees that other parts of the system (customer-facing `shippingStatus` derivation) rely on.

### 5. Logistics auto-selection defaults to cheapest, with an admin-configurable allow-list
**Decision:** Auto-selection picks the lowest-priced freight option by default; an admin-configurable allow-list (if set) restricts the candidate pool before picking cheapest. No selection when the allow-list yields zero candidates — fail and alert rather than silently picking a non-preferred carrier.
**Alternative considered:** Always cheapest, no override. Rejected per the store owner's own risk callout (cheapest ≠ acceptable delivery time) — an allow-list gives a low-effort escape hatch without building a full rate-shopping UI.

### 6. Margin guardrail is a derived view, not a live per-order price recalculation
**Decision:** `shippingCostEstimate` is a persisted, admin-refreshed field on `ProductVariant`, refreshed via an explicit `POST .../freight-estimate` action (or a future periodic background refresh) — never computed by calling CJ on the storefront hot path.
**Alternative considered:** Compute the freight estimate live at checkout or at product-detail render time. Rejected — CJ's freight API is a per-order-destination quote, too slow and rate-limit-sensitive for a render path, and the guardrail's purpose is a pricing sanity check, not a live shipping-cost engine.

## Risks / Trade-offs

- **[Risk] Auto-pushing to CJ spends effort/quota with no human gate per order.** → **Mitigation:** feature flag defaults `false`; existing `CJ_SANDBOX_ORDERS` lock keeps every automatic push in sandbox mode in this increment, identical to the manual path; manual endpoints remain available as fallback.
- **[Risk] Materializing `stockQuantity` on `ProductVariant` can drift from `CjCatalogItem` between sync runs.** → **Mitigation:** sync cadence matches the existing catalog sync/promotion jobs; the variant selector treats stale zero-stock as "temporarily unavailable," which is the safe failure direction (never oversell).
- **[Risk] Auto-generated supplier orders or auto-pushed CJ orders fail silently.** → **Mitigation:** dedicated alert/failure list in the admin panel (per `fulfillment-automation`); structured logging without secrets or cost figures.
- **[Risk] Concurrent "set as default address" requests could produce two defaults of the same type.** → **Mitigation:** unset-previous-default happens in the same transaction as the set operation, enforced identically on both the self-service and admin address endpoints.
- **[Risk] Scheduled status-sync job maps a CJ status to a shipment transition the state machine forbids (e.g., CJ reports "delivered" for a shipment still `Pending`, skipping `Shipped`).** → **Mitigation:** `Pending → Delivered` is not itself a legal single hop (only `Pending → Shipped/Failed/Returned`, `Shipped → InTransit/Delivered/Failed/Returned`, `InTransit → Delivered/Failed/Returned` are). The job instead walks the shipment forward one legal hop at a time toward the mapped target (`Pending → Shipped → InTransit → Delivered`), applying each intermediate transition in sequence within the same sync run, so a single sync that missed intermediate polls still reaches the right end state without ever attempting an illegal hop. Only a target that cannot be reached at all this way (e.g. the shipment is already in a terminal state) is skipped and alerted.
- **[Trade-off] Single default-destination shipping estimate is an approximation, not a per-order recomputation.** → Accepted per Non-Goals; documented as an approximation in the admin UI, refreshable per variant.

## Migration Plan

1. Ship data-model migrations first (additive only): `CustomerAddress.isDefault`, `ProductVariant.stockQuantity`, `ProductVariant.shippingCostEstimate`, plus store-level config for target margin / default destination / carrier allow-list. All nullable/defaulted — no backfill required to deploy safely; a follow-up backfill job populates `stockQuantity` from existing `CjCatalogItem` links and leaves `isDefault`/`shippingCostEstimate` empty until first admin/customer action.
2. Ship customer-facing changes (checkout prefill/clone, address book, gallery/variant-selector stock awareness) — independently valuable, no flag needed, low risk.
3. Ship the margin guardrail (admin-only, additive, no flag needed).
4. Ship fulfillment automation last, behind `FULFILLMENT_AUTOMATION_ENABLED = false` by default. Enable in a lower environment first, verify a full sandbox order end-to-end (paid → supplier order → CJ push → status sync → `shippingStatus` update), then enable in production.
**Rollback:** every step is additive to the schema (new nullable columns, new tables/config) and every automated behavior is gated by a flag or remains additive to existing manual endpoints — disabling `FULFILLMENT_AUTOMATION_ENABLED` reverts to today's fully-manual fulfillment flow with no data loss.

## Open Questions

1. Where should the carrier allow-list and default target-margin/destination live — a new lightweight `PricingSettings`/`AutomationSettings` table, or environment/config values? Leaning config table for admin-editability without a redeploy; confirm during task breakdown.
2. Exact CJ `externalOrderStatus` string-to-`Shipment.status` mapping table (the concrete CJ status vocabulary) needs to be pinned down against CJ Dropshipping's API docs during implementation of the status-sync job.
3. Should the admin alert/failure list be a new lightweight table, or reuse an existing generic admin notification mechanism if one exists in the codebase? Needs a quick check during task breakdown before adding a new table.
