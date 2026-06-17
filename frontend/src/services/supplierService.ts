import axios, { AxiosError } from 'axios';
import {
  SupplierQueryParams,
  SupplierListResponse,
  SupplierResponse,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierAdminApiError,
} from '../types/supplier';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/suppliers`;

// ─── Error-code → UI-message mapping ─────────────────────────────────────────

export function mapSupplierError(code: string): string {
  switch (code) {
    case 'SUPPLIER_NOT_FOUND':
      return 'Supplier not found.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/** Extracts the backend error code from an unknown error and maps it to a UI message. */
export function extractSupplierErrorMessage(error: unknown): string {
  const code = (error as AxiosError<SupplierAdminApiError>).response?.data?.error?.code;
  return mapSupplierError(code ?? '');
}

// ─── Admin supplier CRUD ─────────────────────────────────────────────────────
// Security invariant: suppliers are admin-only. There is no public supplier
// service, and this module never references supplier cost/credential fields.

export const supplierService = {
  list: async (params?: SupplierQueryParams): Promise<SupplierListResponse> => {
    try {
      const response = await axios.get<SupplierListResponse>(ADMIN_BASE, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw error;
    }
  },

  getById: async (id: number): Promise<SupplierResponse> => {
    try {
      const response = await axios.get<SupplierResponse>(`${ADMIN_BASE}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching supplier:', error);
      throw error;
    }
  },

  create: async (data: CreateSupplierInput): Promise<SupplierResponse> => {
    try {
      const response = await axios.post<SupplierResponse>(ADMIN_BASE, data);
      return response.data;
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }
  },

  update: async (id: number, data: UpdateSupplierInput): Promise<SupplierResponse> => {
    try {
      const response = await axios.patch<SupplierResponse>(`${ADMIN_BASE}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating supplier:', error);
      throw error;
    }
  },

  /**
   * Soft-delete: DELETE /api/admin/suppliers/:id sets status=Inactive.
   * The supplier row is preserved; no hard-delete ever occurs.
   */
  softDelete: async (id: number): Promise<SupplierResponse> => {
    try {
      const response = await axios.delete<SupplierResponse>(`${ADMIN_BASE}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deactivating supplier:', error);
      throw error;
    }
  },
};
