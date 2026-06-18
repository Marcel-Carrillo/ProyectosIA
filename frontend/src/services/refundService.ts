import axios, { AxiosError } from 'axios';
import {
  Refund,
  RefundListResult,
  RefundListFilters,
  CreateRefundInput,
  UpdateRefundStatusInput,
} from '../types/refund';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/refunds`;

export function mapRefundError(code: string): string {
  switch (code) {
    case 'REFUND_NOT_FOUND':
      return 'Refund not found.';
    case 'REFUND_ORDER_NOT_PAID':
      return 'Cannot create a refund: the order has not been paid.';
    case 'REFUND_AMOUNT_EXCEEDS_BALANCE':
      return 'The refund amount exceeds the available refundable balance.';
    case 'REFUND_TRANSITION_INVALID':
      return 'This status change is not allowed.';
    case 'CUSTOMER_ORDER_NOT_FOUND':
      return 'Customer order not found.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred.';
  }
}

function handleAxiosError(err: AxiosError): never {
  const data = err.response?.data as { error?: { code?: string; message?: string } } | undefined;
  const code = data?.error?.code ?? '';
  const message = mapRefundError(code) || data?.error?.message || 'An unexpected error occurred.';
  throw new Error(message);
}

export const refundService = {
  async getAll(filters: RefundListFilters = {}): Promise<RefundListResult> {
    try {
      const params: Record<string, string | number> = {};
      if (filters.customerOrderId) params['customerOrderId'] = filters.customerOrderId;
      if (filters.status) params['status'] = filters.status;
      if (filters.page) params['page'] = filters.page;
      if (filters.limit) params['limit'] = filters.limit;
      const res = await axios.get<{ data: RefundListResult }>(ADMIN_BASE, { params });
      return res.data.data;
    } catch (err) {
      if (axios.isAxiosError(err)) handleAxiosError(err);
      throw err;
    }
  },

  async getById(id: number): Promise<Refund> {
    try {
      const res = await axios.get<{ data: Refund }>(`${ADMIN_BASE}/${id}`);
      return res.data.data;
    } catch (err) {
      if (axios.isAxiosError(err)) handleAxiosError(err);
      throw err;
    }
  },

  async create(input: CreateRefundInput): Promise<Refund> {
    try {
      const res = await axios.post<{ data: Refund }>(ADMIN_BASE, input);
      return res.data.data;
    } catch (err) {
      if (axios.isAxiosError(err)) handleAxiosError(err);
      throw err;
    }
  },

  async updateStatus(id: number, input: UpdateRefundStatusInput): Promise<Refund> {
    try {
      const res = await axios.patch<{ data: Refund }>(`${ADMIN_BASE}/${id}/status`, input);
      return res.data.data;
    } catch (err) {
      if (axios.isAxiosError(err)) handleAxiosError(err);
      throw err;
    }
  },
};
