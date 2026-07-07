import { SpocketCatalogItem } from '../../domain/models/spocketCatalogItem';

export interface SpocketCatalogItemResponseDTO {
  id: number | undefined;
  externalRef: string;
  title: string;
  size: string | null;
  color: string | null;
  supplierCost: string;
  stockQuantity: number;
  syncStatus: string;
  syncError: string | null;
  lastSyncedAt: Date | null | undefined;
}

// Explicit allow-list matching the documented `SpocketCatalogItem` schema in
// docs/api-spec.yml — deliberately excludes `supplierIntegrationId` and
// `rawPayload` (raw upstream Spocket payload), which are internal-only and were
// never part of the documented admin API contract.
export function serializeSpocketCatalogItem(item: SpocketCatalogItem): SpocketCatalogItemResponseDTO {
  return {
    id: item.id,
    externalRef: item.externalRef,
    title: item.title,
    size: item.size ?? null,
    color: item.color ?? null,
    supplierCost: item.supplierCost,
    stockQuantity: item.stockQuantity,
    syncStatus: item.syncStatus,
    syncError: item.syncError ?? null,
    lastSyncedAt: item.lastSyncedAt,
  };
}
