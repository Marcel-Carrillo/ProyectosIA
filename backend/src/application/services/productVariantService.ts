import {
  IProductVariantRepository,
  IProductRepository,
  ProductVariantCreateData,
  ProductVariantUpdateData,
} from '../../domain/repositories/productRepository';
import { ProductVariant } from '../../domain/models/productVariant';
import { validateProductVariantData } from '../validator';
import { ProductNotFoundError } from '../../infrastructure/repositories/productRepository';
import {
  VariantNotFoundError,
  VariantComparePriceInvalidError,
} from '../../infrastructure/repositories/productVariantRepository';

export class ProductVariantService {
  constructor(
    private readonly variantRepo: IProductVariantRepository,
    private readonly productRepo: IProductRepository,
  ) {}

  async listByProduct(productId: number): Promise<ProductVariant[]> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    return this.variantRepo.findByProduct(productId);
  }

  async findById(productId: number, id: number): Promise<ProductVariant> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    const variant = await this.variantRepo.findById(id);
    if (!variant || variant.productId !== productId) throw new VariantNotFoundError();
    return variant;
  }

  async create(data: ProductVariantCreateData): Promise<ProductVariant> {
    validateProductVariantData(data as unknown as Record<string, unknown>);
    const product = await this.productRepo.findById(data.productId);
    if (!product) throw new ProductNotFoundError();
    if (data.compareAtPrice != null && data.compareAtPrice <= data.publicPrice) {
      throw new VariantComparePriceInvalidError();
    }
    return this.variantRepo.create(data);
  }

  async update(productId: number, id: number, data: ProductVariantUpdateData): Promise<ProductVariant> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    const variant = await this.variantRepo.findById(id);
    if (!variant || variant.productId !== productId) throw new VariantNotFoundError();

    if (data.publicPrice !== undefined || data.compareAtPrice !== undefined) {
      const effectivePublicPrice = data.publicPrice ?? variant.publicPrice;
      const effectiveCompareAt = data.compareAtPrice !== undefined ? data.compareAtPrice : variant.compareAtPrice;
      if (effectiveCompareAt != null && effectiveCompareAt <= effectivePublicPrice) {
        throw new VariantComparePriceInvalidError();
      }
    }

    return this.variantRepo.update(id, data);
  }

  async softDelete(productId: number, id: number): Promise<ProductVariant> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    const variant = await this.variantRepo.findById(id);
    if (!variant || variant.productId !== productId) throw new VariantNotFoundError();
    return this.variantRepo.softDelete(id);
  }
}
