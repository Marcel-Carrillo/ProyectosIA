## Why

Every product promoted from CJ Dropshipping — whether promoted manually from the admin's CJ catalog modal or created automatically by the auto-provisioning job — is assigned a single fixed `Category` (`CJ_DEFAULT_CATEGORY_ID`, effectively "Uncategorized"), even though CJ's own API already reports each product's real category. This makes storefront category navigation and admin catalog search useless for CJ-sourced products, and forces admins to manually re-categorize every promoted item after the fact. CJ's category id is already captured during catalog sync (`CjCatalogItem.categoryId`) but never used, and the client method to resolve it to a readable name (`fetchCategories()`) is implemented but never called. This was explicitly deferred as a "Non-Goal" in the archived `cj-catalog-auto-provisioning` change; this proposal picks up that deferred work now that the promotion and auto-provisioning flows are stable in production.

## What Changes

- On promotion (both the manual admin modal and the automated auto-provisioning pipeline), resolve each promoted product's real category from CJ's taxonomy (via `fetchCategories()` and the already-stored `CjCatalogItem.categoryId`) instead of always assigning the fixed default category.
- If no local `Category` matches the resolved CJ category, create it automatically. New CJ-derived categories are created `Inactive` by default so an admin reviews/renames them before they appear in storefront navigation, rather than surfacing raw/untranslated CJ category names to customers immediately.
- Category resolution/creation happens once per `pid`-group (CJ's category id is product-level, not variant-level) and before the write transaction opens, so a CJ API failure during resolution degrades to the existing fallback instead of aborting or leaving a half-open transaction.
- `CJ_DEFAULT_CATEGORY_ID` becomes a **fallback** — used only when the item has no CJ category id, `fetchCategories()` is unavailable, or the id can't be resolved — instead of the value always applied.
- The manual promote modal's category dropdown becomes optional: default behavior is "use CJ's category automatically"; the admin can still force a fixed category as an override, same as today.
- **BREAKING (internal contract only)**: `CjPromotionRequestInput.categoryId` becomes optional in the promote request payload; `CjPromotionCategoryRequiredError` now only fires when auto-mapping fails **and** no fallback category is configured (previously it always fired when `categoryId` was omitted).
- A one-off, idempotent, admin-triggered backfill re-categorizes already-promoted products that are still sitting under the default category, using their linked `CjCatalogItem.categoryId` — never touching a product an admin has manually re-categorized since promotion.

## Capabilities

### New Capabilities
(none — this extends existing promotion/category behavior rather than introducing a new domain capability)

### Modified Capabilities
- `cj-catalog-promotion`: promoted products are now assigned a category resolved from CJ's real taxonomy (auto-created locally if missing) instead of always receiving the fixed default category; the request's `categoryId` becomes optional with a new resolution/fallback order.
- `supplier-catalog-auto-provisioning`: the automated pipeline no longer forces the fixed default category on every auto-promoted item — it uses the same CJ-taxonomy resolution as manual promotion, falling back to `CJ_DEFAULT_CATEGORY_ID` only when resolution fails.
- `category-management`: adds an external-reference field (or mapping table) so a supplier-provided category id can be looked up and reused instead of creating a duplicate local `Category` on every promotion run.

## Impact

- **Affected domain concepts**: `Product` (categoryId assignment at creation), `Category` (new external-reference field, auto-creation, default `Inactive` status for CJ-derived categories), `CjCatalogItem` (existing `categoryId` field finally read, not just stored), `Supplier`/CJ integration (new use of the existing `fetchCategories()` CJ API client method).
- **Customer-facing**: storefront category navigation/filtering becomes meaningful for CJ-sourced products once an admin activates the auto-created categories; no other customer-facing behavior changes.
- **Internal / supplier fulfillment**: changes `CjCatalogPromotionService.promote()` (shared by the manual modal and the automated `providerRegistry` pipeline), `CategoryRepository`, and the CJ promote request/response contract (`categoryId` optional). No impact on order lifecycle, fulfillment status, payment status, returns, or refunds. No supplier cost, credential, or internal-note data is newly exposed — CJ category names are already public-catalog-safe data.
- **Schema**: new Prisma migration adding an external-reference field to `Category` (or a `SupplierCategoryMapping` table — decided in `design.md`).
- **API**: `docs/api-spec.yml` updated for the now-optional `categoryId` in the promote request body and the revised `CJ_PROMOTION_CATEGORY_REQUIRED` error condition. Possible new admin-only backfill endpoint (decided in `design.md`).
