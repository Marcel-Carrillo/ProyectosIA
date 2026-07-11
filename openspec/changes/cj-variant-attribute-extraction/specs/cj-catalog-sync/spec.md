# Delta Spec: cj-catalog-sync (cj-variant-attribute-extraction)

## ADDED Requirements

### Requirement: Sync derives variant size and color from the CJ variant payload

During a catalog sync, for each CJ variant the system SHALL derive `CjCatalogItem.size` and `CjCatalogItem.color` using the following precedence, taking the first non-null result per field:

1. **`variantKey`** (primary): the hyphen-joined option values returned by `GET /product/variant/query` (e.g. `"Black-XXL"`). Each hyphen-separated token SHALL be classified as a **size** when it matches the size vocabulary — case-insensitive alpha sizes (`XS`, `S`, `M`, `L`, `XL`, `XXL`, `XXXL`, and `2XL`/`3XL` synonyms), purely numeric tokens (e.g. `36`, `38`, `90`), or EU-prefixed sizes (`EU37`, `EU 37`) — and as a **color** candidate otherwise. Multiple non-size tokens SHALL be joined with a single space to form the color. A single-token `variantKey` SHALL yield `{size, color: null}` when the token is a size and `{size: null, color: token}` otherwise.
2. **`variantNameEn`** (secondary): used only when `variantKey` is absent or yields nothing for a field; it SHALL NOT override a size/color already derived from `variantKey`.
3. **`variantProperty`** (fallback): the pre-existing JSON `[{key, value}]` parsing (`/size/i`, `/colou?r/i` key matching) SHALL be retained and used only when the previous signals yield nothing, preserving behavior if CJ ever populates this field.

Extraction SHALL be best-effort and non-throwing: any parse or classification failure SHALL yield `null` for the affected field and SHALL NOT mark the item `Failed` nor abort the sync. When classification is ambiguous, the system SHALL prefer `null` over a wrong guess.

#### Scenario: variantKey with color and size
- **WHEN** a synced CJ variant has `variantKey = "Black-XXL"` and no `variantProperty`
- **THEN** the staged `CjCatalogItem` is persisted with `color = "Black"` and `size = "XXL"`

#### Scenario: numeric and EU size tokens
- **WHEN** a synced CJ variant has `variantKey = "Blue-37"` or `variantKey = "EU38"`
- **THEN** the numeric/EU token is classified as `size` and the remaining token (if any) as `color`

#### Scenario: single non-size token is a color
- **WHEN** a synced CJ variant has `variantKey = "Red"`
- **THEN** the staged item is persisted with `color = "Red"` and `size = null`

#### Scenario: variantProperty fallback still works
- **WHEN** a synced CJ variant has no `variantKey` and `variantProperty = '[{"key":"Color","value":"Green"},{"key":"Size","value":"M"}]'`
- **THEN** the staged item is persisted with `color = "Green"` and `size = "M"`

#### Scenario: unclassifiable payload degrades to null without failing the item
- **WHEN** a synced CJ variant has a `variantKey` whose tokens cannot be confidently classified
- **THEN** the affected field(s) are persisted as `null`, the item keeps `syncStatus = Synced`, and the sync is not aborted

#### Scenario: promotion propagates the derived attributes
- **WHEN** an admin promotes staged items whose `size`/`color` were derived from `variantKey`
- **THEN** the created `ProductVariant` records carry those `size`/`color` values, and the public product detail response lists each Active variant with its distinct size/color so the storefront can render both selectors

### Requirement: Local backfill re-derives attributes for already-synced items and promoted variants

The system SHALL provide an idempotent, database-only backfill (service plus `backend/scripts/backfillCjVariantAttributes.ts` runner) that re-runs the attribute derivation over the stored `CjCatalogItem.rawPayload.variant` and updates (a) `CjCatalogItem.size`/`color` and (b) the `size`/`color` of already-promoted `ProductVariant` records linked via `cjCatalogItemId`. The backfill SHALL make zero calls to the CJ API, SHALL NOT modify `ProductVariant.status`, price, stock, or any supplier-internal field, and SHALL log and skip any update that would leave two variants of the same product with an identical non-null `(size, color)` pair. Re-running the backfill after a complete run SHALL produce zero further changes.

#### Scenario: backfill repairs rows synced before the fix
- **WHEN** the backfill runs against `CjCatalogItem` rows with `size IS NULL AND color IS NULL` whose `rawPayload.variant.variantKey` is populated
- **THEN** those rows and their promoted `ProductVariant`s are updated with the derived `size`/`color`

#### Scenario: backfill is idempotent
- **WHEN** the backfill is executed a second time with no new data
- **THEN** it reports zero updated rows

#### Scenario: backfill never disturbs stock reconciliation
- **WHEN** the backfill updates a promoted variant whose status is `Active` or `OutOfStock`
- **THEN** the variant's `status` is unchanged

#### Scenario: ambiguous collisions are skipped, not written
- **WHEN** re-derivation would give two promoted variants of the same product an identical non-null `(size, color)` pair
- **THEN** the backfill logs the pair and skips those updates, leaving the variants distinguishable
