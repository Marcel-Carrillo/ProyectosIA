## Why

Production has `CJDROPSHIPPING_API_KEY` configured, but zero CJ Dropshipping suppliers are onboarded in the database. The existing flow (`cj-dropshipping-integration`, `cj-catalog-promotion`, `cj-connection-management-ui`) requires an admin to manually create the supplier connection, verify it, trigger a catalog sync, and promote staged items — four manual steps before any product can appear in the admin Products panel. This change automates that entire pipeline on a recurring schedule so an admin only needs to review price and activate a product, never wire the integration by hand.

## What Changes

- Add a scheduled job (new Lambda function, AWS EventBridge `schedule` event, no HTTP exposure) that runs once every 24 hours.
- On each run, for every supplier provider with a configured credential (CJ Dropshipping in this MVP): auto-create the `Supplier` + `SupplierIntegration` if none exists yet, call the existing `verifyConnection`, call the existing `syncCatalog`, then auto-promote newly synced, not-yet-promoted `CjCatalogItem` rows into real `Product`/`ProductVariant` records.
- Auto-promoted products are created in **Draft** status (`activate: false`) — never auto-published to the storefront. An admin still adjusts price and calls the existing `activate` action manually.
- Auto-promotion uses a fixed default category ("Uncategorized", configured via `CJ_DEFAULT_CATEGORY_ID`) and the existing `CJ_DEFAULT_MARKUP_MULTIPLIER` for price, since no human is available to choose a category per item at promotion time.
- The pipeline is idempotent: re-running it must not create duplicate suppliers, integrations, or products, and a failure for one provider must not block others.
- Introduce a minimal provider abstraction (`SupplierProviderDescriptor`) so a future second provider (e.g. Spocket) can be added without rewriting the job, without attempting a full multi-provider refactor now (single global credential per provider remains the MVP assumption).
- Add a kill-switch environment variable (`SUPPLIER_AUTO_PROVISION_ENABLED`) to disable the job without a redeploy.

## Capabilities

### New Capabilities

- `supplier-catalog-auto-provisioning`: scheduled, idempotent pipeline that detects a configured supplier provider credential, provisions the supplier connection, syncs its catalog, and auto-promotes staged items into Draft products — removing the need for manual connect/verify/sync steps before products are reviewable in the admin Products panel.

### Modified Capabilities

(none — this change orchestrates existing `cj-dropshipping-integration`, `cj-catalog-promotion`, and `cj-connection-management-ui` behavior without changing their requirements)

## Impact

- **Affected code**: new `backend/src/jobs/supplierAutoProvisionHandler.ts`, new `backend/src/application/services/supplierAutoProvisionService.ts`, new `backend/src/application/providers/providerRegistry.ts`; modifies `backend/serverless.yml` (new scheduled function, new env vars).
- **Affected data**: no schema changes required for the MVP (supplier↔provider detection reuses the existing `SupplierIntegration.provider` field); creates `Supplier`, `SupplierIntegration`, `CjCatalogItem`, `Product`, and `ProductVariant` rows exactly as the existing manual flow already does.
- **Affected systems**: AWS Lambda/EventBridge (new scheduled invocation, IAM-only, not HTTP-exposed), CJ Dropshipping API (periodic outbound calls subject to its rate limits).
- **Customer-facing impact**: none directly — auto-promoted products are Draft/non-public until an admin manually activates them, preserving manual control over what reaches the storefront and at what price.
- **Internal/admin impact**: admins no longer perform connect/verify/sync steps for CJ; they only review auto-imported Draft products (price, category) and activate them.
