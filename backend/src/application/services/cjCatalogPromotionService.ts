import { prisma } from '../../infrastructure/prismaClient';
import { ICjCatalogItemRepository } from '../../domain/repositories/cjCatalogItemRepository';
import { ICategoryRepository } from '../../domain/repositories';
import { ISupplierIntegrationRepository } from '../../domain/repositories/supplierIntegrationRepository';
import { IProductVariantRepository } from '../../domain/repositories/productRepository';
import { IAutomationSettingsRepository } from '../../domain/repositories/automationSettingsRepository';
import { ICjClient } from '../../infrastructure/external/cjTypes';
import { CjCatalogItem } from '../../domain/models/cjCatalogItem';
import { ProductService } from './productService';
import { SupplierIntegrationNotFoundError } from '../../infrastructure/repositories/supplierIntegrationRepository';
import {
  CjPromotionCategoryRequiredError,
  CjCatalogItemNotPromotedError,
  CjPromotionValidationError,
  CjPromotionItemError,
  CjPromotionRequestInput,
  CjApiUnavailableError,
} from '../validator';
import { logger } from '../../infrastructure/logger';
import { extractCjImages, planProductImages } from './cjImageExtraction';
import { setProductMainImage, createProductImageRecord } from './cjProductImageSync';
import { roundToPsychologicalPrice } from './pricing';
import { buildCjCategoryResolver } from './cjCategoryResolution';

