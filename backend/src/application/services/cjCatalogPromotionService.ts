import { prisma } from '../../infrastructure/prismaClient';
import { ICjCatalogItemRepository } from '../../domain/repositories/cjCatalogItemRepository';
import { ICategoryRepository } from '../../domain/repositories';
import { ISupplierIntegrationRepository } from '../../domain/repositories/supplierIntegrationRepository';
import { IProductVariantRepository } from '../../domain/repositories/productRepository';
import { CjCatalogItem } from '../../domain/models/cjCatalogItem';
import { ProductService } from './productService';
import { SupplierIntegrationNotFoundError } from '../../infrastructure/repositories/supplierIntegrationRepository';
import {
  CjPromotionCategoryRequiredError,
  CjCatalogItemNotPromotedError,
  CjPromotionValidationError,
  CjPromotionItemError,
  CjPromotionRequestInput,
} from '../validator';
import { logger } from '../../infrastructure/logger';
import { extractCjImages, planProductImages } from './cjImageExtraction';
import { setProductMainImage, createProductImageRecord } from './cjProductImageSync';

const DEFAULT_MARKUP_ENV = 'CJ_DEFAULT_MARKUP_MULTIPLIER';

// Prisma's default interactive-transaction timeout is 5000ms. A single
// promote() call can create dozens to a few hundred Product/ProductVariant/
// ProductImage rows in one transaction (the automated auto-provisioning job
// can promote up to ~300 items per run — see cj-catalog-cursor-and-media's
// throughput study), which reliably exceeds that default under real network
// latency to RDS ("Transaction already closed" errors observed live in
// production). Raising the timeout here is safe, unlike the advisory-lock
// transaction that was reverted in supplierAutoProvisionService.ts (see
// cj-catalog-auto-provisioning's incident report): this transaction performs
// only synchronous DB writes with no external API calls in between, so it
// cannot be caught mid-flight by a Lambda execution-environment freeze the
// way that a transaction spanning CJ API calls could.
const PROMOTE_TRANSACTION_OPTIONS = { timeout: 120_000 };

export interface PromotedVariantResult {
  cjCatalogItemId: number;
  productId: number;
  productVariantId: number;
  sku: string;
  wasAlreadyPromoted: boolean;
}

export interface PromoteResult {
  products: { productId: number; variantIds: number[] }[];
  variants: PromotedVariantResult[];
  createdAny: boolean;
}

export interface ActivationResult {
  productId: number;
  productVariantId: number;
}

interface PidGroup {
  pid: string;
  items: { cjCatalogItemId: number; publicPrice?: number; compareAtPrice?: number; catalogItem: CjCatalogItem }[];
  existingProductId: number | null;
}

export class CjCatalogPromotionService {
  constructor(
    private readonly catalogRepo: ICjCatalogItemRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly productService: ProductService,
    private readonly variantRepo: IProductVariantRepository,
    private readonly integrationRepo: ISupplierIntegrationRepository
  ) {}

