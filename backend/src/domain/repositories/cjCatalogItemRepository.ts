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

export interface CjCatalogItemListFilters {
  page?: number;
  pageSize?: number;
  syncStatus?: string;
}

export interface CjCatalogItemListResult {
  items: CjCatalogItem[];
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
}
