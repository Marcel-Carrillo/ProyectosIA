import {
  IProductRepository,
  IProductVariantRepository,
  ProductCreateData,
  ProductUpdateData,
  ProductListFilters,
  ProductListResult,
} from '../../domain/repositories/productRepository';
import { IProductTranslationRepository, TranslationUpsertData } from '../../domain/repositories/productTranslationRepository';
import { Product } from '../../domain/models/product';
import { ProductTranslation } from '../../domain/models/productTranslation';
import { validateProductData, validateTranslationInput } from '../validator';
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
    private readonly translationRepo: IProductTranslationRepository,
  ) {}

  async findAll(filters: ProductListFilters = {}): Promise<ProductListResult> {
    return this.repo.findAll(filters);
  }

  async findById(id: number): Promise<Product> {
    const product = await this.repo.findById(id);
    if (!product) throw new ProductNotFoundError();
    return product;
  }

  async create(
    data: Omit<ProductCreateData, 'slug'> & { slug?: string; translations?: (TranslationUpsertData & { locale: string })[] },
  ): Promise<Product> {
    validateProductData(data as Record<string, unknown>);
    const effectiveStatus = data.status ?? 'Draft';
    if (effectiveStatus === 'Active') {
      throw new ProductRequiresActiveVariantError();
    }
    const { translations, ...productData } = data;
    const slug = productData.slug ?? (await this.resolveUniqueSlug(productData.name));
    const product = await this.repo.create({ ...productData, slug });

    if (translations && translations.length > 0) {
      for (const t of translations) {
        validateTranslationInput(t as unknown as Record<string, unknown>);
        await this.translationRepo.upsert(product.id!, t.locale, {
          name: t.name,
          description: t.description,
          source: t.source,
        });
      }
    }

    const refreshed = await this.repo.findById(product.id!);
    return refreshed ?? product;
  }

  async upsertTranslation(productId: number, locale: string, data: TranslationUpsertData): Promise<ProductTranslation> {
    const product = await this.repo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    validateTranslationInput({ locale, ...data });
    return this.translationRepo.upsert(productId, locale, data);
  }

  async listTranslations(productId: number): Promise<ProductTranslation[]> {
    const product = await this.repo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    return this.translationRepo.findByProduct(productId);
  }

  async deleteTranslation(productId: number, locale: string): Promise<void> {
    const product = await this.repo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    await this.translationRepo.delete(productId, locale);
  }

  async update(
    id: number,
    data: ProductUpdateData & { translations?: (TranslationUpsertData & { locale: string })[] },
  ): Promise<Product> {
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

    const { translations, ...productData } = data;
    await this.repo.update(id, productData);

    if (translations && translations.length > 0) {
      for (const t of translations) {
        validateTranslationInput(t as unknown as Record<string, unknown>);
        await this.translationRepo.upsert(id, t.locale, {
          name: t.name,
          description: t.description,
          source: t.source,
        });
      }
    }

    const refreshed = await this.repo.findById(id);
    if (!refreshed) throw new ProductNotFoundError();
    return refreshed;
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
