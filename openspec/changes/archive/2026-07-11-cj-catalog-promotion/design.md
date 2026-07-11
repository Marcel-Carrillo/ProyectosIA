## Context

The CJ Dropshipping integration (see `spocket-catalog-sync`, `spocket-connection-management` specs — pre-existing `Spocket*` naming, code already renamed to CJ) already syncs the supplier's real catalog into `CjCatalogItem` staging rows via `CjCatalogItemRepository.upsertMany`, keyed by `(supplierIntegrationId, externalRef)` where `externalRef` is CJ's variant id (`vid`). Multiple `CjCatalogItem` rows can share the same CJ product id (`pid`) — they are CJ's size/color variants of one product.

The public catalog (`Product`/`ProductVariant`) is currently empty (intentionally cleared, both local and production) and has no path to be populated other than manual admin CRUD (`ProductService.createProduct`, `POST /api/admin/products`), which defaults `status` to `Draft` and auto-generates a unique kebab-case `slug`. Product activation is already gated by an existing domain rule enforced in `ProductRepository`: activating a `Product` with zero active variants throws `PRODUCT_REQUIRES_ACTIVE_VARIANT` (422). `ProductVariant` currently has no relationship at all to `CjCatalogItem`.

Stakeholders: the store administrator (sole user of this capability) and, indirectly, storefront customers who will see whatever gets promoted and activated.

## Goals / Non-Goals

**Goals:**
- Let an admin browse the entire synced CJ catalog (not just what's already promoted) and see, per item, whether it's promoted and whether it's currently visible on the storefront.
- Let an admin promote one or many `CjCatalogItem` rows into real `Product`/`ProductVariant` records in one action, grouping by CJ `pid` into a single `Product`.
- Let an admin toggle storefront visibility (activate/deactivate) of an already-promoted item without losing the link back to its `CjCatalogItem`, so it can be reactivated or have its cost refreshed later.
- Keep the promotion/activation surface entirely admin-only; never expose the CJ linkage or supplier cost publicly.

**Non-Goals:**
- No automatic re-pricing of `publicPrice` after a later sync (only `supplierCost` refresh on the linked variant, via a manual "refresh" action — not scheduled/automatic).
- No automatic mapping from CJ's `categoryId` string to a local `Category` — the admin always picks the local category explicitly during promotion.
- No automatic image/translation import from CJ payloads in this change.
- No changes to `SupplierOrder`, `SupplierOrderItem`, freight-quote, or the order-push flow to CJ.
- No bulk "un-promote" (deletion of the promoted `Product`/`ProductVariant`) — deactivation only; hard removal stays on the existing admin product soft-delete flow, unchanged by this capability.

## Decisions

### 1. Persist the origin link as `ProductVariant.cjCatalogItemId` (nullable, unique FK)
**Why**: it's the only way to satisfy "deactivate without losing the link to reactivate/re-sync" — the alternative (deriving the link by matching `supplierReference`/SKU heuristically) is fragile and not queryable with an index. Unique enforces the domain invariant that a given `CjCatalogItem` can back at most one `ProductVariant`, and doubles as idempotency protection for the promote endpoint (a second promotion of the same item resolves to the existing row instead of creating a duplicate).
**Alternative considered**: a separate join table (`CjProductLink`). Rejected — over-engineered for a strict 1:1 relationship; a single nullable FK column is simpler and matches the existing pattern of `ProductVariant.supplierId`/`supplierReference`.
**Field treated as internal-only**: added to `productVariantRepository.ts`'s `variantSelect` omission list alongside `supplierCost`/`supplierReference`, and covered by the existing `cjIsolation.test.ts` pattern.

### 2. Promotion groups by CJ `pid`, reuses `ProductService`/`ProductRepository` for creation
**Why**: `pid` is CJ's product id; `CjCatalogItem` rows sharing a `pid` are that product's variants (`vid`s) — sizes/colors. Grouping avoids creating one `Product` per variant, which would break the existing "variants are children of one product" model and duplicate name/category/images per SKU. Reusing `ProductService`'s slug-generation and status-default logic avoids duplicating that logic in a second code path.
**Alternative considered**: promote each `CjCatalogItem` as its own single-variant `Product`. Rejected — contradicts the domain model (`ProductVariant` is documented as "the sellable unit," not the product) and would make later promotions of a sibling color/size create an unrelated second product instead of adding a variant.

### 3. Pricing: explicit `publicPrice` per item, or a configurable default markup over `supplierCost` — never publish at cost
**Why**: `ProductVariant.publicPrice` is a required, non-zero field; CJ only supplies `supplierCost`. Silently defaulting to cost would be a direct economic bug (selling at zero margin). A configurable multiplier (`CJ_DEFAULT_MARKUP_MULTIPLIER`, e.g. `2.5`) gives a safe, explicit fallback while still letting the admin override per item in the promotion modal.
**Alternative considered**: require `publicPrice` for every item with no fallback. Rejected as needless friction for bulk-promoting dozens of items at once; the configurable markup keeps bulk promotion usable while remaining an explicit, documented business decision (not a silent default of zero margin).

### 4. Activation/deactivation is a `status` transition, never `deletedAt` or a hard delete
**Why**: consistent with the existing soft-delete/status-lifecycle pattern already in the schema (`Product.status`, `Product.deletedAt` are distinct concepts) and with `PRODUCT_REQUIRES_ACTIVE_VARIANT`. Deactivating sets `ProductVariant.status = Inactive`; if it was the product's only active variant, the parent `Product` also transitions per the existing product status rules (reusing `ProductRepository`'s existing guard, not a new one). `cjCatalogItemId` is never cleared by activate/deactivate — only an explicit future "unlink" action (out of scope) would clear it.

