import axios, { AxiosError } from 'axios';
import {
  ReturnRequest,
  ReturnRequestListResult,
  ReturnRequestListFilters,
  CreateReturnRequestInput,
  UpdateReturnRequestStatusInput,
} from '../types/returnRequest';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/return-requests`;

export function mapReturnRequestError(code: string): string {
  switch (code) {
    case 'RETURN_REQUEST_NOT_FOUND':
      return 'Return request not found.';
    case 'CUSTOMER_ORDER_NOT_FOUND':
      return 'Customer order not found.';
    case 'CUSTOMER_ORDER_ITEM_NOT_FOUND':
      return 'Order item not found.';
    case 'RETURN_REQUEST_ORDER_CANCELLED':
      return 'Cannot create a return request: the order has been cancelled.';
    case 'RETURN_REQUEST_ITEM_MISMATCH':
      return 'The selected item does not belong to this order.';
    case 'RETURN_REQUEST_TRANSITION_INVALID':
      return 'This status change is not allowed.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred.';
  }
}

function handleAxiosError(err: AxiosError): never {
  const data = err.response?.data as { error?: { code?: string; message?: string } } | undefined;
  const code = data?.error?.code ?? '';
  const message = mapReturnRequestError(code) || data?.error?.message || 'An unexpected error occurred.';
  throw new Error(message);
}

export const returnRequestService = {
  async getAll(filters: ReturnRequestListFilters = {}): Promise<ReturnRequestListResult> {
    try {
      const params: Record<string, string | number> = {};
      if (filters.customerOrderId) params['customerOrderId'] = filters.customerOrderId;
      if (filters.status) params['status'] = filters.status;
      if (filters.page) params['page'] = filters.page;
      if (filters.limit) params['limit'] = filters.limit;
      const res = await axios.get<{ data: ReturnRequestListResult }>(ADMIN_BASE, { params });
      return res.data.data;
    } catch (err) {
      if (axios.isAxiosError(err)) handleAxiosError(err);
      throw err;
    }
  },

  async getById(id: number): Promise<ReturnRequest> {
    try {
      const res = await axios.get<{ data: ReturnRequest }>(`${ADMIN_BASE}/${id}`);
      return res.data.data;
    } catch (err) {
      if (axios.isAxiosError(err)) handleAxiosError(err);
      throw err;
    }
  },

  async create(input: CreateReturnRequestInput): Promise<ReturnRequest> {
    try {
      const res = await axios.post<{ data: ReturnRequest }>(ADMIN_BASE, input);
      return res.data.data;
    } catch (err) {
      if (axios.isAxiosError(err)) handleAxiosError(err);
      throw err;
    }
  },

  async updateStatus(id: number, input: UpdateReturnRequestStatusInput): Promise<ReturnRequest> {
    try {
      const res = await axios.patch<{ data: ReturnRequest }>(`${ADMIN_BASE}/${id}/status`, input);
      return res.data.data;
    } catch (err) {
      if (axios.isAxiosError(err)) handleAxiosError(err);
      throw err;
    }
  },
};
