import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const fashionProducts = await prisma.product.findMany({
    where: { slug: { not: { startsWith: 'pf-' } }, deletedAt: null },
    select: { id: true, slug: true },
  });
  console.log(`Found ${fashionProducts.length} non-Printful products to remove`);

  for (const p of fashionProducts) {
    const variantIds = (
      await prisma.productVariant.findMany({ where: { productId: p.id }, select: { id: true } })
    ).map((v) => v.id);

    const refs =
      variantIds.length > 0
        ? await prisma.customerOrderItem.count({ where: { productVariantId: { in: variantIds } } })
        : 0;

    if (refs === 0) {
      await prisma.productImage.deleteMany({ where: { productId: p.id } });
      await prisma.productVariant.deleteMany({ where: { productId: p.id } });
      await prisma.product.delete({ where: { id: p.id } });
      console.log(`  hard-deleted: ${p.slug}`);
    } else {
      await prisma.product.update({
        where: { id: p.id },
        data: { deletedAt: new Date(), status: 'Archived' },
      });
      await prisma.productVariant.updateMany({
        where: { productId: p.id },
        data: { status: 'Archived' },
      });
      console.log(`  soft-deleted (${refs} order refs): ${p.slug}`);
    }
  }
  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
