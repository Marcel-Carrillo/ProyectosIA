## Why

On the storefront product detail page, selecting a color does not change the displayed image — the gallery shows the same images regardless of which color variant is selected. Customers cannot see the garment in the color they are about to buy, which reduces purchase confidence and increases "wrong color" returns, a costly outcome in a supplier-fulfilled model. `ProductImage` is currently product-level only (no color association), even though CJ's raw variant payload (`CjVariantDto.variantImage`) already carries a per-color image that today's promotion pipeline discards by flattening all images into one deduplicated list.

## What Changes

- Add a nullable `color` column to `ProductImage`. `color = null` means a shared/product-level image (always shown); a non-null value ties the image to a specific `ProductVariant.color`.
- Update CJ image extraction (`cjImageExtraction.ts`) to carry the source variant's derived color alongside `variantImage`, and deduplicate planned images by `(url, color)` instead of by `url` alone. The product's `bigImage` continues to be planned with `color = null`.
- Update CJ catalog promotion (`cjCatalogPromotionService.ts`) to persist the planned `color` on each created `ProductImage` record.
- Extend the public product API (`GET /api/public/products/:id`) to include `color` on each image (additive field, no breaking change).
- Update the storefront product gallery to filter images by the selected variant's color (`color === selectedColor || color === null`), falling back to the full gallery whenever the selected color has no color-tagged images, so single-color/single-variant products and any product with incomplete color-image data keep working exactly as today.
- Add an idempotent, DB-only backfill (mirroring `backfillCjVariantAttributes.ts` / `backfillCjProductImages.ts`) to assign `color` to already-persisted `ProductImage` rows for the ~11,221 already-promoted `CjCatalogItem` records, re-deriving from stored `rawPayload.variant` with zero new CJ API calls.

## Capabilities

### New Capabilities

(none — this extends existing capabilities below)

### Modified Capabilities

- `cj-catalog-media-capture`: planned images gain a `color` association derived from the source variant; deduplication changes from per-URL to per-(URL, color); adds a color backfill path for already-promoted products, mirroring the existing image backfill.
- `product-image-management`: `ProductImage` gains an optional `color` field, settable/visible through existing admin image endpoints.
- `public-catalog-api`: public product image objects gain a `color: string | null` field.
- `product-detail`: the storefront image gallery SHALL reflect the selected color variant, falling back to the full gallery when no color-specific images exist.

## Impact

- **Data model**: `backend/prisma/schema.prisma` (`ProductImage` + migration).
- **Backend**: `backend/src/domain/models/productImage.ts`, `backend/src/application/services/cjImageExtraction.ts`, `backend/src/application/services/cjCatalogPromotionService.ts`, `backend/src/presentation/serializers/publicProduct.ts`, new `backend/src/application/services/cjImageColorBackfill.ts` + `backend/scripts/backfillCjImageColors.ts`.
- **API**: `docs/api-spec.yml` — additive `color` field on the public/admin `ProductImage` schema.
- **Frontend**: `frontend/src/types/product.ts`, `frontend/src/components/storefront/ProductGallery.tsx`, `frontend/src/pages/storefront/ProductPage.tsx`.
- **Production data**: one-off backfill run against production DB after deploy (no new CJ API calls, DB-only, idempotent).
- **Customer-facing**: yes — storefront product detail page gallery behavior changes for multi-color CJ products.
- **Internal supplier fulfillment**: no change to order lifecycle, fulfillment status, payment status, returns, or refunds. No supplier cost, credentials, or internal fields are newly exposed — `color` is already public-safe (mirrors `ProductVariant.color`).
