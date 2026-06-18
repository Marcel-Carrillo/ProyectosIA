import axios, { AxiosError } from 'axios';
import {
  CustomerOrderQueryParams,
  CustomerOrderListResponse,
  CustomerOrderResponse,
  CreateCustomerOrderInput,
  UpdateCustomerOrderStatusInput,
  CustomerOrderAdminApiError,
} from '../types/customerOrder';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/customer-orders`;

export function mapCustomerOrderError(code: string): string {
  switch (code) {
    case 'CUSTOMER_ORDER_NOT_FOUND':
      return 'Customer order not found.';
    case 'CUSTOMER_NOT_FOUND':
      return 'Customer not found.';
    case 'VARIANT_NOT_FOUND':
      return 'Product variant not found.';
    case 'ORDER_STATUS_TRANSITION_INVALID':
    case 'PAYMENT_STATUS_TRANSITION_INVALID':
    case 'FULFILLMENT_STATUS_TRANSITION_INVALID':
      return 'This status change is not allowed.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
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
};
