import { CjCatalogItemListItem, CjPromotionState } from '../../domain/repositories/cjCatalogItemRepository';

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
  promotionState: CjPromotionState;
  productId: number | null;
  productVariantId: number | null;
}

// Explicit allow-list matching the documented `CjCatalogItem` fields in the
// cj-catalog-sync spec — deliberately excludes `supplierIntegrationId`, `pid`,
// `vid`, `categoryId`, `sellPrice`, `warehouseInventoryNum`, and `rawPayload`
// (raw upstream CJ payload), which are internal-only and not part of the
// documented admin API contract. `promotionState`/`productId`/`productVariantId`
// are derived (never stored on CjCatalogItem) and safe to expose — they never
// carry cjCatalogItemId, supplierCost internals beyond the already-allowed
// field, or any other supplier-internal data.
export function serializeCjCatalogItem(entry: CjCatalogItemListItem): CjCatalogItemResponseDTO {
  const { item, promotionState, productId, productVariantId } = entry;
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
    promotionState,
    productId,
    productVariantId,
  };
}
