import { ISupplierIntegrationRepository } from '../../domain/repositories/supplierIntegrationRepository';
import {
  ICjCatalogItemRepository,
  CjCatalogItemUpsertInput,
  CjCatalogItemListResult,
} from '../../domain/repositories/cjCatalogItemRepository';
import { ICjClient } from '../../infrastructure/external/cjTypes';
import { CjApiError } from '../../infrastructure/external/cjClient';
import { SupplierIntegrationNotFoundError } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { CjConnectionNotReadyError, CjApiUnavailableError } from '../validator';
import { logger } from '../../infrastructure/logger';

const MAX_PAGE_SIZE = 100;
const MAX_SYNC_PAGES = Number(process.env.CJ_SYNC_MAX_PAGES ?? 500);
const CATALOG_PAGE_SIZE = Number(process.env.CJ_CATALOG_PAGE_SIZE ?? 100);

export interface SyncCatalogResult {
  itemsUpserted: number;
  itemsFailed: number;
  syncedAt: Date;
}

// Parses CJ's `variantProperty` field: a JSON-encoded array of { key, value }
// attribute pairs (e.g. size/color for fashion items). Falls back to nulls for
// non-fashion items that don't carry these attributes — this is best-effort
// enrichment, never a reason to fail the item.
function parseSizeColor(variantProperty: string | undefined): { size: string | null; color: string | null } {
  if (!variantProperty) return { size: null, color: null };
  try {
    const parsed = JSON.parse(variantProperty) as Array<{ key?: string; value?: string }>;
    if (!Array.isArray(parsed)) return { size: null, color: null };
    const size = parsed.find((p) => /size/i.test(p.key ?? ''))?.value ?? null;
    const color = parsed.find((p) => /colou?r/i.test(p.key ?? ''))?.value ?? null;
    return { size, color };
  } catch {
    return { size: null, color: null };
  }
}

export class CjCatalogSyncService {
  constructor(
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly catalogRepo: ICjCatalogItemRepository,
    private readonly cjClient: ICjClient
  ) {}

  async syncCatalog(supplierId: number): Promise<SyncCatalogResult> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();
    if (integration.status !== 'Connected') throw new CjConnectionNotReadyError();

    const items: CjCatalogItemUpsertInput[] = [];
    let itemsFailed = 0;
    let failedItemSequence = 0;
    const now = new Date();

    // CJ's listV2 is page-number based (page/size), not a nextPageToken cursor
    // — bounded both by the response's own totalPages AND the MAX_SYNC_PAGES
    // safety cap (a totalPages that's wildly wrong shouldn't loop forever).
    let page = 1;
    let totalPages = 1;
    do {
      let listPage;
      try {
        listPage = await this.cjClient.fetchCatalog(page, CATALOG_PAGE_SIZE);
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
            const { size, color } = parseSizeColor(variant.variantProperty);
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
              sellPrice: product.sellPrice != null ? product.sellPrice.toFixed(2) : null,
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

      page += 1;
      if (page > MAX_SYNC_PAGES && page <= totalPages) {
        logger.warn('CJ Dropshipping catalog sync capped at MAX_SYNC_PAGES', {
          supplierId,
          maxPages: MAX_SYNC_PAGES,
          totalPages,
        });
        break;
      }
    } while (page <= totalPages);

    const { upserted } = await this.catalogRepo.upsertMany(integration.id, items);
    await this.integrationRepo.updateLastSyncedAt(integration.id, now);

    return { itemsUpserted: upserted - itemsFailed, itemsFailed, syncedAt: now };
  }

  async listStagedCatalog(
    supplierId: number,
    params: { page?: number; pageSize?: number; syncStatus?: string }
  ): Promise<CjCatalogItemListResult> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();

    const pageSize =
      params.pageSize !== undefined ? Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE) : 20;
    return this.catalogRepo.findBySupplierIntegrationId(integration.id, { ...params, pageSize });
  }
}
