import { ISupplierIntegrationRepository } from '../../domain/repositories/supplierIntegrationRepository';
import {
  ICjCatalogItemRepository,
  CjCatalogItemUpsertInput,
  CjCatalogItemListResult,
  CjPromotionState,
} from '../../domain/repositories/cjCatalogItemRepository';
import { ICjClient } from '../../infrastructure/external/cjTypes';
import { CjApiError } from '../../infrastructure/external/cjClient';
import { SupplierIntegrationNotFoundError } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { CjConnectionNotReadyError, CjApiUnavailableError } from '../validator';
import { logger } from '../../infrastructure/logger';
import { extractCjVariantAttributes } from './cjVariantAttributeExtraction';

const MAX_PAGE_SIZE = 100;

export interface SyncCatalogResult {
  itemsUpserted: number;
  itemsFailed: number;
  syncedAt: Date;
}

// Guards against a misconfigured SSM value (empty, zero, negative, or
// non-numeric) silently producing endPage < startPage, which would make
// syncCatalog's window loop never execute — a permanently-stuck, zero-progress
// "successful" sync with no error, no cursor advancement, ever again. Falls
// back to the safe default and logs a warning instead of trusting the raw
// parse, mirroring the existing Number.isFinite guard style already used by
// CjCatalogPromotionService.getDefaultMarkupMultiplier for the same class of
// env-var-misconfiguration risk.
function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (Number.isInteger(value) && value > 0) return value;
  logger.warn('Invalid value for env var, falling back to default', { name, raw, fallback });
  return fallback;
}

export class CjCatalogSyncService {
  private readonly maxSyncPages: number;
  private readonly catalogPageSize: number;

  constructor(
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly catalogRepo: ICjCatalogItemRepository,
    private readonly cjClient: ICjClient
  ) {
    this.maxSyncPages = parsePositiveIntEnv('CJ_SYNC_MAX_PAGES', 500);
    this.catalogPageSize = parsePositiveIntEnv('CJ_CATALOG_PAGE_SIZE', 100);
  }

  async syncCatalog(supplierId: number): Promise<SyncCatalogResult> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();
    if (integration.status !== 'Connected') throw new CjConnectionNotReadyError();

    const items: CjCatalogItemUpsertInput[] = [];
    let itemsFailed = 0;
    let failedItemSequence = 0;
    const now = new Date();

    const cursorPage = integration.catalogSyncCursorPage ?? 0;
    const startPage = cursorPage + 1;
    const endPage = startPage + this.maxSyncPages - 1;

    // CJ's listV2 is page-number based (page/size), not a nextPageToken cursor.
    // Each run processes a *window* of `maxSyncPages` pages starting right
    // after the last page this connection finished (design.md D1 in
    // openspec/changes/cj-catalog-cursor-and-media) — not "pages 1..N from the
    // start" like the old always-restart-at-page-1 behavior. `totalPages`
    // starts unknown (`null`) so the first fetch of this window always runs
    // (matching the previous do-while's "always at least one iteration"
    // behavior); every subsequent iteration is bounded by both the window
    // (`endPage`) and the freshly-learned `totalPages`, so this never fetches
    // a page known in advance to be past the end of the catalog.
    let page = startPage;
    let totalPages: number | null = null;
    let lastPageProcessed = cursorPage;

