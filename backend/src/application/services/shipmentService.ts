import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prismaClient';
import { Shipment, ShipmentStatus, isValidShipmentTransition } from '../../domain/models/shipment';
import {
  IShipmentRepository,
  ShipmentFilters,
  ShipmentListResult,
} from '../../domain/repositories/shipmentRepository';
import {
  ShipmentNotFoundError,
  ShipmentStatusTransitionInvalidError,
} from '../../infrastructure/repositories/shipmentRepository';
import { CustomerOrderNotFoundError } from '../../infrastructure/repositories/customerOrderRepository';
import { SupplierOrderNotFoundError } from '../../infrastructure/repositories/supplierOrderRepository';
import {
  validateShipmentCreateData,
  validateShipmentStatusUpdate,
} from '../validator';

export class ShipmentService {
  constructor(private readonly shipmentRepository: IShipmentRepository) {}

  async listShipments(filters: ShipmentFilters): Promise<ShipmentListResult> {
    return this.shipmentRepository.findAll(filters);
  }

  async getShipmentById(id: number): Promise<Shipment> {
    const shipment = await this.shipmentRepository.findById(id);
    if (!shipment) throw new ShipmentNotFoundError();
    return shipment;
  }

  async createShipment(input: Record<string, unknown>): Promise<Shipment> {
    validateShipmentCreateData(input);

    const customerOrderId = input['customerOrderId'] as number;
    const supplierOrderId = (input['supplierOrderId'] as number | null | undefined) ?? null;
    const carrier = (input['carrier'] as string | null | undefined) ?? null;
    let trackingNumber = (input['trackingNumber'] as string | null | undefined) ?? null;
    let trackingUrl = (input['trackingUrl'] as string | null | undefined) ?? null;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const customerOrder = await tx.customerOrder.findUnique({
        where: { id: customerOrderId },
        select: { id: true },
      });
      if (!customerOrder) throw new CustomerOrderNotFoundError();

      if (supplierOrderId !== null) {
        const supplierOrder = await tx.supplierOrder.findUnique({
          where: { id: supplierOrderId },
          select: { id: true, trackingNumber: true, trackingUrl: true },
        });
        if (!supplierOrder) throw new SupplierOrderNotFoundError();

        if (trackingNumber === null) trackingNumber = supplierOrder.trackingNumber ?? null;
        if (trackingUrl === null) trackingUrl = supplierOrder.trackingUrl ?? null;
      }

      const row = await tx.shipment.create({
        data: {
          customerOrderId,
          supplierOrderId,
          carrier,
          trackingNumber,
          trackingUrl,
          status: 'Pending',
        },
      });

      return new Shipment({ ...row });
    });
  }

  async updateShipmentStatus(id: number, input: Record<string, unknown>): Promise<Shipment> {
    validateShipmentStatusUpdate(input);

    const newStatus = input['status'] as ShipmentStatus;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.shipment.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!existing) throw new ShipmentNotFoundError();

      if (!isValidShipmentTransition(existing.status as ShipmentStatus, newStatus)) {
        throw new ShipmentStatusTransitionInvalidError(
          `Cannot transition shipment from ${existing.status} to ${newStatus}`
        );
      }

      const shippedAt = newStatus === 'Shipped' ? new Date() : undefined;
      const deliveredAt = newStatus === 'Delivered' ? new Date() : undefined;

      return this.shipmentRepository.updateStatus(id, {
        status: newStatus,
        shippedAt,
        deliveredAt,
      });
    });
  }
}
