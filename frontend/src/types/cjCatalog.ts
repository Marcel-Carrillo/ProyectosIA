export type CjSyncStatus = 'Synced' | 'Failed';
export type CjPromotionState = 'NotPromoted' | 'Active' | 'Inactive';

export interface CjCatalogItem {
  id: number;
  externalRef: string;
  title: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  supplierCost: string;
  stockQuantity: number;
  syncStatus: CjSyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  promotionState: CjPromotionState;
  productId: number | null;
  productVariantId: number | null;
}

export interface CjCatalogQueryParams {
  page?: number;
  pageSize?: number;
  syncStatus?: CjSyncStatus;
  promotionState?: CjPromotionState;
}

export interface CjCatalogListResult {
  items: CjCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CjCatalogListResponse {
  success: boolean;
  data: CjCatalogListResult;
  message: string;
}

export interface CjPromoteItemInput {
  cjCatalogItemId: number;
  publicPrice?: number;
  compareAtPrice?: number;
}

export interface CjPromoteRequest {
  items: CjPromoteItemInput[];
  categoryId: number;
  activate?: boolean;
}

export interface CjPromoteResponse {
  success: boolean;
  data: Record<string, unknown>;
  message: string;
}

export interface CjActionResponse {
  success: boolean;
  data: { productId: number; productVariantId: number };
  message: string;
}

export interface CjAdminApiError {
  success: false;
  error: {
    code: string;
    message: string;
    itemErrors?: Array<{ cjCatalogItemId: number; code: string; message: string }>;
  };
}
