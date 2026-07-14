/**
 * One-off backfill: copies ProductVariant.stockQuantity from each variant's
 * linked CjCatalogItem.stockQuantity for existing rows. Zero CJ API calls,
 * idempotent (re-running after a complete run produces zero updates).
 *
 * Run with: npx ts-node --transpile-only scripts/backfillProductVariantStockQuantity.ts
 * (from backend/, against the target DATABASE_URL)
 */
import { prisma } from '../src/infrastructure/prismaClient';

async function main(): Promise<void> {
  const updated = await prisma.$executeRaw`
    UPDATE "ProductVariant" AS t
    SET "stockQuantity" = c."stockQuantity", "updatedAt" = now()
    FROM "CjCatalogItem" AS c
    WHERE t."cjCatalogItemId" = c.id
      AND t."deletedAt" IS NULL
      AND t."stockQuantity" IS DISTINCT FROM c."stockQuantity"
  `;
  console.log(`Backfilled stockQuantity for ${updated} ProductVariant row(s).`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
