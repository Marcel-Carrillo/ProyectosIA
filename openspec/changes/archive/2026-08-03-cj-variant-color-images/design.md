## Context

`ProductImage` (`backend/prisma/schema.prisma`) is product-level only: `id, productId, url, altText, sortOrder, createdAt`. `ProductVariant` has `color`/`size` but no relation to images. CJ's raw variant payload carries a per-variant `variantImage` (`CjVariantDto.variantImage`, `backend/src/infrastructure/external/cjTypes.ts`) distinct from the product-level `bigImage`, but `cjImageExtraction.ts`'s `planProductImages()` flattens every item's `productImage`/`variantImage` into one deduplicated-by-URL list before `cjCatalogPromotionService.ts` persists it — the per-variant color association is discarded at write time. The storefront `VariantSelector` already surfaces the selected variant's `color` to `ProductPage`, but nothing forwards it to `ProductGallery`, and `ProductGallery` has no data to filter by even if it did.

Roughly 11,221 `CjCatalogItem` rows are already promoted in production (see the just-completed `cj-variant-attribute-extraction` backfill), so this change also needs a production backfill for the already-persisted `ProductImage` rows. That backfill directly follows the recent incident where `backfillCjVariantAttributes.ts`'s original per-row-transaction design hit Prisma's transaction timeout (`P2028`) against production's row count and had to be rewritten to bulk `UPDATE ... FROM (VALUES ...)` SQL — this change's backfill is designed with that lesson applied from the start rather than discovering it again in production.

## Goals / Non-Goals

**Goals:**
- Associate each `ProductImage` with the color it depicts (nullable — `null` means shared/product-level).
- Make CJ promotion persist that association going forward.
- Make the storefront gallery follow the selected color, with a safe fallback whenever color-specific images are unavailable.
- Backfill already-promoted production data without new CJ API calls.

**Non-Goals:**
- Per-size images (CJ's data model ties images to color, not size — a `productVariantId` FK would incorrectly imply size-level image variation and duplicate rows across sizes sharing a color).
- Color swatch thumbnails, admin UI for manually curating image-color pairs, or image-color support for suppliers other than CJ.
- Any change to order lifecycle, fulfillment, payment, returns, or refund status.

## Decisions

**D1 — Model `color` as a nullable string column on `ProductImage`, not a `productVariantId` FK.**
CJ's `variantImage` varies by color; multiple `ProductVariant` rows (different sizes) share the same color and therefore the same image. A FK to a specific variant would force duplicate `ProductImage` rows per size or arbitrarily pick one variant, and would tie image lookup to a irrelevant dimension (size). A free-text `color` column mirrors `ProductVariant.color` (also free text, already derived by `cj-variant-attribute-extraction`) and lets the frontend match on the same value the variant selector already exposes. Alternative considered: `productVariantId` FK — rejected for the duplication/semantics reasons above.

**D2 — Reuse `extractCjVariantAttributesFromRawPayload` to derive image color, not a new parser.**
`cjVariantAttributeExtraction.ts` already derives `{ size, color }` from the exact `rawPayload` shape (`{ variant: { variantKey, variantNameEn, variantProperty } }`) that `extractCjImages` reads for `variantImage`. Reusing it keeps a single source of truth for "what color is this CJ variant" — an image's color can never disagree with its own variant's `ProductVariant.color`. Alternative considered: re-deriving color locally in `cjImageExtraction.ts` — rejected as duplicated, driftable logic.

**D3 — Deduplicate planned images by `(url, color)`, not by `url` alone.**
Today's `planProductImages()` dedupes globally by URL, which is still correct and unchanged for the product-level image (always `color = null`, one per pid group). Variant images are deduped per color so that N variants sharing a color and the same `variantImage` URL still produce one `ProductImage` row, while different colors' images are always kept even if — implausibly — they shared a URL.

**D4 — `cjCatalogPromotionService.ts` persists the planned `color` verbatim on `createProductImageRecord`.**
No new business logic at promotion time; the color was already resolved during planning (D1–D3).

**D5 — Backfill uses bulk `UPDATE ... FROM (VALUES ...)` SQL from the start, chunked (mirrors the fixed `backfillCjVariantAttributes.ts`).**
Given the proven production scale problem with per-row transactions in this exact pipeline, the new `cjImageColorBackfill.ts` / `backfillCjImageColors.ts` is designed with the bulk-SQL, chunked-transaction pattern from day one: read `CjCatalogItem.rawPayload` for already-promoted items, re-derive `(variantImage, color)` via the same `extractCjImages` + `extractCjVariantAttributesFromRawPayload`, and batch-update matching `ProductImage.url` rows by `(productId, url)`. DB-only, idempotent, no new CJ API calls — same operational shape as `backfillCjVariantAttributes.ts` and `backfillCjProductImages.ts`.

**D6 — `color` is additive everywhere in the API/serializer.**
`PublicProductImageDTO` and the admin image schema both gain `color: string | null` without removing or renaming any existing field — no breaking change for existing clients.

**D7 — Frontend gallery filter with mandatory fallback to the full gallery.**
`ProductGallery` gains an optional `selectedColor?: string | null` prop. When provided, it filters to `img.color === selectedColor || img.color === null`; if that filter yields zero images (incomplete data, or a product with a color that has no dedicated photo), it MUST fall back to the unfiltered image list rather than ever rendering an empty gallery. Products without a color selector (single-variant, or `selectedColor` undefined) render exactly as today. Active thumbnail resets to index 0 whenever the filtered set changes.

## Risks / Trade-offs

- **[Risk]** Backfill still touches a large number of `ProductImage` rows (bounded by however many images the ~11,221 already-promoted items produced, likely fewer rows than `CjCatalogItem` itself since images dedupe per color/product) → **Mitigation**: bulk SQL + chunked transactions per D5, validated against a scratch table before running in production, exactly as done for the `cj-variant-attribute-extraction` backfill.
- **[Risk]** `ADD COLUMN color VARCHAR(50) NULL` on `ProductImage` in production → **Mitigation**: nullable column with no default requires no table rewrite/full-table lock in PostgreSQL; safe as a normal `prisma migrate deploy`.
- **[Risk]** Some already-promoted `ProductImage` rows may not match any `CjCatalogItem.rawPayload` image URL 1:1 (e.g., manually added admin images, or products not sourced from CJ) → **Mitigation**: backfill only updates rows it can positively match by `(productId, url)`; everything else is left `color = null`, which the gallery already treats as "always shown" — no regression.
- **[Risk]** A color legitimately has no dedicated image in CJ's data → **Mitigation**: D7's fallback to the full gallery, never an empty gallery.

## Migration Plan

1. Add the `ProductImage.color` column via Prisma migration (nullable, no default).
2. Ship the extraction/promotion/serializer/frontend changes together (all additive/backward-compatible; safe to deploy before the backfill runs).
3. Run the backfill script against production once, after deploy, using the same `DATABASE_URL`-from-SSM approach as prior CJ backfills; verify idempotence with a second run reporting zero changes.
4. Rollback: the column is additive and nullable — reverting the deploy (or the migration) does not lose data other than the newly-added `color` values, which can be regenerated by re-running the backfill after a future re-deploy.

## Open Questions

None — scope, data model, and rollout approach are settled by the decisions above.
