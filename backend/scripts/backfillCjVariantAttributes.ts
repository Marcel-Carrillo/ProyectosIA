/**
 * One-off backfill: re-derives CjCatalogItem.size/color and linked
 * ProductVariant.size/color from stored rawPayload.variant — zero CJ API calls.
 * Idempotent (re-running after a complete run produces zero updates).
 *
 * Run with: npx ts-node --transpile-only scripts/backfillCjVariantAttributes.ts
 * (from backend/, against the target DATABASE_URL)
 *
 * Safe to run as a local/manual process wrapping DB-only work in
 * prisma.$transaction — this is NOT safe to assume if ever ported into a
 * scheduled Lambda handler. See backfillCjProductImages.ts for the same caveat.
 */
import { prisma } from '../src/infrastructure/prismaClient';
import {
  planVariantAttributeUpdates,
  backfillVariantAttributes,
  BackfillCandidateRow,
} from '../src/application/services/cjVariantAttributeBackfill';

async function main() {
  const rows = await prisma.cjCatalogItem.findMany({
    select: {
      id: true,
      size: true,
      color: true,
      rawPayload: true,
      promotedVariant: {
        select: { id: true, productId: true, status: true },
      },
    },
    orderBy: { id: 'asc' },
  });

  const candidates: BackfillCandidateRow[] = rows.map((row) => ({
    cjCatalogItemId: row.id,
    productVariantId: row.promotedVariant?.id ?? null,
    productId: row.promotedVariant?.productId ?? null,
    currentSize: row.size,
    currentColor: row.color,
    rawPayload: row.rawPayload,
  }));

  const { updates, skippedAmbiguous } = planVariantAttributeUpdates(candidates);

  let itemsUpdated = 0;
  let variantsUpdated = 0;
  if (updates.length > 0) {
    const result = await prisma.$transaction((tx) => backfillVariantAttributes(tx, updates));
    itemsUpdated = result.itemsUpdated;
    variantsUpdated = result.variantsUpdated;
  }

  console.log(
    `[backfill-cj-variant-attributes] done. processed=${candidates.length} itemsUpdated=${itemsUpdated} variantsUpdated=${variantsUpdated} skippedAmbiguous=${skippedAmbiguous}`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
