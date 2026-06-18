import axios, { AxiosError } from 'axios';
import {
  ShipmentQueryParams,
  ShipmentListResponse,
  ShipmentResponse,
  CreateShipmentRequest,
  UpdateShipmentStatusRequest,
  ShipmentApiError,
} from '../types/shipment';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/shipments`;

export function mapShipmentError(code: string): string {
  switch (code) {
    case 'SHIPMENT_NOT_FOUND':
      return 'Shipment not found.';
    case 'CUSTOMER_ORDER_NOT_FOUND':
      return 'Customer order not found.';
    case 'SUPPLIER_ORDER_NOT_FOUND':
      return 'Supplier order not found.';
    case 'SHIPMENT_STATUS_TRANSITION_INVALID':
      return 'This status change is not allowed.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export function extractShipmentErrorMessage(error: unknown): string {
  const code = (error as AxiosError<ShipmentApiError>).response?.data?.error?.code;
  return mapShipmentError(code ?? '');
}

export const shipmentService = {
  list: async (params?: ShipmentQueryParams): Promise<ShipmentListResponse> => {
    const response = await axios.get<ShipmentListResponse>(ADMIN_BASE, { params });
    return response.data;
  },

  getById: async (id: number): Promise<ShipmentResponse> => {
    const response = await axios.get<ShipmentResponse>(`${ADMIN_BASE}/${id}`);
    return response.data;
  },

  create: async (data: CreateShipmentRequest): Promise<ShipmentResponse> => {
    const response = await axios.post<ShipmentResponse>(ADMIN_BASE, data);
    return response.data;
  },

  updateStatus: async (
    id: number,
    data: UpdateShipmentStatusRequest
  ): Promise<ShipmentResponse> => {
    const response = await axios.patch<ShipmentResponse>(`${ADMIN_BASE}/${id}/status`, data);
    return response.data;
  },

  listByCustomerOrder: async (customerOrderId: number): Promise<ShipmentListResponse> => {
    const response = await axios.get<ShipmentListResponse>(ADMIN_BASE, {
      params: { customerOrderId, pageSize: 100 },
    });
    return response.data;
  },

  listBySupplierOrder: async (supplierOrderId: number): Promise<ShipmentListResponse> => {
    const response = await axios.get<ShipmentListResponse>(ADMIN_BASE, {
      params: { supplierOrderId, pageSize: 100 },
    });
    return response.data;
  },
};
