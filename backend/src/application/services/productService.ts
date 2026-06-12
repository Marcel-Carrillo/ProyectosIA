import {
  IProductRepository,
  IProductVariantRepository,
  ProductCreateData,
  ProductUpdateData,
  ProductListFilters,
  ProductListResult,
} from '../../domain/repositories/productRepository';
import { Product } from '../../domain/models/product';
import { validateProductData } from '../validator';
import {
  ProductNotFoundError,
  ProductRequiresActiveVariantError,
  ProductArchivedCannotReactivateError,
  ProductSlugConflictError,
} from '../../infrastructure/repositories/productRepository';

export class ProductService {
  constructor(
    private readonly repo: IProductRepository,
    private readonly variantRepo: IProductVariantRepository,
  ) {}

  async findAll(filters: ProductListFilters = {}): Promise<ProductListResult> {
    return this.repo.findAll(filters);
  }

  async findById(id: number): Promise<Product> {
    const product = await this.repo.findById(id);
    if (!product) throw new ProductNotFoundError();
    return product;
  }

  async create(data: Omit<ProductCreateData, 'slug'> & { slug?: string }): Promise<Product> {
    validateProductData(data as Record<string, unknown>);
    const effectiveStatus = data.status ?? 'Draft';
    if (effectiveStatus === 'Active') {
      throw new ProductRequiresActiveVariantError();
    }
    const slug = data.slug ?? (await this.resolveUniqueSlug(data.name));
    return this.repo.create({ ...data, slug });
  }

  async update(id: number, data: ProductUpdateData): Promise<Product> {
    const current = await this.repo.findById(id);
    if (!current) throw new ProductNotFoundError();

    if (
      current.status === 'Archived' &&
      data.status !== undefined &&
      data.status !== current.status
    ) {
      throw new ProductArchivedCannotReactivateError();
    }

    if (data.status === 'Active' && current.status !== 'Active') {
      const activeCount = await this.variantRepo.countActiveByProduct(id);
      if (activeCount === 0) throw new ProductRequiresActiveVariantError();
    }

    return this.repo.update(id, data);
  }

  async softDelete(id: number): Promise<void> {
    const current = await this.repo.findById(id);
    if (!current) throw new ProductNotFoundError();
    return this.repo.softDelete(id);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async resolveUniqueSlug(name: string): Promise<string> {
    const base = this.generateSlug(name);
    let slug = base;
    for (let attempt = 2; attempt <= 6; attempt++) {
      const existing = await this.repo.findBySlug(slug);
      if (!existing) return slug;
      slug = `${base}-${attempt}`;
    }
    const existing = await this.repo.findBySlug(slug);
    if (!existing) return slug;
    throw new ProductSlugConflictError();
  }
}