const DEFAULT_MARKUP_ENV = 'CJ_DEFAULT_MARKUP_MULTIPLIER';
const DEFAULT_CATEGORY_ENV = 'CJ_DEFAULT_CATEGORY_ID';
const CJ_PROVIDER = 'CJDropshipping';

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
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly settingsRepo: IAutomationSettingsRepository,
    private readonly cjClient: ICjClient
  ) {}

  private getDefaultMarkupMultiplier(): number | undefined {
    const raw = process.env[DEFAULT_MARKUP_ENV];
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  // Resolves the store's configured fallback category — used only when CJ's
  // own taxonomy can't be resolved for a group (no explicit categoryId, no
  // CjCatalogItem.categoryId, or the CJ categories API is unavailable).
  // Mirrors getDefaultMarkupMultiplier()'s pattern of reading its env var
  // directly in this service, so both the manual promote request and the
  // automated auto-provisioning pipeline (which no longer passes its own
  // categoryId — see providerRegistry.ts) share one fallback resolution.
  private async resolveFallbackCategoryId(): Promise<number | undefined> {
    const raw = process.env[DEFAULT_CATEGORY_ENV];
    if (!raw) return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) return undefined;
    const category = await this.categoryRepo.findById(value);
    return category?.id;
  }

  async promote(supplierId: number, input: CjPromotionRequestInput): Promise<PromoteResult> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();

    // An explicit categoryId is an admin override: validated up front and
    // short-circuits CJ taxonomy resolution entirely for the whole request
    // (design.md Decision 6), preserving the exact error ordering/behavior
    // this codebase already had before CJ-taxonomy auto-resolution existed.
    let explicitCategoryId: number | undefined;
    if (input.categoryId !== undefined) {
      const category = await this.categoryRepo.findById(input.categoryId);
      if (!category || category.id === undefined) throw new CjPromotionCategoryRequiredError();
      explicitCategoryId = category.id;
    }

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

    // Category resolution per pid-group — entirely before the write
    // transaction opens (design.md Decision 2), so a CJ API failure during
    // resolution degrades to the fallback instead of leaving a half-open
    // transaction. Only groups that will create a brand-new Product need a
    // category at all; a group joining an already-existing product (via
    // existingProductId) reuses that product's category untouched.
    const categoryIdByPid = new Map<string, number>();
    // Groups that fail to resolve a category are NOT thrown on immediately —
    // every group is attempted, and unresolvable ones are collected here so
    // the whole batch's worth of resolvable groups can still be reported as
    // resolved before the aggregate throw below. This lets a caller that
    // retries excluding poison items (providerRegistry's auto-provisioning
    // pipeline, mirroring its existing CjPromotionValidationError retry)
    // exclude exactly the offending pid-group(s) and re-call promote() with
    // the rest — satisfying the auto-provisioning spec's "other resolvable
    // items in the same run SHALL still be promoted" requirement, instead of
    // one poison item silently blocking the entire remaining batch forever.
    const categoryItemErrors: CjPromotionItemError[] = [];
    const groupsNeedingCategory = Array.from(groups.values()).filter((g) => g.existingProductId === null);
    if (groupsNeedingCategory.length > 0) {
      // fetchCategories() is called at most once per promote() invocation
      // (design.md Decision 3), reused across every group below — skipped
      // entirely when every group's category is resolved via an explicit
      // override, or when no group's catalog item even has a CJ categoryId
      // to look up (avoids a wasted CJ API call when resolution couldn't
      // possibly succeed).
      const hasResolvableGroup = groupsNeedingCategory.some((g) => !!g.items[0]!.catalogItem.categoryId);
      const resolution =
        explicitCategoryId === undefined && hasResolvableGroup
          ? await buildCjCategoryResolver(this.cjClient)
          : undefined;

      for (const group of groupsNeedingCategory) {
        let resolvedCategoryId = explicitCategoryId;

        if (resolvedCategoryId === undefined) {
          // CJ's categoryId is product-level, so every item in the group
          // shares the same value — read it off the first item.
          const externalCategoryId = group.items[0]!.catalogItem.categoryId;
          if (externalCategoryId && resolution) {
            const name = resolution.resolve(externalCategoryId);
            if (name) {
              const category = await this.categoryRepo.findOrCreateByExternalRef(
                CJ_PROVIDER,
                externalCategoryId,
                name
              );
              resolvedCategoryId = category.id;
            }
          }
        }

        if (resolvedCategoryId === undefined) {
          resolvedCategoryId = await this.resolveFallbackCategoryId();
        }

        if (resolvedCategoryId === undefined) {
          for (const groupItem of group.items) {
            categoryItemErrors.push({
              cjCatalogItemId: groupItem.cjCatalogItemId,
              code: 'CJ_PROMOTION_CATEGORY_REQUIRED',
              message: 'Could not resolve a category for this item: no CJ category match and no fallback configured',
            });
          }
          continue;
        }

        categoryIdByPid.set(group.pid, resolvedCategoryId);
      }

      if (categoryItemErrors.length > 0) {
        // Whole-call abort either way — nothing is persisted from this
        // attempt (matches the existing pre-transaction validation discipline
        // used for price errors). itemErrors lets a retrying caller exclude
        // just the offending items; a direct manual-endpoint caller that
        // doesn't retry still gets its existing all-or-nothing 422 behavior.
        throw new CjPromotionCategoryRequiredError(undefined, categoryItemErrors);
      }
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
            const categoryId = categoryIdByPid.get(group.pid)!;
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

  // Read-only freight lookup for a catalog item that hasn't been promoted to
  // a ProductVariant yet — reuses the same CJ freight-quote client as
  // ProductVariantService.refreshFreightEstimate, but keyed off the catalog
  // item's own externalRef (vid) since no variant exists at this point. Lets
  // the admin see the real supplier shipping cost, and a suggested public
  // price that already includes it, before promoting/activating a product.
  async estimateFreight(
    supplierId: number,
    cjCatalogItemId: number,
    destinationCountry?: string
  ): Promise<{ shippingCostEstimate: number; suggestedPublicPrice: number }> {
    const { catalogItem } = await this.resolveOwnedCatalogItem(supplierId, cjCatalogItemId);

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
    const markup = this.getDefaultMarkupMultiplier();
    const supplierCost = Number(catalogItem.supplierCost);
    const rawPrice =
      markup !== undefined ? supplierCost * markup + lowest.logisticPrice : supplierCost + lowest.logisticPrice;

    return {
      shippingCostEstimate: lowest.logisticPrice,
      suggestedPublicPrice: roundToPsychologicalPrice(rawPrice),
    };
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
