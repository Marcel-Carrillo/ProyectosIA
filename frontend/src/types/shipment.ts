export type ShipmentStatus =
  | 'Pending'
  | 'Shipped'
  | 'InTransit'
  | 'Delivered'
  | 'Failed'
  | 'Returned';

export interface Shipment {
  id: number;
  customerOrderId: number;
  supplierOrderId: number | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentStatus;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  customerOrder?: { id: number; orderNumber: string; status: string };
  supplierOrder?: { id: number; status: string } | null;
}

export type ShipmentListItem = Shipment;

export interface ShipmentQueryParams {
  page?: number;
  pageSize?: number;
  customerOrderId?: number;
  supplierOrderId?: number;
  status?: ShipmentStatus;
}

export interface ShipmentListData {
  items: ShipmentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ShipmentListResponse {
  success: boolean;
  data: ShipmentListData;
  message: string;
}

export interface ShipmentResponse {
  success: boolean;
  data: Shipment;
  message: string;
}

export interface CreateShipmentRequest {
  customerOrderId: number;
  supplierOrderId?: number | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}

export interface UpdateShipmentStatusRequest {
  status: ShipmentStatus;
}

export interface ShipmentApiError {
  success: false;
  error: { message: string; code: string };
}

export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  Pending:   ['Shipped', 'Failed', 'Returned'],
  Shipped:   ['InTransit', 'Delivered', 'Failed', 'Returned'],
  InTransit: ['Delivered', 'Failed', 'Returned'],
  Delivered: [],
  Failed:    [],
  Returned:  [],
};

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  Pending:   'secondary',
  Shipped:   'primary',
  InTransit: 'info',
  Delivered: 'success',
  Failed:    'danger',
  Returned:  'warning',
};
