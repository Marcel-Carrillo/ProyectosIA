import { CjConnectionService } from '../services/cjConnectionService';
import { CjCatalogSyncService } from '../services/cjCatalogSyncService';
import { CjCatalogPromotionService, PromoteResult } from '../services/cjCatalogPromotionService';
import { ProductService } from '../services/productService';
import { SupplierIntegrationRepository } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { CjCatalogItemRepository } from '../../infrastructure/repositories/cjCatalogItemRepository';
import { CategoryRepository } from '../../infrastructure/repositories/categoryRepository';
import { ProductRepository } from '../../infrastructure/repositories/productRepository';
import { ProductVariantRepository } from '../../infrastructure/repositories/productVariantRepository';
import { ProductTranslationRepository } from '../../infrastructure/repositories/productTranslationRepository';
import { cjClient, CJ_PLACEHOLDER_API_KEY } from '../../infrastructure/external/cjClient';
import { CjPromotionCategoryRequiredError, CjPromotionValidationError } from '../validator';
import { logger } from '../../infrastructure/logger';

export type PromotionSkipReason = 'DEFAULT_CATEGORY_MISSING' | 'PRICE_RESOLUTION_FAILED' | 'NO_PROMOTABLE_ITEMS';

export interface ProviderPipelineResult {
  verifyHealthy: boolean;
  itemsUpserted: number;
  itemsFailed: number;
  variantsCreated: number;
  alreadyPromoted: number;
  promotionSkippedReason?: PromotionSkipReason;
}

export interface SupplierProviderDescriptor {
  key: string;
  isConfigured(): boolean;
  defaultSupplierName: string;
  runPipeline(supplierId: number): Promise<ProviderPipelineResult>;
}

// Module-level wiring mirrors the pattern every existing CJ admin controller
// uses (e.g. presentation/controllers/cjCatalogPromotionController.ts) —
// there is no composition root in this codebase, so each entry point
// constructs its own service graph once at import time.
const supplierIntegrationRepository = new SupplierIntegrationRepository();
const cjCatalogItemRepository = new CjCatalogItemRepository();
const categoryRepository = new CategoryRepository();
const productVariantRepository = new ProductVariantRepository();
const productService = new ProductService(
  new ProductRepository(),
  productVariantRepository,
  new ProductTranslationRepository()
);

const cjConnectionService = new CjConnectionService(supplierIntegrationRepository, cjClient);
const cjCatalogSyncService = new CjCatalogSyncService(supplierIntegrationRepository, cjCatalogItemRepository, cjClient);
const cjCatalogPromotionService = new CjCatalogPromotionService(
  cjCatalogItemRepository,
  categoryRepository,
  productService,
  productVariantRepository,
  supplierIntegrationRepository
);

// Mirrors CjCatalogSyncService.listStagedCatalog's own page-size clamp (100).
const PROMOTION_LIST_PAGE_SIZE = 100;
const MAX_PROMOTION_LIST_PAGES = Number(process.env.CJ_PROMOTION_LIST_MAX_PAGES ?? 500);

async function collectPromotableCatalogItemIds(supplierId: number): Promise<number[]> {
  // A Set, not an array, because the underlying query orders by
  // (createdAt desc, id asc) — a stable tiebreaker that prevents skipped/
  // repeated rows across pages, but a defensive dedupe is kept here too in
  // case a future filter change reintroduces a non-unique ordering.
  const ids = new Set<number>();
  let page = 1;
  for (; page <= MAX_PROMOTION_LIST_PAGES; page++) {
    const result = await cjCatalogSyncService.listStagedCatalog(supplierId, {
      page,
      pageSize: PROMOTION_LIST_PAGE_SIZE,
      syncStatus: 'Synced',
      promotionState: 'NotPromoted',
    });
    for (const entry of result.items) {
      if (entry.item.id !== undefined) ids.add(entry.item.id);
    }
    if (result.items.length < PROMOTION_LIST_PAGE_SIZE) break;
  }
  if (page > MAX_PROMOTION_LIST_PAGES) {
    logger.warn('CJ auto-promotion candidate listing capped at MAX_PROMOTION_LIST_PAGES', {
      supplierId,
      maxPages: MAX_PROMOTION_LIST_PAGES,
    });
  }
  return Array.from(ids);
}