  private getDefaultMarkupMultiplier(): number | undefined {
    const raw = process.env[DEFAULT_MARKUP_ENV];
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  async promote(supplierId: number, input: CjPromotionRequestInput): Promise<PromoteResult> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();

    if (input.categoryId === undefined) throw new CjPromotionCategoryRequiredError();
    const category = await this.categoryRepo.findById(input.categoryId);
    if (!category || category.id === undefined) throw new CjPromotionCategoryRequiredError();
    const categoryId = category.id;

    const requestedIds = input.items.map((i) => i.cjCatalogItemId);
    const catalogItems = await this.catalogRepo.findManyByIds(requestedIds);
    const catalogItemsById = new Map<number, CjCatalogItem>();
    for (const ci of catalogItems) {
      if (ci.id !== undefined) catalogItemsById.set(ci.id, ci);
    }

    const markup = this.getDefaultMarkupMultiplier();
    const itemErrors: CjPromotionItemError[] = [];
    const resolvedPrices = new Map<number, number>();

    for (const requestItem of input.items) {
      const catalogItem = catalogItemsById.get(requestItem.cjCatalogItemId);
      if (!catalogItem || catalogItem.supplierIntegrationId !== integration.id) {
        itemErrors.push({
          cjCatalogItemId: requestItem.cjCatalogItemId,
          code: 'CJ_CATALOG_ITEM_NOT_FOUND',
          message: 'CJ catalog item not found for this supplier',
        });
        continue;
      }
      if (catalogItem.syncStatus === 'Failed') {
        itemErrors.push({
          cjCatalogItemId: requestItem.cjCatalogItemId,
          code: 'CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE',
          message: 'CJ catalog item failed to sync and cannot be promoted',
        });
        continue;
      }
      const resolvedPrice =
        requestItem.publicPrice ?? (markup !== undefined ? Number(catalogItem.supplierCost) * markup : undefined);
      if (resolvedPrice === undefined || !Number.isFinite(resolvedPrice) || resolvedPrice <= 0) {
        itemErrors.push({
          cjCatalogItemId: requestItem.cjCatalogItemId,
          code: 'CJ_PROMOTION_PRICE_REQUIRED',
          message: 'publicPrice is required: no explicit price given and CJ_DEFAULT_MARKUP_MULTIPLIER is not configured',
        });
        continue;
      }
      resolvedPrices.set(requestItem.cjCatalogItemId, resolvedPrice);
    }

    if (itemErrors.length > 0) {
      // Nothing is persisted — pre-validation runs entirely before the
      // transaction opens (design.md Risk mitigation: a partially invalid
      // bulk request must not partially succeed).
      throw new CjPromotionValidationError(itemErrors);
    }

    // Idempotency: resolve items already linked to a ProductVariant so they
    // are skipped (not re-created) and their existing product/variant ids are
    // reused for grouping decisions below.
    const alreadyLinked = new Map<number, { productId: number; variantId: number; sku: string }>();
    for (const requestItem of input.items) {
      const variant = await this.variantRepo.findByCjCatalogItemId(requestItem.cjCatalogItemId);
      if (variant && variant.id !== undefined) {
        alreadyLinked.set(requestItem.cjCatalogItemId, { productId: variant.productId, variantId: variant.id, sku: variant.sku });
      }
    }

    const pidOf = (catalogItem: CjCatalogItem): string => catalogItem.pid ?? `no-pid-${catalogItem.externalRef}`;

    // A pid group may already have an existing product from a prior partial
    // promotion — new siblings (same pid, different vid) must join it rather
    // than fork a second Product with the same name.
    const pidToExistingProductId = new Map<string, number>();
    for (const [cjCatalogItemId, linked] of alreadyLinked) {
      const catalogItem = catalogItemsById.get(cjCatalogItemId)!;
      const pid = pidOf(catalogItem);
      const existing = pidToExistingProductId.get(pid);
      if (existing !== undefined && existing !== linked.productId) {
        logger.error('CJ catalog promotion: pid group has inconsistent existing product links', {
          supplierId,
          pid,
          productIds: [existing, linked.productId],
        });
        throw new Error('CJ catalog promotion data integrity fault: inconsistent product links for pid group');
      }
      pidToExistingProductId.set(pid, linked.productId);
    }

    const groups = new Map<string, PidGroup>();
    for (const requestItem of input.items) {
      if (alreadyLinked.has(requestItem.cjCatalogItemId)) continue;
      const catalogItem = catalogItemsById.get(requestItem.cjCatalogItemId)!;
      const pid = pidOf(catalogItem);
      let group = groups.get(pid);
      if (!group) {
        group = { pid, items: [], existingProductId: pidToExistingProductId.get(pid) ?? null };
        groups.set(pid, group);
      }
      group.items.push({
        cjCatalogItemId: requestItem.cjCatalogItemId,
        publicPrice: requestItem.publicPrice,
        compareAtPrice: requestItem.compareAtPrice,
        catalogItem,
      });
    }

    const productsResult: { productId: number; variantIds: number[] }[] = [];
    const variantsResult: PromotedVariantResult[] = [];

    if (groups.size > 0) {
      await prisma.$transaction(async (tx) => {
        for (const group of groups.values()) {
          let productId = group.existingProductId;
          const variantIds: number[] = [];

          if (productId === null) {
            const title = group.items[0]!.catalogItem.title;
            const slug = await this.productService.resolveUniqueSlug(title);
            const productStatus = input.activate ? 'Active' : 'Draft';
            const createdProduct = await tx.product.create({
              data: { name: title, slug, status: productStatus, categoryId },
            });
            productId = createdProduct.id;

            // Image capture is scoped to brand-new products only (design.md
            // D4; see cj-catalog-cursor-and-media/tasks.md 6.2 for the
            // deliberate scope cut on variants later joining an
            // already-existing product from a prior partial promotion).
            // Planned from the WHOLE group (not just the first item) so a
            // product-level image from any item wins as the main image, and —
            // if CJ supplied no product-level image at all — the first
            // variant-level image found still becomes the main image rather
            // than leaving mainImageUrl permanently null despite having
            // captured ProductImage rows.
            const imagePlan = planProductImages(
              group.items.map((gi) => ({ ...extractCjImages(gi.catalogItem.rawPayload), altText: gi.catalogItem.title }))
            );
            if (imagePlan.mainImageUrl) {
              await setProductMainImage(tx, productId, imagePlan.mainImageUrl);
            }
            for (let i = 0; i < imagePlan.images.length; i++) {
              const image = imagePlan.images[i]!;
              await createProductImageRecord(tx, { productId, url: image.url, altText: image.altText, sortOrder: i, color: image.color });
            }
          }

          for (const groupItem of group.items) {
            const resolvedPrice = resolvedPrices.get(groupItem.cjCatalogItemId)!;
            const sku = `CJ-${groupItem.catalogItem.externalRef}`;
            const createdVariant = await tx.productVariant.create({
              data: {
                productId,
                sku,
                size: groupItem.catalogItem.size,
                color: groupItem.catalogItem.color,
                publicPrice: resolvedPrice,
                compareAtPrice: groupItem.compareAtPrice ?? null,
                supplierId: integration.supplierId,
                supplierReference: groupItem.catalogItem.externalRef,
                supplierCost: groupItem.catalogItem.supplierCost,
                stockQuantity: groupItem.catalogItem.stockQuantity,
                stockPolicy: 'SupplierManaged',
                // Always created Active, independent of `input.activate`
                // (which only controls the parent Product's status) —
                // matches this codebase's existing pattern of Draft products
                // with Active variants (see ProductService.create()). A
                // Draft parent already hides the product from every public
                // route regardless of variant status.
                status: 'Active',
                cjCatalogItemId: groupItem.cjCatalogItemId,
              },
            });
            variantIds.push(createdVariant.id);
            variantsResult.push({
              cjCatalogItemId: groupItem.cjCatalogItemId,
              productId,
              productVariantId: createdVariant.id,
              sku,
              wasAlreadyPromoted: false,
            });
          }

          productsResult.push({ productId, variantIds });
        }
      }, PROMOTE_TRANSACTION_OPTIONS);
    }

    for (const [cjCatalogItemId, linked] of alreadyLinked) {
      variantsResult.push({
        cjCatalogItemId,
        productId: linked.productId,
        productVariantId: linked.variantId,
        sku: linked.sku,
        wasAlreadyPromoted: true,
      });
    }

    logger.info('CJ catalog items promoted', {
      supplierId,
      itemsRequested: input.items.length,
      itemsCreated: variantsResult.filter((v) => !v.wasAlreadyPromoted).length,
      itemsAlreadyPromoted: variantsResult.filter((v) => v.wasAlreadyPromoted).length,
    });

    return {
      products: productsResult,
      variants: variantsResult,
      createdAny: groups.size > 0,
    };
  }

