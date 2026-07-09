/**
 * One-off backfill: populates ProductImage/Product.mainImageUrl for products
 * that were promoted from CJ Dropshipping catalog items before image capture
 * existed. Reads already-stored CjCatalogItem.rawPayload — makes zero CJ API
 * calls. Idempotent (already-imaged products are excluded by the query).
 *
 * Run with: npx ts-node --transpile-only scripts/backfillCjProductImages.ts
 * (from backend/, against the target DATABASE_URL)
 *
 * Safe to run as a local/manual process wrapping DB-only work in
 * prisma.$transaction — this is NOT safe to assume if ever ported into a
 * scheduled Lambda handler. cj-catalog-auto-provisioning's incident report
 * (openspec/changes/cj-catalog-auto-provisioning/reports/
 * 2026-07-09-production-incident-lock-transaction-revert.md) documents a
 * real production bug where a Lambda-hosted transaction spanning external API
 * calls never completed its COMMIT before the execution environment froze.
 * Re-validate against a real deployed Lambda before ever scheduling this.
 */
import { prisma } from '../src/infrastructure/prismaClient';
import {
  groupVariantsByProduct,
  backfillProductImages,
  EligibleVariantRow,
} from '../src/application/services/cjProductImageBackfill';

async function main() {
  const rows = await prisma.productVariant.findMany({
    where: {
      cjCatalogItemId: { not: null },
      product: {
        deletedAt: null,
        mainImageUrl: null,
        images: { none: {} },
      },
    },
    include: {
      cjCatalogItem: { select: { rawPayload: true, title: true } },
    },
    orderBy: { id: 'asc' },
  });

  const eligibleRows: EligibleVariantRow[] = rows
    .filter((r) => r.cjCatalogItem !== null)
    .map((r) => ({
      productId: r.productId,
      rawPayload: r.cjCatalogItem!.rawPayload,
      title: r.cjCatalogItem!.title,
    }));

  const candidates = groupVariantsByProduct(eligibleRows);

  let imaged = 0;
  let noImageAvailable = 0;
  for (const candidate of candidates) {
    const result = await prisma.$transaction((tx) => backfillProductImages(tx, candidate));
    if (result.imaged) {
      imaged += 1;
      console.log(`[backfill-cj-images] imaged product ${candidate.productId}`);
    } else {
      noImageAvailable += 1;
      console.log(`[backfill-cj-images] no image data available for product ${candidate.productId}`);
    }
  }

  console.log(
    `[backfill-cj-images] done. processed=${candidates.length} imaged=${imaged} noImageAvailable=${noImageAvailable}`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
