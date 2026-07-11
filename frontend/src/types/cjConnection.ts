export type SupplierIntegrationStatus = 'Disconnected' | 'Connected' | 'Error';

export interface CjConnection {
  id: number;
  supplierId: number;
  provider: string;
  status: SupplierIntegrationStatus;
  externalAccountRef: string | null;
  lastVerifiedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CjConfigureConnectionRequest {
  externalAccountRef?: string | null;
}

export interface CjConnectionResponse {
  success: boolean;
  data: CjConnection;
  message: string;
}

export interface CjVerifyResult {
  healthy: boolean;
  reason?: string | null;
}

export interface CjVerifyResponse {
  success: boolean;
  data: CjVerifyResult;
  message: string;
}

export interface CjSyncResult {
  itemsUpserted: number;
  itemsFailed: number;
  syncedAt: string;
}

export interface CjSyncResponse {
  success: boolean;
  data: CjSyncResult;
  message: string;
}

export interface CjConnectionApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
