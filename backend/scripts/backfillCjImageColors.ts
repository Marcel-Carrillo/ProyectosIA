/**
 * One-off backfill: assigns ProductImage.color to already-persisted image
 * rows for products promoted from CJ Dropshipping before image-color
 * association existed. Re-derives color from stored CjCatalogItem.rawPayload
 * — zero CJ API calls. Idempotent (re-running after a complete run produces
 * zero updates).
 *
 * Uses bulk UPDATE...FROM(VALUES) SQL from the start, chunked — mirrors the
 * fix applied to backfillCjVariantAttributes.ts after its original per-row
 * update() loop hit Prisma's transaction timeout (P2028) against
 * production's ~11k rows. See cjImageColorBackfill.ts's backfillImageColors()
 * header comment for the precedent commit.
 *
 * Run with: npx ts-node --transpile-only scripts/backfillCjImageColors.ts
 * (from backend/, against the target DATABASE_URL)
 *
 * Safe to run as a local/manual process wrapping DB-only work in
 * prisma.$transaction — this is NOT safe to assume if ever ported into a
 * scheduled Lambda handler. See backfillCjProductImages.ts for the same caveat.
 */
import { prisma } from '../src/infrastructure/prismaClient';
import {
  planImageColorUpdates,
  backfillImageColors,
  BackfillCandidateRow,
  ExistingImageRow,
} from '../src/application/services/cjImageColorBackfill';

const CHUNK_SIZE = 2000;

async function main() {
  const rows = await prisma.cjCatalogItem.findMany({
    where: { promotedVariant: { isNot: null } },
    select: {
      rawPayload: true,
      promotedVariant: { select: { productId: true } },
    },
    orderBy: { id: 'asc' },
  });

  const candidates: BackfillCandidateRow[] = rows.map((row) => ({
    productId: row.promotedVariant?.productId ?? null,
    rawPayload: row.rawPayload,
  }));

  const productIds = Array.from(
    new Set(candidates.map((c) => c.productId).filter((id): id is number => id != null))
  );

  const existingImages: ExistingImageRow[] =
    productIds.length > 0
      ? await prisma.productImage.findMany({
          where: { productId: { in: productIds } },
          select: { id: true, productId: true, url: true, color: true },
        })
      : [];

  const { updates, skippedAmbiguous } = planImageColorUpdates(candidates, existingImages);

  let imagesUpdated = 0;
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    const result = await prisma.$transaction((tx) => backfillImageColors(tx, chunk), {
      timeout: 60_000,
    });
    imagesUpdated += result.imagesUpdated;
    console.log(
      `[backfill-cj-image-colors] progress: ${Math.min(i + CHUNK_SIZE, updates.length)}/${updates.length}`
    );
  }

  console.log(
    `[backfill-cj-image-colors] done. processed=${candidates.length} imagesUpdated=${imagesUpdated} skipped=${skippedAmbiguous}`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
