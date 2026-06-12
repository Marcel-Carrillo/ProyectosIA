import { prisma } from '../prismaClient';
import { ProductVariant } from '../../domain/models/productVariant';
import {
  IProductVariantRepository,
  ProductVariantCreateData,
  ProductVariantUpdateData,
} from '../../domain/repositories/productRepository';

export class VariantNotFoundError extends Error {
  readonly code = 'VARIANT_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Product variant not found');
    this.name = 'VariantNotFoundError';
    Object.setPrototypeOf(this, VariantNotFoundError.prototype);
  }
}

export class VariantSkuConflictError extends Error {
  readonly code = 'VARIANT_SKU_CONFLICT' as const;
  readonly status = 409;

  constructor() {
    super('A variant with this SKU already exists');
    this.name = 'VariantSkuConflictError';
    Object.setPrototypeOf(this, VariantSkuConflictError.prototype);
  }
}

export class VariantComparePriceInvalidError extends Error {
  readonly code = 'VARIANT_COMPARE_PRICE_INVALID' as const;
  readonly status = 422;

  constructor() {
    super('compareAtPrice must be greater than publicPrice');
    this.name = 'VariantComparePriceInvalidError';
    Object.setPrototypeOf(this, VariantComparePriceInvalidError.prototype);
  }
}

const variantSelect = {
  id: true,
  productId: true,
  sku: true,
  size: true,
  color: true,
  publicPrice: true,
  compareAtPrice: true,
  stockPolicy: true,
  status: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class ProductVariantRepository implements IProductVariantRepository {
  async findByProduct(productId: number): Promise<ProductVariant[]> {
    const rows = await prisma.productVariant.findMany({
      where: { productId, deletedAt: null },
      select: variantSelect,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => new ProductVariant(r));
  }

  async findById(id: number): Promise<ProductVariant | null> {
    const row = await prisma.productVariant.findFirst({
      where: { id, deletedAt: null },
      select: variantSelect,
    });
    return row ? new ProductVariant(row) : null;
  }

  async findBySku(sku: string): Promise<ProductVariant | null> {
    const row = await prisma.productVariant.findFirst({
      where: { sku, deletedAt: null },
      select: variantSelect,
    });
    return row ? new ProductVariant(row) : null;
  }

  async countActiveByProduct(productId: number): Promise<number> {
    return prisma.productVariant.count({
      where: { productId, status: 'Active', deletedAt: null },
    });
  }

  async create(data: ProductVariantCreateData): Promise<ProductVariant> {
    const existing = await this.findBySku(data.sku);
    if (existing) throw new VariantSkuConflictError();

    const row = await prisma.productVariant.create({
      data: {
        productId: data.productId,
        sku: data.sku,
        size: data.size ?? null,
        color: data.color ?? null,
        publicPrice: data.publicPrice,
        compareAtPrice: data.compareAtPrice ?? null,
        supplierId: data.supplierId ?? null,
        supplierReference: data.supplierReference ?? null,
        supplierCost: data.supplierCost ?? null,
        stockPolicy: data.stockPolicy,
        status: data.status ?? 'Active',
      },
      select: variantSelect,
    });
    return new ProductVariant(row);
  }

  async update(id: number, data: ProductVariantUpdateData): Promise<ProductVariant> {
    const current = await this.findById(id);
    if (!current) throw new VariantNotFoundError();

    if (data.sku && data.sku !== current.sku) {
      const conflict = await this.findBySku(data.sku);
      if (conflict) throw new VariantSkuConflictError();
    }

    const row = await prisma.productVariant.update({
      where: { id },
      data: {
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.size !== undefined && { size: data.size }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.publicPrice !== undefined && { publicPrice: data.publicPrice }),
        ...(data.compareAtPrice !== undefined && { compareAtPrice: data.compareAtPrice }),
        ...(data.supplierId !== undefined && { supplierId: data.supplierId }),
        ...(data.supplierReference !== undefined && { supplierReference: data.supplierReference }),
        ...(data.supplierCost !== undefined && { supplierCost: data.supplierCost }),
        ...(data.stockPolicy !== undefined && { stockPolicy: data.stockPolicy }),
        ...(data.status !== undefined && { status: data.status }),
      },
      select: variantSelect,
    });
    return new ProductVariant(row);
  }

  async softDelete(id: number): Promise<ProductVariant> {
    const current = await this.findById(id);
    if (!current) throw new VariantNotFoundError();

    const row = await prisma.productVariant.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: variantSelect,
    });
    return new ProductVariant(row);
  }
}
