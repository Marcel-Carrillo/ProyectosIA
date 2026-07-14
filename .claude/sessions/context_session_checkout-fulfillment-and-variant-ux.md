# Context Session: checkout-fulfillment-and-variant-ux

## Change location
`openspec/changes/checkout-fulfillment-and-variant-ux/`
- `proposal.md` — why, what changes, capabilities, impact
- `design.md` — technical decisions, risks, migration plan
- `specs/**/*.md` — 11 capability delta specs (2 new: `shipping-margin-guardrail`, `fulfillment-automation`; 9 modified: `checkout-mvp`, `customer-account-authentication`, `customer-management`, `product-detail`, `product-variant-management`, `public-catalog-api`, `cj-supplier-order-push`, `supplier-order-management`, `shipment-management`)
- `tasks.md` — 95 checkbox tasks, grouped 0–17 (0=branch, 1=Prisma migrations, 2-3=stock/gallery, 4-5=address book, 6-7=margin guardrail, 8-11=fulfillment automation, 12-17=mandatory verification/docs/PR steps)

## Summary of what this change does
Four bundled sub-capabilities requested by the store owner after a real test order:

1. **Checkout address prefill + defaults + "usar mismos datos"** — self-service address book (`/api/public/account/addresses`) with `isDefault` per type; checkout prefills from defaults; shipping→billing clone toggle; save-as-default at checkout.
2. **Admin shipping margin guardrail** — `ProductVariant.shippingCostEstimate` + computed `netMargin`, a freight-estimate refresh endpoint reusing `cjClient.calculateFreight`, and a warning badge when `publicPrice` doesn't cover `supplierCost + shippingCostEstimate + targetMargin`. Customer-facing shipping stays hard-coded free (`checkoutService.ts:137`, unchanged).
3. **End-to-end CJ fulfillment automation** — behind `FULFILLMENT_AUTOMATION_ENABLED` (default false): on `payment_intent.succeeded`, auto-generate supplier orders, auto-quote+auto-select logistics, auto-push to CJ (sandbox-locked via existing `CJ_SANDBOX_ORDERS`), plus a new scheduled job (`jobs/cjOrderStatusSyncHandler.ts`) that pulls CJ status and creates/advances `Shipment` records through the existing state machine. Manual admin endpoints remain as fallback. Failures are logged and recorded in a new alert/failure surface.
4. **Stock-aware variant selector + main-image-only gallery** — `ProductVariant.stockQuantity` synced from `CjCatalogItem.stockQuantity`; `VariantSelector.isCombinationAvailable` requires stock > 0; `ProductGallery` stops filtering the thumbnail strip by color (always shows all images), only the hero/main image follows the selected color.

## Current-state grounding already verified in code (see design.md Context section for detail)
- `checkoutService.ts:137` — `shipping = new Decimal(0)`, must stay.
- `CheckoutPage.tsx:16-39,172-204` — empty `shipping`/`billing` from `emptyAddress`, no prefill/clone today.
- `CustomerAddress` (`schema.prisma:114`) has `type` but no `isDefault`; admin CRUD exists at `/api/admin/customers/:customerId/addresses/*`; no `/api/public/account/addresses/*` today.
- `paymentService.ts:199-252` (`handlePaymentIntentSucceeded`) marks order `Paid`, triggers nothing else today.
- `cjOrderPushService.ts:67-154` — manual `pushOrder(supplierOrderId, { logisticName })`, locked to `isSandbox: 1` via `CJ_SANDBOX_ORDERS` config, rejects client-supplied `isSandbox`. This lock must NOT be relaxed by this change.
- `supplierOrderCjRoutes.ts` — `/freight-quote`, `/push`, `/order` admin routes.
- `jobs/supplierAutoProvisionHandler.ts` + `serverless.yml:87-90` — existing EventBridge scheduled-job pattern to mirror for the new status-sync job.
- `VariantSelector.tsx:61-62` — `isCombinationAvailable` checks only variant existence, not stock.
- `publicProduct.ts:15-23` — public variant DTO has no stock field.
- `ProductGallery.tsx:20-26` — filters `displayed` (thumbnails AND main) by selected color; must change to filter only the main image.
- `Shipment` state machine (existing, must not be bypassed): `Pending → Shipped/Failed/Returned`; `Shipped → InTransit/Delivered/Failed/Returned`; `InTransit → Delivered/Failed/Returned`; terminal states (`Delivered`/`Failed`/`Returned`) final.
- `customer-order-shipping-status` already derives customer-facing `shippingStatus` purely from `Shipment` records at read time — no separate customer-facing propagation needed beyond keeping `Shipment` current.

## Base-standards note
`docs/base-standards.md` defaults to manual-first supplier fulfillment. This change deliberately supersedes that default for the CJ chain at the store owner's explicit request (see proposal.md "Business-model note" and design.md Context) — guarded by `FULFILLMENT_AUTOMATION_ENABLED` (default false), the pre-existing sandbox lock, and retained manual fallback endpoints.

## What is needed from you (planning agent)
Read `proposal.md`, `design.md`, all 11 `specs/**/*.md` files, and `tasks.md` in full from the change folder above. Then read the actual current source files you'll be touching (do not guess paths/APIs — verify against the real code, e.g. `checkoutService.ts`, `paymentService.ts`, `cjOrderPushService.ts`, `VariantSelector.tsx`, `ProductGallery.tsx`, `schema.prisma`, `publicProduct.ts`, `accountRoutes.ts`, `supplierOrderRepository`/service, `shipmentService.ts`, `serverless.yml`, etc.). Produce a per-file implementation plan (exact files to create/edit, function/endpoint signatures, Prisma schema deltas, key logic decisions already made in design.md) that the parent session will implement directly from, task-group by task-group, matching `tasks.md`'s numbering. Do NOT write or edit implementation files yourself — only research and produce the plan document.
