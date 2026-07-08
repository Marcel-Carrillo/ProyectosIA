import axios, { AxiosError } from 'axios';
import {
  CjCatalogQueryParams,
  CjCatalogListResponse,
  CjPromoteRequest,
  CjPromoteResponse,
  CjActionResponse,
  CjAdminApiError,
} from '../types/cjCatalog';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const cjBase = (supplierId: number) => `${API_BASE_URL}/api/admin/suppliers/${supplierId}/cj`;

// ─── Error-code → UI-message mapping ─────────────────────────────────────────

export function mapCjCatalogError(code: string): string {
  switch (code) {
    case 'CJ_PROMOTION_CATEGORY_REQUIRED':
      return 'Select a category before promoting.';
    case 'CJ_PROMOTION_PRICE_REQUIRED':
      return 'Enter a public price — no default markup is configured.';
    case 'CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE':
      return 'One or more selected items failed to sync and cannot be promoted.';
    case 'CJ_CATALOG_ITEM_NOT_FOUND':
      return 'One or more selected items could not be found.';
    case 'CJ_CATALOG_ITEM_NOT_PROMOTED':
      return 'This item has not been promoted yet.';
    case 'CJ_PROMOTION_VALIDATION_FAILED':
      return 'One or more items failed validation. Please review your selection.';
    case 'CJ_CONNECTION_NOT_READY':
      return 'The CJ Dropshipping connection is not ready. Verify the connection first.';
    case 'CJ_CONNECTION_NOT_FOUND':
      return 'No CJ Dropshipping connection is configured for this supplier.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export function extractCjCatalogErrorMessage(error: unknown): string {
  const code = (error as AxiosError<CjAdminApiError>).response?.data?.error?.code;
  return mapCjCatalogError(code ?? '');
}

export function extractCjCatalogErrorCode(error: unknown): string {
  return (error as AxiosError<CjAdminApiError>).response?.data?.error?.code ?? '';
}

// ─── Admin CJ catalog promotion ──────────────────────────────────────────────
// Security invariant: admin-only. Never exposes cjCatalogItemId or supplier
// cost beyond what the backend's admin serializer already allow-lists.

export const cjCatalogService = {
  listCatalog: async (supplierId: number, params?: CjCatalogQueryParams): Promise<CjCatalogListResponse> => {
    try {
      const response = await axios.get<CjCatalogListResponse>(`${cjBase(supplierId)}/catalog`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching CJ catalog:', error);
      throw error;
    }
  },

  promote: async (supplierId: number, payload: CjPromoteRequest): Promise<CjPromoteResponse> => {
    try {
      const response = await axios.post<CjPromoteResponse>(`${cjBase(supplierId)}/catalog/promote`, payload);
      return response.data;
    } catch (error) {
      console.error('Error promoting CJ catalog items:', error);
      throw error;
    }
  },

  activate: async (supplierId: number, cjCatalogItemId: number): Promise<CjActionResponse> => {
    try {
      const response = await axios.post<CjActionResponse>(
        `${cjBase(supplierId)}/catalog/${cjCatalogItemId}/activate`
      );
      return response.data;
    } catch (error) {
      console.error('Error activating CJ catalog item:', error);
      throw error;
    }
  },

  deactivate: async (supplierId: number, cjCatalogItemId: number): Promise<CjActionResponse> => {
    try {
      const response = await axios.post<CjActionResponse>(
        `${cjBase(supplierId)}/catalog/${cjCatalogItemId}/deactivate`
      );
      return response.data;
    } catch (error) {
      console.error('Error deactivating CJ catalog item:', error);
      throw error;
    }
  },
};