function resolveDefaultCategoryId(): number | undefined {
  const raw = process.env.CJ_DEFAULT_CATEGORY_ID;
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function isConfigured(): boolean {
  const key = process.env.CJDROPSHIPPING_API_KEY;
  return typeof key === 'string' && key.trim().length > 0 && key !== CJ_PLACEHOLDER_API_KEY;
}

// promote() validates the whole batch before writing anything: one item with
// an unresolvable price (e.g. a zero-cost item — sync only rejects negative
// cost, not zero) fails every item in the batch, not just the offender. Left
// unhandled, the same poison item would block the entire remaining catalog's
// auto-promotion on every scheduled run, forever. Retry once, excluding
// exactly the items the error reports, so the rest of the batch still gets
// promoted and only the genuinely bad item(s) are skipped (and re-attempted,
// and re-logged, on the next run — never silently dropped).
async function promoteExcludingPoisonItems(
  supplierId: number,
  ids: number[],
  categoryId: number | undefined
): Promise<PromoteResult> {
  try {
    return await cjCatalogPromotionService.promote(supplierId, {
      items: ids.map((cjCatalogItemId) => ({ cjCatalogItemId })),
      categoryId,
      activate: false, // never change to true — auto-promoted products must stay Draft (design.md D5)
    });
  } catch (err) {
    if (err instanceof CjPromotionValidationError && err.itemErrors.length > 0) {
      const failedIds = new Set(err.itemErrors.map((e) => e.cjCatalogItemId));
      const remaining = ids.filter((id) => !failedIds.has(id));
      if (remaining.length > 0 && remaining.length < ids.length) {
        logger.warn('CJ auto-promotion retrying batch excluding items that failed price/validation resolution', {
          supplierId,
          excludedItemIds: Array.from(failedIds),
        });
        return await cjCatalogPromotionService.promote(supplierId, {
          items: remaining.map((cjCatalogItemId) => ({ cjCatalogItemId })),
          categoryId,
          activate: false,
        });
      }
    }
    throw err;
  }
}

async function runPipeline(supplierId: number): Promise<ProviderPipelineResult> {
  const verifyResult = await cjConnectionService.verifyConnection(supplierId);
  if (!verifyResult.healthy) {
    return { verifyHealthy: false, itemsUpserted: 0, itemsFailed: 0, variantsCreated: 0, alreadyPromoted: 0 };
  }

  const syncResult = await cjCatalogSyncService.syncCatalog(supplierId);
  const base = { verifyHealthy: true, itemsUpserted: syncResult.itemsUpserted, itemsFailed: syncResult.itemsFailed };

  const promotableIds = await collectPromotableCatalogItemIds(supplierId);
  if (promotableIds.length === 0) {
    return { ...base, variantsCreated: 0, alreadyPromoted: 0, promotionSkippedReason: 'NO_PROMOTABLE_ITEMS' };
  }

  const categoryId = resolveDefaultCategoryId();
  try {
    const promoteResult = await promoteExcludingPoisonItems(supplierId, promotableIds, categoryId);
    return {
      ...base,
      variantsCreated: promoteResult.variants.filter((v) => !v.wasAlreadyPromoted).length,
      alreadyPromoted: promoteResult.variants.filter((v) => v.wasAlreadyPromoted).length,
    };
  } catch (err) {
    if (err instanceof CjPromotionCategoryRequiredError) {
      logger.warn('CJ auto-promotion skipped: default category missing or invalid', { supplierId });
      return { ...base, variantsCreated: 0, alreadyPromoted: 0, promotionSkippedReason: 'DEFAULT_CATEGORY_MISSING' };
    }
    if (err instanceof CjPromotionValidationError) {
      logger.warn('CJ auto-promotion skipped: one or more items failed price/validation resolution', { supplierId });
      return { ...base, variantsCreated: 0, alreadyPromoted: 0, promotionSkippedReason: 'PRICE_RESOLUTION_FAILED' };
    }
    throw err; // unexpected — the orchestrator records this as a hard per-provider failure
  }
}

export const cjProviderDescriptor: SupplierProviderDescriptor = {
  key: 'CJDropshipping',
  isConfigured,
  defaultSupplierName: 'CJ Dropshipping',
  runPipeline,
};

// Single-element array today — a future second provider is added here, not by
// editing supplierAutoProvisionService.ts or the job handler (design.md D7).
export const providerRegistry: SupplierProviderDescriptor[] = [cjProviderDescriptor];
