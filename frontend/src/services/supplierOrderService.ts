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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/supplier-orders`;

export function mapSupplierOrderError(code: string): string {
  switch (code) {
    case 'SUPPLIER_ORDER_NOT_FOUND':
      return 'Pedido a proveedor no encontrado.';
    case 'CUSTOMER_ORDER_NOT_FOUND':
      return 'Pedido de cliente no encontrado.';
    case 'CUSTOMER_ORDER_NOT_ELIGIBLE':
      return 'Este pedido de cliente no es apto para pedidos a proveedores.';
    case 'VARIANT_SUPPLIER_MISSING':
      return 'Una variante de producto no tiene proveedor asignado.';
    case 'SUPPLIER_BLOCKED':
      return 'El proveedor está bloqueado y no puede recibir pedidos.';
    case 'SUPPLIER_ORDER_STATUS_TRANSITION_INVALID':
      return 'No se permite este cambio de estado.';
    case 'VALIDATION_ERROR':
      return 'Revise los campos del formulario e inténtelo de nuevo.';
    case 'CJ_ORDER_NOT_PUSHED':
      return 'Este pedido todavía no se ha empujado a CJ Dropshipping.';
    case 'CJ_SANDBOX_ONLY':
      return 'Esta acción solo está disponible para pedidos sandbox de CJ Dropshipping.';
    case 'CJ_API_UNAVAILABLE':
      return 'La API de CJ Dropshipping no está disponible en este momento.';
    default:
      return 'Ha ocurrido un error inesperado. Inténtelo de nuevo.';
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

  simulateSandboxAdvance: async (id: number): Promise<SupplierOrderResponse> => {
    const response = await axios.post<SupplierOrderResponse>(`${ADMIN_BASE}/${id}/cj/sandbox-advance`);
    return response.data;
  },
};

export type { SupplierOrderListGenerateResponse };
