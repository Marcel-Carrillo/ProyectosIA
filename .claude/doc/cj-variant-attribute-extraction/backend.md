# Backend plan: cj-variant-attribute-extraction

## 1. `cjVariantAttributeExtraction.ts` (new, pure)

- Export `extractCjVariantAttributes({ variantKey?, variantNameEn?, variantProperty? })`.
- `parseVariantKey`: split on `-`, classify tokens via size vocabulary; multiple size tokens → `size: null`; color tokens joined with space.
- `parseVariantNameEn`: suffix-only heuristic when a field still null after variantKey.
- `parseVariantProperty`: move existing JSON logic from `cjCatalogSyncService`.
- Export `extractCjVariantAttributesFromRawPayload(rawPayload)` for backfill.
- Never throw; wrap internals in try/catch.

## 2. `cjCatalogSyncService.ts`

- Remove local `parseSizeColor`; call `extractCjVariantAttributes` with full variant fields at line ~149.

## 3. `cjTypes.ts`

- Add `variantKey?`, `variantNameEn?` to `CjVariantDto`; comment `variantProperty` as fallback-only.

## 4. `cjVariantAttributeBackfill.ts` (new)

- `planVariantAttributeUpdates(rows)` — pure collision detection per productId.
- `backfillVariantAttributes(tx, updates)` — update `CjCatalogItem` + linked `ProductVariant` size/color only.
- Script queries all CJ-linked catalog items with promoted variants.

## 5. Tests

- `cjVariantAttributeExtraction.test.ts` — all spec scenarios.
- `cjVariantAttributeBackfill.test.ts` — mirrors image backfill test style.
- Extend `cjCatalogSyncService.test.ts` with variantKey fixtures + size/color assertions.