    while (page <= endPage && (totalPages === null || page <= totalPages)) {
      let listPage;
      try {
        listPage = await this.cjClient.fetchCatalog(page, this.catalogPageSize);
      } catch (err) {
        logger.error('CJ Dropshipping catalog fetch failed', {
          supplierId,
          status: err instanceof CjApiError ? err.status : undefined,
        });
        throw new CjApiUnavailableError();
      }
      totalPages = listPage.totalPages || 1;

      const products = listPage.content.flatMap((entry) => entry.productList);
      for (const product of products) {
        let variants;
        try {
          variants = await this.cjClient.fetchVariants(product.id);
        } catch (err) {
          // A single product's variant lookup failing does not abort the
          // whole sync — record one failed item for the product and continue.
          itemsFailed += 1;
          failedItemSequence += 1;
          logger.warn('CJ Dropshipping variant fetch failed for a product', {
            supplierId,
            pid: product.id,
            status: err instanceof CjApiError ? err.status : undefined,
          });
          items.push({
            externalRef: `unknown-${product.id}-${failedItemSequence}`,
            pid: product.id,
            title: product.nameEn ?? 'Unknown',
            supplierCost: '0.00',
            stockQuantity: 0,
            rawPayload: { product },
            syncStatus: 'Failed',
            syncError: 'Failed to fetch variants',
            lastSyncedAt: now,
          });
          continue;
        }

        for (const variant of variants) {
          try {
            if (!variant.vid) throw new Error('Missing vid');
            if (!Number.isFinite(variant.variantSellPrice) || variant.variantSellPrice < 0) {
              throw new Error('Invalid variantSellPrice');
            }
            const stockQuantity = variant.inventoryNum ?? product.warehouseInventoryNum ?? 0;
            if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
              throw new Error('Invalid stockQuantity');
            }
            const { size, color } = extractCjVariantAttributes({
              variantKey: variant.variantKey,
              variantNameEn: variant.variantNameEn,
              variantProperty: variant.variantProperty,
            });
            items.push({
              externalRef: variant.vid,
              pid: product.id,
              vid: variant.vid,
              sku: variant.variantSku,
              categoryId: product.categoryId,
              title: product.nameEn,
              size,
              color,
              supplierCost: variant.variantSellPrice.toFixed(2),
              // CJ's real API does not reliably return sellPrice as a number
              // (observed as a numeric string on some catalog entries despite
              // the documented/typed contract) — coerce defensively rather
              // than trusting the declared type, mirroring the
              // Number.isFinite(variantSellPrice) guard above.
              sellPrice:
                product.sellPrice != null && Number.isFinite(Number(product.sellPrice))
                  ? Number(product.sellPrice).toFixed(2)
                  : null,
              stockQuantity,
              warehouseInventoryNum: product.warehouseInventoryNum ?? null,
              rawPayload: { product, variant },
              syncStatus: 'Synced',
              lastSyncedAt: now,
            });
          } catch (mapErr) {
            itemsFailed += 1;
            failedItemSequence += 1;
            items.push({
              // Suffixed with a per-sync sequence number so multiple invalid,
              // vid-less variants under the same product never collide on the
              // (supplierIntegrationId, externalRef) unique key.
              externalRef: variant.vid ?? `unknown-${product.id}-${failedItemSequence}`,
              pid: product.id,
              title: product.nameEn ?? 'Unknown',
              supplierCost: '0.00',
              stockQuantity: 0,
              rawPayload: { product, variant },
              syncStatus: 'Failed',
              syncError: mapErr instanceof Error ? mapErr.message : 'Mapping failed',
              lastSyncedAt: now,
            });
          }
        }
      }

      lastPageProcessed = page;
      page += 1;
    }

    // totalPages is only ever null if the loop body never ran, which cannot
    // happen — maxSyncPages is always >= 1, so startPage <= endPage always.
    const resolvedTotalPages = totalPages ?? 1;
    const wrapped = lastPageProcessed >= resolvedTotalPages;
    const newCursorPage = wrapped ? 0 : lastPageProcessed;

    logger.info('CJ Dropshipping catalog sync window complete', {
      supplierId,
      startPage,
      lastPageProcessed,
      totalPages: resolvedTotalPages,
      wrapped,
    });

    const { upserted } = await this.catalogRepo.upsertMany(integration.id, items);

    // Push freshly-synced stock levels onto promoted variants so the
    // storefront stops selling variants whose CJ stock reached 0 (and brings
    // them back automatically when CJ restocks).
    const stockReconciliation = await this.catalogRepo.reconcilePromotedVariantStock(integration.id);
    if (stockReconciliation.deactivated > 0 || stockReconciliation.reactivated > 0) {
      logger.info('CJ stock reconciliation applied to promoted variants', {
        supplierId,
        ...stockReconciliation,
      });
    }

    await this.integrationRepo.updateCatalogSyncCursor(integration.id, {
      cursorPage: newCursorPage,
      totalPages: resolvedTotalPages,
      ...(wrapped && { wrappedAt: now }),
    });
    await this.integrationRepo.updateLastSyncedAt(integration.id, now);

    return { itemsUpserted: upserted - itemsFailed, itemsFailed, syncedAt: now };
  }

  async listStagedCatalog(
    supplierId: number,
    params: { page?: number; pageSize?: number; syncStatus?: string; promotionState?: CjPromotionState }
  ): Promise<CjCatalogItemListResult> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();

    const pageSize =
      params.pageSize !== undefined ? Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE) : 20;
    return this.catalogRepo.findBySupplierIntegrationId(integration.id, { ...params, pageSize });
  }
}
