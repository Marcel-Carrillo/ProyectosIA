import { ISupplierIntegrationRepository } from '../../domain/repositories/supplierIntegrationRepository';
import {
  ISpocketCatalogItemRepository,
  SpocketCatalogItemUpsertInput,
  SpocketCatalogItemListResult,
} from '../../domain/repositories/spocketCatalogItemRepository';
import { ISpocketClient } from '../../infrastructure/external/spocketTypes';
import { SpocketApiError } from '../../infrastructure/external/spocketClient';
import { SupplierIntegrationNotFoundError } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { SpocketConnectionNotReadyError, SpocketApiUnavailableError } from '../validator';
import { logger } from '../../infrastructure/logger';

const MAX_PAGE_SIZE = 100;
const MAX_SYNC_PAGES = 500;

export interface SyncCatalogResult {
  itemsUpserted: number;
  itemsFailed: number;
  syncedAt: Date;
}

export class SpocketCatalogSyncService {
  constructor(
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly catalogRepo: ISpocketCatalogItemRepository,
    private readonly spocketClient: ISpocketClient
  ) {}

  async syncCatalog(supplierId: number): Promise<SyncCatalogResult> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();
    if (integration.status !== 'Connected') throw new SpocketConnectionNotReadyError();

    const items: SpocketCatalogItemUpsertInput[] = [];
    let itemsFailed = 0;
    const now = new Date();

    let pageToken: string | undefined;
    let pageCount = 0;
    let failedItemSequence = 0;
    do {
      let page;
      try {
        page = await this.spocketClient.fetchCatalog(pageToken);
      } catch (err) {
        // Total upstream outage: abort the whole sync, leave existing staged
        // records untouched.
        logger.error('Spocket catalog fetch failed', {
          supplierId,
          status: err instanceof SpocketApiError ? err.status : undefined,
        });
        throw new SpocketApiUnavailableError();
      }

      for (const product of page.products) {
        for (const variant of product.variants) {
          try {
            if (!variant.externalRef) throw new Error('Missing externalRef');
            if (!Number.isFinite(variant.cost) || variant.cost < 0) {
              throw new Error('Invalid cost');
            }
            if (!Number.isInteger(variant.stockQuantity) || variant.stockQuantity < 0) {
              throw new Error('Invalid stockQuantity');
            }
            items.push({
              externalRef: variant.externalRef,
              title: product.title,
              size: variant.size ?? null,
              color: variant.color ?? null,
              supplierCost: variant.cost.toFixed(2),
              stockQuantity: variant.stockQuantity,
              rawPayload: { product, variant },
              syncStatus: 'Synced',
              lastSyncedAt: now,
            });
          } catch (mapErr) {
            itemsFailed += 1;
            failedItemSequence += 1;
            items.push({
              // Suffixed with a per-sync sequence number so multiple invalid,
              // externalRef-less variants under the same product never collide
              // on the (supplierIntegrationId, externalRef) unique key.
              externalRef: variant.externalRef ?? `unknown-${product.externalRef}-${failedItemSequence}`,
              title: product.title ?? 'Unknown',
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
      pageToken = page.nextPageToken ?? undefined;
      pageCount += 1;
      if (pageCount >= MAX_SYNC_PAGES && pageToken) {
        logger.error('Spocket catalog sync aborted: page count exceeded safety cap', {
          supplierId,
          pageCount,
        });
        throw new SpocketApiUnavailableError('Spocket catalog sync aborted: too many pages');
      }
    } while (pageToken);

    const { upserted } = await this.catalogRepo.upsertMany(integration.id, items);
    await this.integrationRepo.updateLastSyncedAt(integration.id, now);

    return { itemsUpserted: upserted - itemsFailed, itemsFailed, syncedAt: now };
  }

  async listStagedCatalog(
    supplierId: number,
    params: { page?: number; pageSize?: number; syncStatus?: string }
  ): Promise<SpocketCatalogItemListResult> {
    const integration = await this.integrationRepo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();

    const pageSize =
      params.pageSize !== undefined ? Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE) : 20;
    return this.catalogRepo.findBySupplierIntegrationId(integration.id, { ...params, pageSize });
  }
}
