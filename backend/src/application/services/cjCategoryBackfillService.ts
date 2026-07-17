import { ICategoryRepository } from '../../domain/repositories';
import { IProductRepository, IProductVariantRepository } from '../../domain/repositories/productRepository';
import { ICjCatalogItemRepository } from '../../domain/repositories/cjCatalogItemRepository';
import { ISupplierIntegrationRepository } from '../../domain/repositories/supplierIntegrationRepository';
import { ICjClient } from '../../infrastructure/external/cjTypes';
import { SupplierIntegrationNotFoundError } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { CjPromotionCategoryRequiredError } from '../validator';
import { buildCjCategoryResolver } from './cjCategoryResolution';
import { logger } from '../../infrastructure/logger';

const DEFAULT_CATEGORY_ENV = 'CJ_DEFAULT_CATEGORY_ID';
const CJ_PROVIDER = 'CJDropshipping';

export type RecategorizeSkipReason =
  | 'NO_CJ_CATEGORY_MAPPING'
  | 'CONFLICTING_CJ_CATEGORIES'
  | 'CJ_CATEGORY_RESOLUTION_FAILED'
  | 'CATEGORY_CHANGED_CONCURRENTLY';

export interface RecategorizeResult {
  fromCategoryId: number;
  reassigned: { productId: number; toCategoryId: number }[];
  skipped: { productId: number; reason: RecategorizeSkipReason }[];
}

// Admin-triggered, idempotent maintenance action (design.md Decision 7): finds
// every Product still sitting under the configured CJ_DEFAULT_CATEGORY_ID
// fallback, resolves its real CJ category from its variants' linked
// CjCatalogItem.categoryId (reusing the same resolver/find-or-create as
// promote() — see cjCategoryResolution.ts, CategoryRepository.findOrCreateByExternalRef),
// and reassigns it. Idempotency and never-touch-an-admin-recategorized-product
// both fall out of the read filter (only products CURRENTLY at fromCategoryId
// are candidates) plus the atomic conditional write
// (reassignCategoryIfCurrentlyCategory) that closes the read-then-write race.
export class CjCategoryBackfillService {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly variantRepo: IProductVariantRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly catalogRepo: ICjCatalogItemRepository,
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly cjClient: ICjClient
  ) {}

  async recategorize(supplierId: number): Promise<RecategorizeResult> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();

    const fromCategoryId = await this.resolveTargetCategoryId();
    if (fromCategoryId === undefined) throw new CjPromotionCategoryRequiredError();

    const rows = await this.variantRepo.findManyByProductCategoryId(fromCategoryId);
    const byProduct = new Map<number, { cjCatalogItemId: number | null }[]>();
    for (const row of rows) {
      const list = byProduct.get(row.productId) ?? [];
      list.push({ cjCatalogItemId: row.cjCatalogItemId });
      byProduct.set(row.productId, list);
    }

    const allCjCatalogItemIds = rows.map((r) => r.cjCatalogItemId).filter((id): id is number => id !== null);
    const catalogItems = allCjCatalogItemIds.length > 0 ? await this.catalogRepo.findManyByIds(allCjCatalogItemIds) : [];
    const catalogItemsById = new Map(catalogItems.filter((ci) => ci.id !== undefined).map((ci) => [ci.id!, ci]));

    const resolver = await buildCjCategoryResolver(this.cjClient);

    const reassigned: RecategorizeResult['reassigned'] = [];
    const skipped: RecategorizeResult['skipped'] = [];

    for (const [productId, variants] of byProduct) {
      // Only this supplier's own CJ catalog items count toward resolution.
      const ownCategoryIds = new Set(
        variants
          .map((v) => (v.cjCatalogItemId !== null ? catalogItemsById.get(v.cjCatalogItemId) : undefined))
          .filter((ci): ci is NonNullable<typeof ci> => ci !== undefined && ci.supplierIntegrationId === integration.id)
          .map((ci) => ci.categoryId)
          .filter((id): id is string => !!id)
      );

      if (ownCategoryIds.size === 0) {
        skipped.push({ productId, reason: 'NO_CJ_CATEGORY_MAPPING' });
        continue;
      }
      if (ownCategoryIds.size > 1) {
        skipped.push({ productId, reason: 'CONFLICTING_CJ_CATEGORIES' });
        continue;
      }

      const externalCategoryId = [...ownCategoryIds][0]!;
      const name = resolver.resolve(externalCategoryId);
      if (!name) {
        skipped.push({ productId, reason: 'CJ_CATEGORY_RESOLUTION_FAILED' });
        continue;
      }

      const category = await this.categoryRepo.findOrCreateByExternalRef(CJ_PROVIDER, externalCategoryId, name);
      if (category.id === undefined) {
        skipped.push({ productId, reason: 'CJ_CATEGORY_RESOLUTION_FAILED' });
        continue;
      }

      const didReassign = await this.productRepo.reassignCategoryIfCurrentlyCategory(productId, fromCategoryId, category.id);
      if (didReassign) {
        reassigned.push({ productId, toCategoryId: category.id });
      } else {
        skipped.push({ productId, reason: 'CATEGORY_CHANGED_CONCURRENTLY' });
      }
    }

    logger.info('CJ category backfill run completed', {
      supplierId,
      fromCategoryId,
      reassignedCount: reassigned.length,
      skippedCount: skipped.length,
    });

    return { fromCategoryId, reassigned, skipped };
  }

  // Mirrors CjCatalogPromotionService.resolveFallbackCategoryId() — the
  // backfill only ever targets whatever category the fallback env var
  // currently resolves to, since that's the only category promote() could
  // have force-assigned before this change shipped.
  private async resolveTargetCategoryId(): Promise<number | undefined> {
    const raw = process.env[DEFAULT_CATEGORY_ENV];
    if (!raw) return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) return undefined;
    const category = await this.categoryRepo.findById(value);
    return category?.id;
  }
}
