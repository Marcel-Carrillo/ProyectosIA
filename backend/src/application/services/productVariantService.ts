import {
  IProductVariantRepository,
  IProductRepository,
  ProductVariantCreateData,
  ProductVariantUpdateData,
} from '../../domain/repositories/productRepository';
import { IAutomationSettingsRepository } from '../../domain/repositories/automationSettingsRepository';
import { ICjCatalogItemRepository } from '../../domain/repositories/cjCatalogItemRepository';
import { ICjClient } from '../../infrastructure/external/cjTypes';
import { ProductVariant } from '../../domain/models/productVariant';
import {
  validateProductVariantData,
  validateProductVariantPublicPrice,
  validateProductVariantStockPolicy,
  CjItemNotMappedError,
  CjApiUnavailableError,
} from '../validator';
import { ProductNotFoundError } from '../../infrastructure/repositories/productRepository';
import {
  VariantNotFoundError,
  VariantComparePriceInvalidError,
} from '../../infrastructure/repositories/productVariantRepository';

export class ProductVariantService {
  constructor(
    private readonly variantRepo: IProductVariantRepository,
    private readonly productRepo: IProductRepository,
    private readonly settingsRepo: IAutomationSettingsRepository,
    private readonly catalogRepo: ICjCatalogItemRepository,
    private readonly cjClient: ICjClient,
  ) {}

  // Attaches the admin-only margin warning flag, using the store's
  // configured targetMargin. Only meaningful when netMargin was computed
  // (i.e. the variant was read via adminVariantSelect) — see productVariant.ts.
  private applyMarginWarning(variant: ProductVariant, targetMargin: number): ProductVariant {
    if (variant.netMargin != null) {
      variant.marginWarning = variant.netMargin < 0 || variant.netMargin < targetMargin;
    }
    return variant;
  }

  async listByProduct(productId: number): Promise<ProductVariant[]> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    const variants = await this.variantRepo.findByProduct(productId);
    const { targetMargin } = await this.settingsRepo.get();
    return variants.map((v) => this.applyMarginWarning(v, targetMargin));
  }

  async findById(productId: number, id: number): Promise<ProductVariant> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    const variant = await this.variantRepo.findById(id);
    if (!variant || variant.productId !== productId) throw new VariantNotFoundError();
    const { targetMargin } = await this.settingsRepo.get();
    return this.applyMarginWarning(variant, targetMargin);
  }

  // Reuses the existing CJ freight-quote client to refresh a variant's
  // admin-only shippingCostEstimate. Never called on a storefront hot path —
  // only from this explicit admin action (design.md Decision 6).
  async refreshFreightEstimate(
    productId: number,
    variantId: number,
    destinationCountry?: string
  ): Promise<ProductVariant> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundError();
    const variant = await this.variantRepo.findById(variantId);
    if (!variant || variant.productId !== productId) throw new VariantNotFoundError();

    const cjCatalogItemId = await this.variantRepo.findCjCatalogItemId(variantId);
    if (cjCatalogItemId === null) throw new CjItemNotMappedError();
    const catalogItem = await this.catalogRepo.findById(cjCatalogItemId);
    if (!catalogItem) throw new CjItemNotMappedError();

    const settings = await this.settingsRepo.get();
    const country = destinationCountry ?? settings.defaultFreightDestinationCountry;

    let quote;
    try {
      quote = await this.cjClient.calculateFreight({
        startCountryCode: 'CN',
        endCountryCode: country,
        products: [{ vid: catalogItem.externalRef, quantity: 1 }],
      });
    } catch {
      throw new CjApiUnavailableError();
    }
    if (quote.length === 0) throw new CjApiUnavailableError('No freight options returned');

    const lowest = quote.reduce((min, opt) => (opt.logisticPrice < min.logisticPrice ? opt : min));
    const updated = await this.variantRepo.updateShippingCostEstimate(variantId, lowest.logisticPrice);
    return this.applyMarginWarning(updated, settings.targetMargin);
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

    if (data.publicPrice !== undefined) {
      validateProductVariantPublicPrice(data.publicPrice);
    }
    validateProductVariantStockPolicy(data.stockPolicy);

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
