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

  // Chunked so each transaction stays short-lived against remote/production
  // DBs. backfillVariantAttributes now does bulk UPDATE...FROM(VALUES)
  // statements (2 per chunk) rather than one round trip per row, so a
  // larger chunk size is safe and keeps total round trips low.
  const CHUNK_SIZE = 2000;
  let itemsUpdated = 0;
  let variantsUpdated = 0;
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    const result = await prisma.$transaction((tx) => backfillVariantAttributes(tx, chunk), {
      timeout: 60_000,
    });
    itemsUpdated += result.itemsUpdated;
    variantsUpdated += result.variantsUpdated;
    console.log(
      `[backfill-cj-variant-attributes] progress: ${Math.min(i + CHUNK_SIZE, updates.length)}/${updates.length}`
    );
  }

  console.log(
    `[backfill-cj-variant-attributes] done. processed=${candidates.length} itemsUpdated=${itemsUpdated} variantsUpdated=${variantsUpdated} skippedAmbiguous=${skippedAmbiguous}`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
