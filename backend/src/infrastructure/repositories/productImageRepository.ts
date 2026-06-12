import { prisma } from '../prismaClient';
import { ProductImage } from '../../domain/models/productImage';
import {
  IProductImageRepository,
  ProductImageCreateData,
  ProductImageUpdateData,
} from '../../domain/repositories/productRepository';

export class ImageNotFoundError extends Error {
  readonly code = 'IMAGE_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Product image not found');
    this.name = 'ImageNotFoundError';
    Object.setPrototypeOf(this, ImageNotFoundError.prototype);
  }
}

export class ProductImageRepository implements IProductImageRepository {
  async findByProduct(productId: number): Promise<ProductImage[]> {
    const rows = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((r) => new ProductImage(r));
  }

  async findById(id: number): Promise<ProductImage | null> {
    const row = await prisma.productImage.findUnique({ where: { id } });
    return row ? new ProductImage(row) : null;
  }

  async create(data: ProductImageCreateData): Promise<ProductImage> {
    const row = await prisma.productImage.create({
      data: {
        productId: data.productId,
        url: data.url,
        altText: data.altText ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    return new ProductImage(row);
  }

  async update(id: number, data: ProductImageUpdateData): Promise<ProductImage> {
    const current = await this.findById(id);
    if (!current) throw new ImageNotFoundError();

    const row = await prisma.productImage.update({
      where: { id },
      data: {
        ...(data.url !== undefined && { url: data.url }),
        ...(data.altText !== undefined && { altText: data.altText }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
    return new ProductImage(row);
  }

  async remove(id: number): Promise<void> {
    const current = await this.findById(id);
    if (!current) throw new ImageNotFoundError();

    await prisma.productImage.delete({ where: { id } });
  }
}
