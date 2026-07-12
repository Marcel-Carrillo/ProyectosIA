# Context Session: cj-variant-color-images

## Change artifacts
- Proposal: `openspec/changes/cj-variant-color-images/proposal.md`
- Design: `openspec/changes/cj-variant-color-images/design.md`
- Specs (deltas): `openspec/changes/cj-variant-color-images/specs/{cj-catalog-media-capture,product-image-management,public-catalog-api,product-detail}/spec.md`
- Tasks: `openspec/changes/cj-variant-color-images/tasks.md`

## Problem
Storefront product detail page: selecting a color does not change the displayed image. `ProductImage` is product-level only (no color association), even though CJ's raw variant payload (`CjVariantDto.variantImage`) carries a per-color image that the promotion pipeline currently discards by flattening into one deduplicated-by-URL list.

## Key design decision (design.md)
Model the link as a nullable `color` column on `ProductImage` (not a `productVariantId` FK) — CJ's photo varies by color, not size, and multiple variants (different sizes) share a color and its image. Derive image color by reusing `extractCjVariantAttributesFromRawPayload` (already used for `ProductVariant.color`), not a new parser — single source of truth.

## Known-good precedent to follow exactly
- `backend/src/application/services/cjVariantAttributeBackfill.ts` (already fixed this session, PR #107) — bulk `UPDATE ... FROM (VALUES ...)` SQL, chunked, NOT a per-row Prisma `.update()` loop. The color backfill (`cjImageColorBackfill.ts`) MUST use this same bulk pattern from the start — a per-row-transaction backfill already caused a production incident (`P2028` transaction timeout against ~11k rows) earlier this session.
- `backend/src/application/services/cjVariantAttributeExtraction.ts` — `extractCjVariantAttributesFromRawPayload(rawPayload)` returns `{ size, color }` from `rawPayload.variant.{variantKey,variantNameEn,variantProperty}`. Reuse this for image color derivation.
- `backend/scripts/backfillCjVariantAttributes.ts` — mirror this script's shape (ts-node --transpile-only, chunked progress logs, summary line) for `backfillCjImageColors.ts`.

## Existing code to modify (already investigated, file:line accurate as of this session)
- `backend/prisma/schema.prisma` — `ProductImage` model (currently `id, productId, url, altText, sortOrder, createdAt`, no color/variant link).
- `backend/src/domain/models/productImage.ts`
- `backend/src/application/services/cjImageExtraction.ts` — `ExtractedCjImages`, `ImagePlanItem`, `PlannedImage`, `ImagePlan`, `planProductImages()`, `extractCjImages()`.
- `backend/src/application/services/cjCatalogPromotionService.ts` — `createProductImageRecord` call around line 213-221.
- `backend/src/presentation/serializers/publicProduct.ts` — `PublicProductImageDTO`, `serializeImage`.
- Admin product-image endpoints (`POST/PATCH /api/admin/products/:id/images`) — find controller/service/DTO.
- `frontend/src/types/product.ts` — `ProductImage` type.
- `frontend/src/components/storefront/ProductGallery.tsx` — currently `images: ProductImage[]`, no color awareness.
- `frontend/src/pages/storefront/ProductPage.tsx` — renders `<ProductGallery images={product.images ?? []} .../>` around line 264; `selectedVariant` state already exists (set via `VariantSelector`'s `onVariantChange`, line ~285).

## Business rules to respect (docs/base-standards.md)
- Never expose supplier cost, credentials, or internal fulfillment data through public/customer-facing APIs. `color` is public-safe (mirrors `ProductVariant.color`, already public).
- Product variants are the sellable units; this change does not alter order/fulfillment/payment/return/refund status models.
- Keep changes small, incremental, TDD where the tasks.md specifies it.

## Your job
Read `tasks.md` in full and produce a per-file implementation plan for your layer (backend or frontend) at `.claude/doc/cj-variant-color-images/{backend,frontend}.md`. Plan only — the parent session implements and runs all tests/servers.
