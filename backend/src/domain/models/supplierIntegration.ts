export type SupplierIntegrationStatus = 'Disconnected' | 'Connected' | 'Error';

export class SupplierIntegration {
  id?: number;
  supplierId: number;
  provider: string;
  status: SupplierIntegrationStatus;
  externalAccountRef?: string | null;
  lastVerifiedAt?: Date | null;
  lastSyncedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    supplierId: number;
    provider?: string;
    status?: string;
    externalAccountRef?: string | null;
    lastVerifiedAt?: Date | null;
    lastSyncedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.supplierId = data.supplierId;
    this.provider = data.provider ?? 'CJDropshipping';
    this.status = (data.status as SupplierIntegrationStatus) ?? 'Disconnected';
    this.externalAccountRef = data.externalAccountRef ?? null;
    this.lastVerifiedAt = data.lastVerifiedAt ?? null;
    this.lastSyncedAt = data.lastSyncedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Mutates in-memory state only — the repository persists the transition
  // afterward, mirroring how SupplierOrder status transitions are computed
  // before being written via the repository.
  markConnected(verifiedAt: Date = new Date()): void {
    this.status = 'Connected';
    this.lastVerifiedAt = verifiedAt;
  }

  markError(verifiedAt: Date = new Date()): void {
    this.status = 'Error';
    this.lastVerifiedAt = verifiedAt;
  }
}
