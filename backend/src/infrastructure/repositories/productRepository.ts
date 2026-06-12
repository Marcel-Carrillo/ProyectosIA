import { prisma } from '../prismaClient';
import { Product } from '../../domain/models/product';
import {
  IProductRepository,
  ProductCreateData,
  ProductUpdateData,
  ProductListFilters,
} from '../../domain/repositories/productRepository';

export class ProductNotFoundError extends Error {
  readonly code = 'PRODUCT_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Product not found');
    this.name = 'ProductNotFoundError';
    Object.setPrototypeOf(this, ProductNotFoundError.prototype);
  }
}

export class ProductSlugConflictError extends Error {
  readonly code = 'PRODUCT_SLUG_ALREADY_EXISTS' as const;
  readonly status = 409;

  constructor() {
    super('A product with this slug already exists');
    this.name = 'ProductSlugConflictError';
    Object.setPrototypeOf(this, ProductSlugConflictError.prototype);
  }
}

export class ProductRequiresActiveVariantError extends Error {
  readonly code = 'PRODUCT_REQUIRES_ACTIVE_VARIANT' as const;
  readonly status = 422;

  constructor() {
    super('Product must have at least one active variant before it can be activated');
    this.name = 'ProductRequiresActiveVariantError';
    Object.setPrototypeOf(this, ProductRequiresActiveVariantError.prototype);
  }
}

export class ProductArchivedCannotReactivateError extends Error {
  readonly code = 'PRODUCT_ARCHIVED_CANNOT_REACTIVATE' as const;
  readonly status = 422;

  constructor() {
    super('Archived products cannot be reactivated');
    this.name = 'ProductArchivedCannotReactivateError';
    Object.setPrototypeOf(this, ProductArchivedCannotReactivateError.prototype);
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
  createdAt: true,
  updatedAt: true,
} as const;

export class ProductRepository implements IProductRepository {
  async findAll(filters: ProductListFilters = {}): Promise<Product[]> {
    const where: Record<string, unknown> = {};
    if (filters.status) where['status'] = filters.status;
    if (filters.categoryId) where['categoryId'] = filters.categoryId;

    const rows = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => new Product(r));
  }

  async findById(id: number): Promise<Product | null> {
    const row = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: { select: variantSelect, orderBy: { createdAt: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
    return row ? new Product(row) : null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const row = await prisma.product.findUnique({ where: { slug } });
    return row ? new Product(row) : null;
  }

  async create(data: ProductCreateData): Promise<Product> {
    const existing = await this.findBySlug(data.slug);
    if (existing) throw new ProductSlugConflictError();

    const row = await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        brand: data.brand ?? null,
        status: data.status ?? 'Draft',
        mainImageUrl: data.mainImageUrl ?? null,
        categoryId: data.categoryId ?? null,
      },
    });
    return new Product(row);
  }

  async update(id: number, data: ProductUpdateData): Promise<Product> {
    const current = await this.findById(id);
    if (!current) throw new ProductNotFoundError();

    if (data.slug && data.slug !== current.slug) {
      const conflict = await this.findBySlug(data.slug);
      if (conflict) throw new ProductSlugConflictError();
    }

    const row = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.mainImageUrl !== undefined && { mainImageUrl: data.mainImageUrl }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      },
    });
    return new Product(row);
  }

  async softDelete(id: number): Promise<Product> {
    const current = await this.findById(id);
    if (!current) throw new ProductNotFoundError();

    const row = await prisma.product.update({
      where: { id },
      data: { status: 'Inactive' },
    });
    return new Product(row);
  }
}
