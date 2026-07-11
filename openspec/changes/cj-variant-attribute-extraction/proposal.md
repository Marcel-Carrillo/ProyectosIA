# Proposal: cj-variant-attribute-extraction

## Why

Every CJ catalog sync stores `size=null, color=null` because the extractor parses `variantProperty` (a field CJ's real API leaves empty) instead of `variantKey`/`variantNameEn`, where the attributes actually arrive. Promoted variants inherit the nulls, so the storefront `VariantSelector` renders no color/size options and shoppers can only buy the first Active variant of any multi-variant CJ product — the rest of the matrix is silently unpurchasable, losing revenue on products that are fully in stock.

## What Changes

- Rewrite sync-time attribute extraction in `cjCatalogSyncService` with a precedence chain: `variantKey` (primary, hyphen-joined option values, e.g. `"Black-XXL"`, classified size-vs-color by an explicit size vocabulary) → `variantNameEn` (secondary signal) → `variantProperty` JSON (existing logic kept as fallback). Extraction stays best-effort and non-throwing; ambiguity yields `null`, never a failed item or aborted sync.
- Extend `CjVariantDto` (`cjTypes.ts`) with `variantKey?` and `variantNameEn?` (currently undeclared).
- Add an idempotent, DB-only backfill (service + `backend/scripts/backfillCjVariantAttributes.ts`, mirroring the image backfill) that re-derives `size`/`color` for existing `CjCatalogItem` rows and their already-promoted `ProductVariant`s from stored `rawPayload.variant` — zero new CJ API calls, never touches variant `status`, logs and skips pairs that would collide on `(size, color)`.
- Add unit tests with realistic CJ payloads (`variantKey` populated, `variantProperty` absent) — the coverage gap that let this ship.
- No frontend change (`VariantSelector` already renders selectors when data is present), no API contract change, no Prisma migration (`size`/`color` columns already exist).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `cj-catalog-sync`: the catalog pull requirement gains explicit variant attribute extraction behavior (size/color derived from `variantKey` → `variantNameEn` → `variantProperty`, best-effort), and a new requirement covers the local backfill of attributes for already-synced items and already-promoted variants.

## Impact

- **Backend**: `backend/src/infrastructure/external/cjTypes.ts`, `backend/src/application/services/cjCatalogSyncService.ts` (`parseSizeColor`), new `backend/src/application/services/cjVariantAttributeBackfill.ts`, new `backend/scripts/backfillCjVariantAttributes.ts`, tests under `backend/src/application/services/__tests__/`.
- **Data**: `CjCatalogItem.size/color` and promoted `ProductVariant.size/color` become populated (columns already exist; no migration). Stock reconciliation (`Active ↔ OutOfStock`) untouched.
- **Customer-facing**: multi-variant CJ products show all color/size selectors; each combination adds the correct variant to cart. No new fields exposed — `size`/`color` are already public-safe; `supplierCost`, `vid`, `rawPayload` remain internal.
- **Ops**: one manual backfill run (local, like `backfillCjProductImages.ts`) to repair production rows synced before the fix.
- **Docs**: no `docs/api-spec.yml` / `docs/data-model.md` changes expected (existing columns/contracts); confirmed explicitly at documentation step.
