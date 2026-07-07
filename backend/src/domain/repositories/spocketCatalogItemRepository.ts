import { SpocketCatalogItem } from '../models/spocketCatalogItem';

export interface SpocketCatalogItemUpsertInput {
  externalRef: string;
  title: string;
  size?: string | null;
  color?: string | null;
  supplierCost: string;
  stockQuantity: number;
  rawPayload: unknown;
  syncStatus: 'Synced' | 'Failed';
  syncError?: string | null;
  lastSyncedAt: Date;
}

export interface SpocketCatalogItemListFilters {
  page?: number;
  pageSize?: number;
  syncStatus?: string;
}

export interface SpocketCatalogItemListResult {
  items: SpocketCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ISpocketCatalogItemRepository {
  upsertMany(
    supplierIntegrationId: number,
    items: SpocketCatalogItemUpsertInput[]
  ): Promise<{ upserted: number }>;
  findBySupplierIntegrationId(
    supplierIntegrationId: number,
    filters?: SpocketCatalogItemListFilters
  ): Promise<SpocketCatalogItemListResult>;
}
