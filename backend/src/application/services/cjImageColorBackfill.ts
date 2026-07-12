import { Prisma } from '@prisma/client';
import { extractCjImages } from './cjImageExtraction';
import { logger } from '../../infrastructure/logger';

export interface BackfillCandidateRow {
  productId: number | null;
  rawPayload: unknown;
}

export interface ExistingImageRow {
  id: number;
  productId: number;
  url: string;
  color: string | null;
}

export interface PlannedImageColorUpdate {
  imageId: number;
  color: string;
}

export interface PlanImageColorUpdatesResult {
  updates: PlannedImageColorUpdate[];
  skippedAmbiguous: number;
}

function imageKey(productId: number, url: string): string {
  return `${productId}\0${url}`;
}

// Pure — no I/O — matches an already-persisted ProductImage row to the color
// derived from stored CjCatalogItem.rawPayload, purely by (productId, url).
// Only variantImage entries carry a non-null derivable color (the
// product-level image is always color=null — nothing to backfill there, and
// it's already null by default on every pre-existing row).
//
// A single existing image row can be referenced by more than one
// CjCatalogItem row (e.g. several sizes of the same color sharing one
// variantImage URL — expected and fine; or, for data promoted before this
// feature existed, two genuinely different colors that happened to share a
// URL under the old URL-only dedup). If two catalog item rows derive
// *different* colors for the same existing image row, the match is
// ambiguous and is skipped entirely (color stays null) rather than
// guessing — mirrors the sibling (size,color) collision handling in
// cjVariantAttributeBackfill.ts's planVariantAttributeUpdates.
export function planImageColorUpdates(
  candidateRows: BackfillCandidateRow[],
  existingImages: ExistingImageRow[]
): PlanImageColorUpdatesResult {
  const byProductUrl = new Map<string, ExistingImageRow>();
  const byId = new Map<number, ExistingImageRow>();
  for (const image of existingImages) {
    byProductUrl.set(imageKey(image.productId, image.url), image);
    byId.set(image.id, image);
  }

  // Protect each product's shared/main image URL: a variant's rawPayload
  // can coincidentally carry the same URL as its own variantImage with a
  // derivable color, but that persisted row is the shared image (mirrors
  // planProductImages' "variant image matches product image" rule) and
  // must never be recolored away from null.
  const protectedUrls = new Set<string>();
  for (const row of candidateRows) {
    if (row.productId == null) continue;
    const extracted = extractCjImages(row.rawPayload);
    if (extracted.productImage) {
      protectedUrls.add(imageKey(row.productId, extracted.productImage));
    }
  }

  const desiredColorByImageId = new Map<number, string | 'AMBIGUOUS'>();

  for (const row of candidateRows) {
    if (row.productId == null) continue;
    const extracted = extractCjImages(row.rawPayload);
    if (!extracted.variantImage || extracted.color == null) continue;

    const key = imageKey(row.productId, extracted.variantImage);
    if (protectedUrls.has(key)) continue; // matches this product's shared/main image — never color it

    const existing = byProductUrl.get(key);
    if (!existing) continue; // no persisted row to backfill (design.md Risk: manually-added or non-CJ images)

    const current = desiredColorByImageId.get(existing.id);
    if (current === undefined) {
      desiredColorByImageId.set(existing.id, extracted.color);
    } else if (current !== 'AMBIGUOUS' && current !== extracted.color) {
      desiredColorByImageId.set(existing.id, 'AMBIGUOUS');
      logger.warn('Skipping CJ image color backfill due to conflicting colors for the same image URL', {
        imageId: existing.id,
        productId: existing.productId,
        url: existing.url,
      });
    }
  }

  const updates: PlannedImageColorUpdate[] = [];
  let skippedAmbiguous = 0;
  for (const [imageId, color] of desiredColorByImageId) {
    if (color === 'AMBIGUOUS') {
      skippedAmbiguous += 1;
      continue;
    }
    const existing = byId.get(imageId)!;
    if (existing.color === color) continue; // already correct — idempotent re-run
    updates.push({ imageId, color });
  }

  return { updates, skippedAmbiguous };
}

export interface BackfillImageColorsResult {
  imagesUpdated: number;
}

// Bulk UPDATE ... FROM (VALUES ...) from the start, chunked by the caller —
// the pattern proven necessary for this exact pipeline (production P2028
// "transaction not found" against ~11k CjCatalogItem rows with a per-row
// update() loop; see commit 9c37bf9 "fix(suppliers): make CJ variant
// attribute backfill scale to production" on branch
// fix/cj-variant-backfill-bulk-sql — not yet merged into develop as of this
// writing, so this file does NOT reuse that code, it mirrors its pattern).
export async function backfillImageColors(
  client: Prisma.TransactionClient,
  planned: PlannedImageColorUpdate[]
): Promise<BackfillImageColorsResult> {
  if (planned.length === 0) {
    return { imagesUpdated: 0 };
  }

  const rows = Prisma.join(
    planned.map((u) => Prisma.sql`(${u.imageId}::integer, ${u.color}::varchar(50))`)
  );
  const imagesUpdated = await client.$executeRaw`
    UPDATE "ProductImage" AS t
    SET color = v.color
    FROM (VALUES ${rows}) AS v(id, color)
    WHERE t.id = v.id
  `;

  return { imagesUpdated };
}