  async activate(supplierId: number, cjCatalogItemId: number): Promise<ActivationResult> {
    const { catalogItem } = await this.resolveOwnedCatalogItem(supplierId, cjCatalogItemId);
    const variant = await this.variantRepo.findByCjCatalogItemId(catalogItem.id!);
    if (!variant || variant.id === undefined) throw new CjCatalogItemNotPromotedError();

    // Order matters: the variant must be Active before ProductService.update()
    // evaluates PRODUCT_REQUIRES_ACTIVE_VARIANT via countActiveByProduct, or
    // the guard will incorrectly reject activating the very variant that would
    // satisfy it.
    await this.variantRepo.update(variant.id, { status: 'Active' });
    await this.productService.update(variant.productId, { status: 'Active' });

    return { productId: variant.productId, productVariantId: variant.id };
  }

  async deactivate(supplierId: number, cjCatalogItemId: number): Promise<ActivationResult> {
    const { catalogItem } = await this.resolveOwnedCatalogItem(supplierId, cjCatalogItemId);
    const variant = await this.variantRepo.findByCjCatalogItemId(catalogItem.id!);
    if (!variant || variant.id === undefined) throw new CjCatalogItemNotPromotedError();

    // Only the variant transitions to Inactive — the parent Product's own
    // status is deliberately left untouched (design.md Decision 4). Never
    // clears cjCatalogItemId: the origin link must survive deactivation so
    // the item can be reactivated or re-synced later.
    await this.variantRepo.update(variant.id, { status: 'Inactive' });

    return { productId: variant.productId, productVariantId: variant.id };
  }

  private async resolveOwnedCatalogItem(
    supplierId: number,
    cjCatalogItemId: number
  ): Promise<{ catalogItem: CjCatalogItem }> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();

    const catalogItem = await this.catalogRepo.findById(cjCatalogItemId);
    if (!catalogItem || catalogItem.supplierIntegrationId !== integration.id) {
      throw new CjCatalogItemNotPromotedError();
    }
    return { catalogItem };
  }
}
