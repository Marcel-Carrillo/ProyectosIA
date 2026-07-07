## Why

The prior supplier-integration capability (`spocket-connection-management`, `spocket-catalog-sync`) was built as a placeholder against assumed Spocket API behavior (Bearer-token auth, HTTP-status-based success/failure). Live research since then confirmed Spocket has no public developer API at all — those endpoints, auth model, and response handling were never real. CJ Dropshipping (cjdropshipping.com) has been identified and validated as a real, working alternative: its live API was exercised end-to-end with a real account (authentication, category/product/variant/stock reads, freight calculation, and its per-order `isSandbox` test flag) and confirmed functional. This change replaces the placeholder with the real, validated CJ Dropshipping contract, and adds a new capability to push a `SupplierOrder` to CJ in sandbox mode so store operations can exercise the internal fulfillment pipeline end-to-end before any real order is ever placed.

## What Changes

- **BREAKING** (internal only, no external consumers yet): removes the placeholder `spocket-connection-management` and `spocket-catalog-sync` capabilities — their assumed Spocket auth model (Bearer token, HTTP-status success/failure) and routes under `/api/admin/suppliers/:supplierId/spocket/*` are replaced outright, not extended, because the underlying provider contract was never real.
- Adds real CJ Dropshipping authentication: `apiKey` → `accessToken`/`refreshToken` exchange, token caching keyed off the API's own `accessTokenExpiryDate` (not a hardcoded constant), and refresh via CJ's refresh endpoint. Success/failure is determined by the response body (`success`/`code`), since CJ returns HTTP 200 even for logical errors — this is a fundamentally different contract than the old HTTP-status-based placeholder.
- Adds real category/product/variant/stock catalog reads mapped from CJ's actual response shapes into the existing staging pattern (still staging-only — no auto-publish to `Product`/`ProductVariant`).
- Adds a new capability: admin-triggered freight quoting and pushing a `SupplierOrder` to CJ, **always in sandbox mode** in this increment (`isSandbox` forced server-side, not client-overridable), plus pull-based status/tracking lookup for the resulting CJ order. No real money moves and no real shipment is created by this increment.
- Routes move from `/api/admin/suppliers/:supplierId/spocket/*` to `/api/admin/suppliers/:supplierId/cj/*`, plus new routes under `/api/admin/supplier-orders/:supplierOrderId/cj/*` for freight quoting, push, and status lookup.
- Renames the placeholder implementation files/models to reflect the real provider (e.g. `spocketClient.ts` → `cjClient.ts`, `SpocketCatalogItem` → `CjCatalogItem`), and adds new fields to `SupplierOrder` to track the external CJ order (`externalOrderId`, `externalOrderStatus`, tracking fields, `sandbox` flag) — kept separate from the existing internal `status`/`trackingNumber` fields to avoid mixing internal fulfillment state with the external provider's order state.

**Explicitly out of scope for this increment** (deferred, consistent with `docs/base-standards.md`'s "manual control before automation"):
- Inbound webhooks from CJ — order/shipment status is checked by an admin-triggered pull (`GET .../cj/order`), not a webhook receiver.
- Auto-publishing staged catalog items to the live public `Product`/`ProductVariant` catalog — promotion remains a manual, unchanged admin workflow.
- A full CJ "sandbox account" conversion — this is a one-way, irreversible account-level change requiring a CJ account manager; the lightweight per-order `isSandbox` flag (available today with the existing API key) is used instead.
- Automatic order push triggered by customer checkout — pushing a `SupplierOrder` to CJ remains an explicit admin action.

## Capabilities

### New Capabilities
- `cj-connection-management`: Admin configures, inspects, and verifies a supplier's connection to the real CJ Dropshipping API (apiKey-based auth with token cache/refresh), replacing the Spocket placeholder.
- `cj-catalog-sync`: Admin-triggered read-only pull of CJ Dropshipping categories/products/variants/stock into staging records for review, replacing the Spocket placeholder.
- `cj-supplier-order-push`: Admin can quote freight and push a `SupplierOrder` to CJ Dropshipping in sandbox mode, and pull the resulting CJ order's status/tracking — a new capability not present in the prior Spocket placeholder.

### Modified Capabilities
- `spocket-connection-management`: all requirements removed — replaced outright by `cj-connection-management` (see Reason/Migration in the delta spec).
- `spocket-catalog-sync`: all requirements removed — replaced outright by `cj-catalog-sync` (see Reason/Migration in the delta spec).

## Impact

- **Database**: rename/extend `SpocketCatalogItem` → `CjCatalogItem` with CJ-specific fields (`pid`, `vid`, `sku`, `categoryId`, `sellPrice`, `warehouseInventoryNum`); change `SupplierIntegration.provider` default from `"Spocket"` to `"CJDropshipping"`; add external-order tracking fields to `SupplierOrder` (`externalProvider`, `externalOrderId` unique, `externalOrderStatus`, `externalTrackingNumber`, `externalTrackingProvider`, `sandbox`, `pushedAt`, `lastStatusSyncedAt`). New Prisma migration.
- **Backend code**: renamed infrastructure/application/presentation files under the existing layered architecture (domain models, repositories, services, controllers, routes); new `cjOrderPushService.ts` + `cjOrderPushController.ts` for the order-push capability.
- **Configuration**: `SPOCKET_API_KEY`/`SPOCKET_API_BASE_URL` replaced by `CJDROPSHIPPING_API_KEY`/`CJ_API_BASE_URL`; new `CJ_SANDBOX_ORDERS` flag (default `true`, not overridable by request).
- **Documentation**: `docs/data-model.md`, `docs/api-spec.yml`, `docs/development_guide.md`, `docs/backend-standards.md` updated to reflect CJ Dropshipping instead of Spocket.
- **No impact** on customer-facing `/api/public/*` routes, response shapes, `CustomerOrder`, or the existing manual `SupplierOrder` status lifecycle (external CJ order state is tracked in new, separate fields).
