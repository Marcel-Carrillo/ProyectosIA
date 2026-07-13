import axios, { AxiosError } from 'axios';
import {
  CustomerOrderQueryParams,
  CustomerOrderListResponse,
  CustomerOrderResponse,
  CreateCustomerOrderInput,
  UpdateCustomerOrderStatusInput,
  CustomerOrderAdminApiError,
} from '../types/customerOrder';
import { SupplierOrder, SupplierOrderListGenerateResponse } from '../types/supplierOrder';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/customer-orders`;

export function mapCustomerOrderError(code: string): string {
  switch (code) {
    case 'CUSTOMER_ORDER_NOT_FOUND':
      return 'Pedido de cliente no encontrado.';
    case 'CUSTOMER_NOT_FOUND':
      return 'Cliente no encontrado.';
    case 'VARIANT_NOT_FOUND':
      return 'Variante de producto no encontrada.';
    case 'ORDER_STATUS_TRANSITION_INVALID':
    case 'PAYMENT_STATUS_TRANSITION_INVALID':
    case 'FULFILLMENT_STATUS_TRANSITION_INVALID':
      return 'No se permite este cambio de estado.';
    case 'CUSTOMER_ORDER_NOT_ELIGIBLE':
      return 'Este pedido de cliente no es apto para pedidos a proveedores.';
    case 'VALIDATION_ERROR':
      return 'Revise los campos del formulario e inténtelo de nuevo.';
    default:
      return 'Ha ocurrido un error inesperado. Inténtelo de nuevo.';
  }
}

export function extractCustomerOrderErrorMessage(error: unknown): string {
  const code = (error as AxiosError<CustomerOrderAdminApiError>).response?.data?.error?.code;
  return mapCustomerOrderError(code ?? '');
}

export const customerOrderService = {
  list: async (params?: CustomerOrderQueryParams): Promise<CustomerOrderListResponse> => {
    const response = await axios.get<CustomerOrderListResponse>(ADMIN_BASE, { params });
    return response.data;
  },

  getById: async (id: number): Promise<CustomerOrderResponse> => {
    const response = await axios.get<CustomerOrderResponse>(`${ADMIN_BASE}/${id}`);
    return response.data;
  },

  create: async (data: CreateCustomerOrderInput): Promise<CustomerOrderResponse> => {
    const response = await axios.post<CustomerOrderResponse>(ADMIN_BASE, data);
    return response.data;
  },

  updateStatus: async (
    id: number,
    data: UpdateCustomerOrderStatusInput
  ): Promise<CustomerOrderResponse> => {
    const response = await axios.patch<CustomerOrderResponse>(`${ADMIN_BASE}/${id}/status`, data);
    return response.data;
  },

  generateSupplierOrders: async (
    id: number
  ): Promise<{ data: SupplierOrder[]; status: number; message: string }> => {
    const response = await axios.post<SupplierOrderListGenerateResponse>(
      `${ADMIN_BASE}/${id}/supplier-orders`
    );
    return {
      data: response.data.data,
      status: response.status,
      message: response.data.message,
    };
  },
};
