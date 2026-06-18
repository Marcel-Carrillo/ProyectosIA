export type ShipmentStatus =
  | 'Pending'
  | 'Shipped'
  | 'InTransit'
  | 'Delivered'
  | 'Failed'
  | 'Returned';

export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  Pending:   ['Shipped', 'Failed', 'Returned'],
  Shipped:   ['InTransit', 'Delivered', 'Failed', 'Returned'],
  InTransit: ['Delivered', 'Failed', 'Returned'],
  Delivered: [],
  Failed:    [],
  Returned:  [],
};

export function isValidShipmentTransition(
  from: ShipmentStatus,
  to: ShipmentStatus
): boolean {
  return SHIPMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export class Shipment {
  id?: number;
  customerOrderId: number;
  supplierOrderId: number | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentStatus;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  customerOrder?: { id: number; orderNumber: string; status: string };
  supplierOrder?: { id: number; status: string } | null;

  constructor(data: {
    id?: number;
    customerOrderId: number;
    supplierOrderId?: number | null;
    carrier?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    status?: string;
    shippedAt?: Date | null;
    deliveredAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    customerOrder?: { id: number; orderNumber: string; status: string };
    supplierOrder?: { id: number; status: string } | null;
  }) {
    this.id = data.id;
    this.customerOrderId = data.customerOrderId;
    this.supplierOrderId = data.supplierOrderId ?? null;
    this.carrier = data.carrier ?? null;
    this.trackingNumber = data.trackingNumber ?? null;
    this.trackingUrl = data.trackingUrl ?? null;
    this.status = (data.status as ShipmentStatus) ?? 'Pending';
    this.shippedAt = data.shippedAt ?? null;
    this.deliveredAt = data.deliveredAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.customerOrder = data.customerOrder;
    this.supplierOrder = data.supplierOrder;
  }
}
