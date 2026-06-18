import { Shipment, ShipmentStatus } from '../models/shipment';

export interface ShipmentFilters {
  customerOrderId?: number;
  supplierOrderId?: number;
  status?: ShipmentStatus;
  page?: number;
  pageSize?: number;
}

export interface ShipmentListResult {
  items: Shipment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateShipmentData {
  customerOrderId: number;
  supplierOrderId?: number | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}

export interface UpdateShipmentStatusData {
  status: ShipmentStatus;
  shippedAt?: Date | null;
  deliveredAt?: Date | null;
}

export interface IShipmentRepository {
  findAll(filters: ShipmentFilters): Promise<ShipmentListResult>;
  findById(id: number): Promise<Shipment | null>;
  create(data: CreateShipmentData): Promise<Shipment>;
  updateStatus(id: number, data: UpdateShipmentStatusData): Promise<Shipment>;
}
