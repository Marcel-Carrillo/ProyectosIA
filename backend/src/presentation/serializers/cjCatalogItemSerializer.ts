import { CjCatalogItem } from '../../domain/models/cjCatalogItem';

export interface CjCatalogItemResponseDTO {
  id: number | undefined;
  externalRef: string;
  title: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  supplierCost: string;
  stockQuantity: number;
  syncStatus: string;
  syncError: string | null;
  lastSyncedAt: Date | null | undefined;
}

// Explicit allow-list matching the documented `CjCatalogItem` fields in the
// cj-catalog-sync spec — deliberately excludes `supplierIntegrationId`, `pid`,
// `vid`, `categoryId`, `sellPrice`, `warehouseInventoryNum`, and `rawPayload`
// (raw upstream CJ payload), which are internal-only and not part of the
// documented admin API contract.
export function serializeCjCatalogItem(item: CjCatalogItem): CjCatalogItemResponseDTO {
  return {
    id: item.id,
    externalRef: item.externalRef,
    title: item.title,
    sku: item.sku ?? null,
    size: item.size ?? null,
    color: item.color ?? null,
    supplierCost: item.supplierCost,
    stockQuantity: item.stockQuantity,
    syncStatus: item.syncStatus,
    syncError: item.syncError ?? null,
    lastSyncedAt: item.lastSyncedAt,
  };
}
