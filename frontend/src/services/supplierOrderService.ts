import axios, { AxiosError } from 'axios';
import {
  SupplierOrderQueryParams,
  SupplierOrderListResponse,
  SupplierOrderResponse,
  CreateSupplierOrderInput,
  UpdateSupplierOrderStatusInput,
  SupplierOrderAdminApiError,
  SupplierOrderListGenerateResponse,
} from '../types/supplierOrder';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/supplier-orders`;

export function mapSupplierOrderError(code: string): string {
  switch (code) {
    case 'SUPPLIER_ORDER_NOT_FOUND':
      return 'Supplier order not found.';
    case 'CUSTOMER_ORDER_NOT_FOUND':
      return 'Customer order not found.';
    case 'CUSTOMER_ORDER_NOT_ELIGIBLE':
      return 'This customer order is not eligible for supplier orders.';
    case 'VARIANT_SUPPLIER_MISSING':
      return 'A product variant has no supplier assigned.';
    case 'SUPPLIER_BLOCKED':
      return 'The supplier is blocked and cannot receive orders.';
    case 'SUPPLIER_ORDER_STATUS_TRANSITION_INVALID':
      return 'This status change is not allowed.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export function extractSupplierOrderErrorMessage(error: unknown): string {
  const code = (error as AxiosError<SupplierOrderAdminApiError>).response?.data?.error?.code;
  return mapSupplierOrderError(code ?? '');
}

export const supplierOrderService = {
  list: async (params?: SupplierOrderQueryParams): Promise<SupplierOrderListResponse> => {
    const response = await axios.get<SupplierOrderListResponse>(ADMIN_BASE, { params });
    return response.data;
  },

  getById: async (id: number): Promise<SupplierOrderResponse> => {
    const response = await axios.get<SupplierOrderResponse>(`${ADMIN_BASE}/${id}`);
    return response.data;
  },

  create: async (data: CreateSupplierOrderInput): Promise<SupplierOrderResponse> => {
    const response = await axios.post<SupplierOrderResponse>(ADMIN_BASE, data);
    return response.data;
  },

  updateStatus: async (
    id: number,
    data: UpdateSupplierOrderStatusInput
  ): Promise<SupplierOrderResponse> => {
    const response = await axios.patch<SupplierOrderResponse>(`${ADMIN_BASE}/${id}/status`, data);
    return response.data;
  },

  listByCustomerOrder: async (customerOrderId: number): Promise<SupplierOrderListResponse> => {
    const response = await axios.get<SupplierOrderListResponse>(ADMIN_BASE, {
      params: { customerOrderId, pageSize: 100 },
    });
    return response.data;
  },
};

export type { SupplierOrderListGenerateResponse };