### 5. Promotion state is derived, not stored on `CjCatalogItem`
**Why**: keeps the staging table (`CjCatalogItem`) a pure, disposable sync mirror of the CJ API, matching its existing spec ("strictly isolated from the live public catalog"). `promotionState` is computed at read time in the repository/serializer layer by left-joining on `ProductVariant.cjCatalogItemId` and checking the linked variant's `status`: no link → `NotPromoted`; linked + `status = Active` → `Active`; linked + any other status → `Inactive`.
**Alternative considered**: add a `promotionState` column to `CjCatalogItem`, updated by triggers/hooks on product changes. Rejected — introduces a second source of truth that can drift from the actual `ProductVariant.status`; deriving it is always correct and the extra join cost is negligible at admin-panel list sizes (paginated, max 100/page).

### 6. Promotion endpoint is transactional and idempotent
**Why**: bulk promotion of many items must not partially fail into an inconsistent state (e.g., `Product` created but only half its variants linked). A single Prisma `$transaction` wraps the whole grouped-promote operation. Idempotency (safe to call twice) falls out naturally from the unique `cjCatalogItemId` FK: on a repeat call for an already-linked item, the service resolves the existing `ProductVariant` instead of erroring or duplicating.

## Risks / Trade-offs

- **[Risk]** A single failing item in a large bulk-promote could abort the whole transaction, frustrating bulk workflows. → **Mitigation**: pre-validate all items (category exists, price resolvable, `syncStatus = Synced`) before opening the transaction; return a `422` with a per-item error list without touching the database if any item is invalid, so the admin can fix and retry rather than getting a partial/opaque failure.
- **[Risk]** SKU collisions if CJ's own `sku` field is reused directly. → **Mitigation**: always derive the local SKU deterministically as `CJ-<vid>` (externalRef), independent of CJ's own `sku` value, guaranteeing uniqueness within our system.
- **[Risk]** Admin picks a stale/wrong local `Category` repeatedly for bulk promotions since CJ's `categoryId` isn't mapped. → **Mitigation**: explicitly out of scope for this change (see Non-Goals); the promotion modal requires an explicit category selection every time, which is at least correct even if not automated.
- **[Risk]** The `spocket-catalog-sync`/`spocket-connection-management` specs still said "Spocket" while the code has said "CJ" since PR #79 (pre-existing gap from that earlier rename). → **Mitigation**: resolved by this change — both capabilities are fully renamed (`cj-catalog-sync`, `cj-connection-management`) via REMOVED+ADDED deltas rather than extended under the old name, so no "Spocket" naming survives in `openspec/specs/` after this change is synced/archived.
- **[Trade-off]** Deriving `promotionState` via a join on every catalog list request instead of a stored column trades a small, bounded query cost for eliminating an entire class of drift bugs — accepted given pagination keeps the join scope small.

## Migration Plan

1. Add Prisma migration: `ProductVariant.cjCatalogItemId Int? @unique` + FK to `CjCatalogItem.id`. Purely additive (nullable column, no data backfill needed since the catalog is currently empty in both environments).
2. Deploy backend with the new repository/service/controller/route code behind the already-existing admin-auth middleware — no feature flag needed since it's a net-new, opt-in admin workflow with no effect on existing traffic until the admin uses it.
3. Deploy frontend with the new admin page/route.
4. Rollback: the migration is a single nullable+unique column addition with a backward-compatible down migration (`DROP COLUMN`); safe to roll back at any point since no other code path depends on it yet.

## Open Questions

- Should `CJ_DEFAULT_MARKUP_MULTIPLIER` be a single global env var (MVP choice here) or per-category/per-supplier configurable? Deferred — global env var is sufficient for the current single-supplier MVP; revisit if a second supplier integration is added.
- Should the "refresh linked from CJ" action (updating `supplierCost` on already-promoted variants from the latest sync) be part of this change's MVP or a fast-follow? Included in MVP per the proposal, but scoped to a manual, explicit per-item/bulk action only — no scheduled job.
