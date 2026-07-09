import { Prisma } from '@prisma/client';

// Accepts either `tx` (inside prisma.$transaction) or the top-level `prisma`
// singleton — both structurally satisfy Prisma.TransactionClient. Shared by
// CjCatalogPromotionService.promote() and the CJ product image backfill, so
// the "create a ProductImage row" logic exists in exactly one place.
export async function setProductMainImage(
  client: Prisma.TransactionClient,
  productId: number,
  imageUrl: string
): Promise<void> {
  await client.product.update({ where: { id: productId }, data: { mainImageUrl: imageUrl } });
}

export async function createProductImageRecord(
  client: Prisma.TransactionClient,
  data: { productId: number; url: string; altText: string; sortOrder: number }
): Promise<void> {
  await client.productImage.create({ data });
}
