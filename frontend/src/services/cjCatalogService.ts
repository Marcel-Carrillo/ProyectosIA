import axios, { AxiosError } from 'axios';
import {
  CjCatalogQueryParams,
  CjCatalogListResponse,
  CjPromoteRequest,
  CjPromoteResponse,
  CjActionResponse,
  CjAdminApiError,
} from '../types/cjCatalog';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const cjBase = (supplierId: number) => `${API_BASE_URL}/api/admin/suppliers/${supplierId}/cj`;

// ─── Error-code → UI-message mapping ─────────────────────────────────────────

export function mapCjCatalogError(code: string): string {
  switch (code) {
    case 'CJ_PROMOTION_CATEGORY_REQUIRED':
      return 'Seleccione una categoría antes de promocionar.';
    case 'CJ_PROMOTION_PRICE_REQUIRED':
      return 'Introduzca un precio público: no hay un margen predeterminado configurado.';
    case 'CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE':
      return 'Uno o más artículos seleccionados no se pudieron sincronizar y no pueden promocionarse.';
    case 'CJ_CATALOG_ITEM_NOT_FOUND':
      return 'No se pudieron encontrar uno o más artículos seleccionados.';
    case 'CJ_CATALOG_ITEM_NOT_PROMOTED':
      return 'Este artículo aún no ha sido promocionado.';
    case 'CJ_PROMOTION_VALIDATION_FAILED':
      return 'Uno o más artículos no superaron la validación. Revise su selección.';
    case 'CJ_CONNECTION_NOT_READY':
      return 'La conexión con CJ Dropshipping no está lista. Verifique la conexión primero.';
    case 'CJ_CONNECTION_NOT_FOUND':
      return 'No hay una conexión con CJ Dropshipping configurada para este proveedor.';
    case 'VALIDATION_ERROR':
      return 'Revise los campos del formulario e inténtelo de nuevo.';
    default:
      return 'Ha ocurrido un error inesperado. Inténtelo de nuevo.';
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
