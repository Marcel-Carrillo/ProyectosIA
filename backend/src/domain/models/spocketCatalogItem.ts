export type SpocketSyncStatus = 'Synced' | 'Failed';

export class SpocketCatalogItem {
  id?: number;
  supplierIntegrationId: number;
  externalRef: string;
  title: string;
  size?: string | null;
  color?: string | null;
  supplierCost: string;
  stockQuantity: number;
  rawPayload: unknown;
  syncStatus: SpocketSyncStatus;
  syncError?: string | null;
  lastSyncedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    supplierIntegrationId: number;
    externalRef: string;
    title: string;
    size?: string | null;
    color?: string | null;
    supplierCost: string | number;
    stockQuantity: number;
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
    this.title = data.title;
    this.size = data.size ?? null;
    this.color = data.color ?? null;
    this.supplierCost = String(data.supplierCost);
    this.stockQuantity = data.stockQuantity;
    this.rawPayload = data.rawPayload;
    this.syncStatus = (data.syncStatus as SpocketSyncStatus) ?? 'Synced';
    this.syncError = data.syncError ?? null;
    this.lastSyncedAt = data.lastSyncedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
