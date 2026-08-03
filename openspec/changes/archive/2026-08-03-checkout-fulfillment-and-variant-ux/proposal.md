## Why

A real test order surfaced four gaps that hurt conversion, leak margin, and break fulfillment: checkout forces buyers to retype shipping/billing data with no defaults or "same as shipping" shortcut; the admin panel has no guardrail proving the public price still covers supplier cost + provider shipping + margin now that shipping is always free to the customer; clicking "generate supplier orders" does not push the order to CJ Dropshipping, leaving a fully manual chain from payment to tracking; and the product detail page lets a buyer pick a color that has no stock for the selected size, while selecting any color today replaces the whole thumbnail strip instead of only the hero image. Fixing these now, before order volume grows, prevents cart abandonment, underwater sales, stalled supplier orders, and unsellable variant combinations reaching checkout.

## What Changes

- Prefill checkout shipping/billing from the buyer's saved default address (or profile contact fields for guests); add a self-service address book with one default per type per authenticated customer; add a "usar mismos datos" action that clones shipping into billing and keeps them in sync while enabled.
- Add an admin-only margin/shipping guardrail: for each variant, show `supplierCost + providerShippingEstimate + targetMargin` against `publicPrice` and warn when the public price does not cover it. Customer-facing shipping remains hard-coded free; no shipping cost is ever charged to the customer.
- Automate the fulfillment chain end-to-end behind a feature flag: on `payment_intent.succeeded`, auto-generate the supplier order, auto-quote freight and auto-select a logistics option, auto-push the order to CJ Dropshipping (sandbox by default), and run a scheduled job that pulls CJ order status and propagates it to `SupplierOrder.status`, `Shipment`, and the customer-facing derived `shippingStatus`. **BREAKING** (behavioral, admin workflow): the existing manual "generate supplier orders" / "push to CJ" / "pull status" admin actions remain available as a fallback but are no longer the primary path once the flag is enabled.
- Expose per-variant stock/availability on the public API (new data: `ProductVariant` currently has no stock field, only the linked `CjCatalogItem.stockQuantity`); the storefront variant selector disables a size/color combination when it has no stock, instead of only checking whether an active variant row exists.
- Change the product detail gallery so selecting a color only swaps the hero/main image to that color's photo; the thumbnail strip always shows all of the product's images regardless of the selected color.

## Non-goals

- No per-country shipping-cost tables baked into the public price; the margin guardrail uses a single admin-configurable default destination for its shipping estimate.
- No multi-supplier freight-optimization UI; logistics auto-selection covers CJ Dropshipping only, with an admin-configurable default/allow-list, not a full rate-shopping engine.
- No refund/return automation triggered by CJ order cancellations (existing `refund-management` / `return-request-management` flows are untouched).
- No address book beyond one default `Shipping` and one default `Billing` address per customer (no arbitrary multi-address book UI in this change).
- No change to the Stripe payment flow itself, to `checkout-mvp`'s snapshot-at-purchase-time behavior, or to the underlying database engine, API style, or tech stack.

## Capabilities

### New Capabilities
- `shipping-margin-guardrail`: Admin-only calculation and display of `supplierCost + providerShippingEstimate + targetMargin` vs. `publicPrice` per variant, with a warning when the public price does not cover cost, provider shipping, and target margin. Never exposed on `/api/public/*`.
- `fulfillment-automation`: Feature-flagged orchestration that automatically chains customer-order payment success to supplier-order generation, CJ order push with auto-selected logistics, and a scheduled CJ status-sync job, with idempotency, an alert path on failure, and the existing manual admin actions retained as fallback.

### Modified Capabilities
- `checkout-mvp`: shipping/billing forms are prefilled from the buyer's default address or profile contact fields, and a "usar mismos datos" action clones shipping into billing.
- `customer-account-authentication`: adds self-service address endpoints under `/api/public/account/addresses` (list/create/update/delete) scoped to the authenticated customer, with an `isDefault` flag enforcing one default per address `type`.
- `customer-management`: admin `CustomerAddress` records and endpoints gain the `isDefault` flag and the one-default-per-type invariant.
- `product-detail`: the image gallery no longer filters the thumbnail strip by selected color (only the hero image changes); the variant selector disables a size/color combination when its stock is zero, not only when no active variant row exists.
- `product-variant-management`: `ProductVariant` gains a stock signal synced from the linked `CjCatalogItem`, kept current during existing catalog sync/promotion jobs.
- `public-catalog-api`: public product/variant responses include a per-variant stock/availability field.
- `cj-supplier-order-push`: pushing an order to CJ Dropshipping and pulling its status can now happen automatically (auto-selected logistics, scheduled status pull) in addition to the existing manual admin-triggered actions.
- `supplier-order-management`: supplier-order auto-generation can now be triggered automatically when a customer order is marked paid, in addition to the existing manual admin action.
- `shipment-management`: `Shipment` records are created and updated automatically from synced CJ Dropshipping status, in addition to existing manual shipment updates.

## Impact

- **Affected code**: `checkoutService.ts`, `CheckoutPage.tsx`, new `customerAddressService`/`customerAddressController`/`customerAddressRepository`, `accountRoutes.ts`, `paymentService.ts` (webhook trigger), new `fulfillmentAutomationService.ts`, `cjOrderPushService.ts`, `supplierOrderCjRoutes.ts`, new `jobs/cjOrderStatusSyncHandler.ts` + `serverless.yml` schedule, `shipmentService.ts`, `productVariantService.ts`, admin variant serializer, `presentation/serializers/publicProduct.ts`, `VariantSelector.tsx`, `ProductGallery.tsx`, `cjCatalogSyncService.ts`/`cjCatalogPromotionService.ts`.
- **Data model**: `prisma/schema.prisma` migrations for `CustomerAddress.isDefault`, a stock signal on `ProductVariant`, and an admin-only `shippingCostEstimate` (or equivalent pricing settings). Update `docs/data-model.md`.
- **API**: new `/api/public/account/addresses/*` endpoints; extended `/api/admin/customers/:id/addresses/*` responses; extended public product/variant responses (stock field); extended admin variant responses (margin breakdown); new admin/job surface for automated CJ push and status sync. Update `docs/api-spec.yml`.
- **Customer-facing vs. internal**: checkout prefill/address book and the gallery/stock variant behavior are customer-facing; the margin guardrail and the core of fulfillment automation are internal/admin-only. No supplier cost, `externalOrderId`, `externalProvider`, or freight figures may appear on any `/api/public/*` response — extend existing isolation tests to cover the new fields.
- **Business-model note**: `docs/base-standards.md` states the first version should prioritize manual supplier order processing over premature automation; this change deliberately supersedes that default for the CJ fulfillment chain at the store owner's explicit request, guarded by a feature flag, sandbox default, and retained manual fallback — this is the explicit approval required by the base-standards approval rules for changing supplier fulfillment assumptions.
- **Dependencies**: relies on the existing CJ Dropshipping client (`cjClient.calculateFreight`, `createOrder`, `getOrderDetail`), the existing Stripe webhook dedupe (`StripeWebhookEvent`), and the existing EventBridge scheduled-job infrastructure.
