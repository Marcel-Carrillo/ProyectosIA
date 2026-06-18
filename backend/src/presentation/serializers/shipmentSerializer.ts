import { Shipment } from '../../domain/models/shipment';

export interface ShipmentResponseDTO {
  id: number | undefined;
  customerOrderId: number;
  supplierOrderId: number | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date | undefined;
  updatedAt: Date | undefined;
  customerOrder?: { id: number; orderNumber: string; status: string };
  supplierOrder?: { id: number; status: string } | null;
}

export function serializeShipment(shipment: Shipment): ShipmentResponseDTO {
  return {
    id: shipment.id,
    customerOrderId: shipment.customerOrderId,
    supplierOrderId: shipment.supplierOrderId,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
    status: shipment.status,
    shippedAt: shipment.shippedAt,
    deliveredAt: shipment.deliveredAt,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
    ...(shipment.customerOrder !== undefined && { customerOrder: shipment.customerOrder }),
    ...(shipment.supplierOrder !== undefined && { supplierOrder: shipment.supplierOrder }),
  };
}
