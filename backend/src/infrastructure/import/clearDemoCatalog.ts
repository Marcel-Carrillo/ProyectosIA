import { PrismaClient } from '@prisma/client';

export interface ClearDemoOptions {
  dryRun?: boolean;
}

export interface ClearDemoResult {
  hardDeleted: number;
  softDeleted: number;
  skipped: number;
}

export async function clearDemoCatalog(
  prisma: PrismaClient,
  options: ClearDemoOptions = {},
): Promise<ClearDemoResult> {
  // STEP 1: Find all products with at least one EJS- variant (exclude already soft-deleted)
  const demoVariants = await prisma.productVariant.findMany({
    where: {
      sku: { startsWith: 'EJS-' },
      product: { deletedAt: null },
    },
    select: { productId: true, id: true },
  });

  const productIds = [...new Set(demoVariants.map((v) => v.productId))];

  if (productIds.length === 0) {
    console.log('[clear-demo] No demo products found.');
    return { hardDeleted: 0, softDeleted: 0, skipped: 0 };
  }

  // STEP 2: Get ALL variant IDs for those products
  const allVariants = await prisma.productVariant.findMany({
    where: { productId: { in: productIds } },
    select: { id: true, productId: true },
  });

  const variantsByProduct = new Map<number, number[]>();
  for (const v of allVariants) {
    if (!variantsByProduct.has(v.productId)) variantsByProduct.set(v.productId, []);
    variantsByProduct.get(v.productId)!.push(v.id);
  }

  // STEP 3: Check FK references per product
  const toHardDelete: number[] = [];
  const toSoftDelete: number[] = [];

  for (const productId of productIds) {
    const variantIds = variantsByProduct.get(productId) ?? [];

    const [orderItemCount, supplierItemCount, wishlistCount] = await Promise.all([
      prisma.customerOrderItem.count({ where: { productVariantId: { in: variantIds } } }),
      prisma.supplierOrderItem.count({ where: { productVariantId: { in: variantIds } } }),
      prisma.wishlistItem.count({ where: { productVariantId: { in: variantIds } } }),
    ]);

    if (orderItemCount + supplierItemCount + wishlistCount === 0) {
      toHardDelete.push(productId);
    } else {
      toSoftDelete.push(productId);
    }
  }

  // STEP 4: Dry-run — log only, no writes
  if (options.dryRun) {
    console.log('[clear-demo] DRY RUN result:', {
      wouldHardDelete: toHardDelete.length,
      wouldSoftDelete: toSoftDelete.length,
    });
    return { hardDeleted: 0, softDeleted: 0, skipped: 0 };
  }

  // STEP 5: Execute in a single transaction
  await prisma.$transaction(async (tx) => {
    if (toHardDelete.length > 0) {
      const hardVariantIds = toHardDelete.flatMap((pid) => variantsByProduct.get(pid) ?? []);

      await tx.productImage.deleteMany({ where: { productId: { in: toHardDelete } } });
      await tx.productVariant.deleteMany({ where: { id: { in: hardVariantIds } } });
      // ProductTranslation is cascade-deleted by onDelete: Cascade on Product
      await tx.product.deleteMany({ where: { id: { in: toHardDelete } } });
    }

    if (toSoftDelete.length > 0) {
      const softVariantIds = toSoftDelete.flatMap((pid) => variantsByProduct.get(pid) ?? []);

      await tx.product.updateMany({
        where: { id: { in: toSoftDelete } },
        data: { deletedAt: new Date(), status: 'Archived' },
      });

      await tx.productVariant.updateMany({
        where: { id: { in: softVariantIds } },
        data: { status: 'Archived' },
      });
    }
  });

  const result: ClearDemoResult = {
    hardDeleted: toHardDelete.length,
    softDeleted: toSoftDelete.length,
    skipped: 0,
  };
  console.log('[clear-demo] result:', JSON.stringify(result));
  return result;
}
