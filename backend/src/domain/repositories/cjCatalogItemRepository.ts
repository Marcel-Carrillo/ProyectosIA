import { CjCatalogItem } from '../models/cjCatalogItem';

export interface CjCatalogItemUpsertInput {
  externalRef: string;
  pid?: string | null;
  vid?: string | null;
  sku?: string | null;
  categoryId?: string | null;
  title: string;
  size?: string | null;
  color?: string | null;
  supplierCost: string;
  sellPrice?: string | null;
  stockQuantity: number;
  warehouseInventoryNum?: number | null;
  rawPayload: unknown;
  syncStatus: 'Synced' | 'Failed';
  syncError?: string | null;
  lastSyncedAt: Date;
}

export type CjPromotionState = 'NotPromoted' | 'Active' | 'Inactive';

export interface CjCatalogItemListFilters {
  page?: number;
  pageSize?: number;
  syncStatus?: string;
  promotionState?: CjPromotionState;
}

// One staged catalog item plus its derived promotion status. promotionState is
// never persisted on CjCatalogItem itself — it's computed from whether a
// ProductVariant links back to this row via cjCatalogItemId (see
// infrastructure/repositories/cjCatalogItemRepository.ts).
export interface CjCatalogItemListItem {
  item: CjCatalogItem;
  promotionState: CjPromotionState;
  productId: number | null;
  productVariantId: number | null;
}

export interface CjCatalogItemListResult {
  items: CjCatalogItemListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ICjCatalogItemRepository {
  upsertMany(
    supplierIntegrationId: number,
    items: CjCatalogItemUpsertInput[]
  ): Promise<{ upserted: number }>;
  findBySupplierIntegrationId(
    supplierIntegrationId: number,
    filters?: CjCatalogItemListFilters
  ): Promise<CjCatalogItemListResult>;
  findByExternalRef(supplierIntegrationId: number, externalRef: string): Promise<CjCatalogItem | null>;
  findById(id: number): Promise<CjCatalogItem | null>;
  findManyByIds(ids: number[]): Promise<CjCatalogItem[]>;
}
