import axios, { AxiosError } from 'axios';
import {
  ReturnRequest,
  ReturnRequestListResult,
  ReturnRequestListFilters,
  CreateReturnRequestInput,
  UpdateReturnRequestStatusInput,
} from '../types/returnRequest';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/return-requests`;

export function mapReturnRequestError(code: string): string {
  switch (code) {
    case 'RETURN_REQUEST_NOT_FOUND':
      return 'Solicitud de devolución no encontrada.';
    case 'CUSTOMER_ORDER_NOT_FOUND':
      return 'Pedido de cliente no encontrado.';
    case 'CUSTOMER_ORDER_ITEM_NOT_FOUND':
      return 'Artículo del pedido no encontrado.';
    case 'RETURN_REQUEST_ORDER_CANCELLED':
      return 'No se puede crear una solicitud de devolución: el pedido ha sido cancelado.';
    case 'RETURN_REQUEST_ITEM_MISMATCH':
      return 'El artículo seleccionado no pertenece a este pedido.';
    case 'RETURN_REQUEST_TRANSITION_INVALID':
      return 'No se permite este cambio de estado.';
    case 'VALIDATION_ERROR':
      return 'Revise los campos del formulario e inténtelo de nuevo.';
    default:
      return 'Ha ocurrido un error inesperado.';
  }
}

function handleAxiosError(err: AxiosError): never {
  const data = err.response?.data as { error?: { code?: string; message?: string } } | undefined;
  const code = data?.error?.code ?? '';
  const message = mapReturnRequestError(code) || data?.error?.message || 'Ha ocurrido un error inesperado.';
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
