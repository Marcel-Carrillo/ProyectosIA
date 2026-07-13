import axios, { AxiosError } from 'axios';
import {
  Refund,
  RefundListResult,
  RefundListFilters,
  CreateRefundInput,
  UpdateRefundStatusInput,
} from '../types/refund';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/refunds`;

export function mapRefundError(code: string): string {
  switch (code) {
    case 'REFUND_NOT_FOUND':
      return 'Reembolso no encontrado.';
    case 'REFUND_ORDER_NOT_PAID':
      return 'No se puede crear un reembolso: el pedido no ha sido pagado.';
    case 'REFUND_AMOUNT_EXCEEDS_BALANCE':
      return 'El importe del reembolso supera el saldo reembolsable disponible.';
    case 'REFUND_TRANSITION_INVALID':
      return 'No se permite este cambio de estado.';
    case 'CUSTOMER_ORDER_NOT_FOUND':
      return 'Pedido de cliente no encontrado.';
    case 'VALIDATION_ERROR':
      return 'Revise los campos del formulario e inténtelo de nuevo.';
    default:
      return 'Ha ocurrido un error inesperado.';
  }
}

function handleAxiosError(err: AxiosError): never {
  const data = err.response?.data as { error?: { code?: string; message?: string } } | undefined;
  const code = data?.error?.code ?? '';
  const message = mapRefundError(code) || data?.error?.message || 'Ha ocurrido un error inesperado.';
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
