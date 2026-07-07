import { SupplierIntegration } from '../models/supplierIntegration';

export interface SupplierIntegrationUpsertData {
  externalAccountRef?: string | null;
}

export interface ISupplierIntegrationRepository {
  findBySupplierId(supplierId: number): Promise<SupplierIntegration | null>;
  upsert(
    supplierId: number,
    data: SupplierIntegrationUpsertData
  ): Promise<{ integration: SupplierIntegration; created: boolean }>;
  updateStatus(
    id: number,
    data: { status: 'Connected' | 'Error'; lastVerifiedAt: Date }
  ): Promise<SupplierIntegration>;
  updateLastSyncedAt(id: number, lastSyncedAt: Date): Promise<SupplierIntegration>;
}
