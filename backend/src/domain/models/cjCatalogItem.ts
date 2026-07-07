export type CjSyncStatus = 'Synced' | 'Failed';

export class CjCatalogItem {
  id?: number;
  supplierIntegrationId: number;
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
  syncStatus: CjSyncStatus;
  syncError?: string | null;
  lastSyncedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    supplierIntegrationId: number;
    externalRef: string;
    pid?: string | null;
    vid?: string | null;
    sku?: string | null;
    categoryId?: string | null;
    title: string;
    size?: string | null;
    color?: string | null;
    supplierCost: string | number;
    sellPrice?: string | number | null;
    stockQuantity: number;
    warehouseInventoryNum?: number | null;
    rawPayload: unknown;
    syncStatus?: string;
    syncError?: string | null;
    lastSyncedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.supplierIntegrationId = data.supplierIntegrationId;
    this.externalRef = data.externalRef;
    this.pid = data.pid ?? null;
    this.vid = data.vid ?? null;
    this.sku = data.sku ?? null;
    this.categoryId = data.categoryId ?? null;
    this.title = data.title;
    this.size = data.size ?? null;
    this.color = data.color ?? null;
    this.supplierCost = String(data.supplierCost);
    this.sellPrice = data.sellPrice != null ? String(data.sellPrice) : null;
    this.stockQuantity = data.stockQuantity;
    this.warehouseInventoryNum = data.warehouseInventoryNum ?? null;
    this.rawPayload = data.rawPayload;
    this.syncStatus = (data.syncStatus as CjSyncStatus) ?? 'Synced';
    this.syncError = data.syncError ?? null;
    this.lastSyncedAt = data.lastSyncedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
