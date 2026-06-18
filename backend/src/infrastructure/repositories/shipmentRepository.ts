import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { Shipment } from '../../domain/models/shipment';
import {
  IShipmentRepository,
  ShipmentFilters,
  ShipmentListResult,
  CreateShipmentData,
  UpdateShipmentStatusData,
} from '../../domain/repositories/shipmentRepository';

export class ShipmentNotFoundError extends Error {
  readonly code = 'SHIPMENT_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Shipment not found');
    this.name = 'ShipmentNotFoundError';
    Object.setPrototypeOf(this, ShipmentNotFoundError.prototype);
  }
}

export class ShipmentStatusTransitionInvalidError extends Error {
  readonly code = 'SHIPMENT_STATUS_TRANSITION_INVALID' as const;
  readonly status = 400;

  constructor(message = 'Invalid shipment status transition') {
    super(message);
    this.name = 'ShipmentStatusTransitionInvalidError';
    Object.setPrototypeOf(this, ShipmentStatusTransitionInvalidError.prototype);
  }
}

const shipmentListSelect = {
  id: true,
  customerOrderId: true,
  supplierOrderId: true,
  carrier: true,
  trackingNumber: true,
  trackingUrl: true,
  status: true,
  shippedAt: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ShipmentListRow = Prisma.ShipmentGetPayload<{ select: typeof shipmentListSelect }>;

function mapShipment(row: ShipmentListRow): Shipment {
  return new Shipment({ ...row });
}

type ShipmentDetailRow = Prisma.ShipmentGetPayload<{
  include: {
    customerOrder: { select: { id: true; orderNumber: true; status: true } };
    supplierOrder: { select: { id: true; status: true } };
  };
}>;

function mapShipmentDetail(row: ShipmentDetailRow): Shipment {
  return new Shipment({
    id: row.id,
    customerOrderId: row.customerOrderId,
    supplierOrderId: row.supplierOrderId,
    carrier: row.carrier,
    trackingNumber: row.trackingNumber,
    trackingUrl: row.trackingUrl,
    status: row.status,
    shippedAt: row.shippedAt,
    deliveredAt: row.deliveredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    customerOrder: row.customerOrder
      ? { id: row.customerOrder.id, orderNumber: row.customerOrder.orderNumber, status: row.customerOrder.status }
      : undefined,
    supplierOrder: row.supplierOrder
      ? { id: row.supplierOrder.id, status: row.supplierOrder.status }
      : null,
  });
}

export class ShipmentRepository implements IShipmentRepository {
  async findAll(filters: ShipmentFilters): Promise<ShipmentListResult> {
    const page = filters.page && filters.page >= 1 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize >= 1 ? Math.min(filters.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ShipmentWhereInput = {};
    if (filters.customerOrderId) where.customerOrderId = filters.customerOrderId;
    if (filters.supplierOrderId) where.supplierOrderId = filters.supplierOrderId;
    if (filters.status) where.status = filters.status;

    const [rows, total] = await prisma.$transaction([
      prisma.shipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: shipmentListSelect,
      }),
      prisma.shipment.count({ where }),
    ]);

    return { items: rows.map(mapShipment), total, page, pageSize };
  }

  async findById(id: number): Promise<Shipment | null> {
    const row = await prisma.shipment.findUnique({
      where: { id },
      include: {
        customerOrder: { select: { id: true, orderNumber: true, status: true } },
        supplierOrder: { select: { id: true, status: true } },
      },
    });
    return row ? mapShipmentDetail(row) : null;
  }

  async create(data: CreateShipmentData): Promise<Shipment> {
    const row = await prisma.shipment.create({
      data: {
        customerOrderId: data.customerOrderId,
        supplierOrderId: data.supplierOrderId ?? null,
        carrier: data.carrier ?? null,
        trackingNumber: data.trackingNumber ?? null,
        trackingUrl: data.trackingUrl ?? null,
        status: 'Pending',
      },
      select: shipmentListSelect,
    });
    return mapShipment(row);
  }

  async updateStatus(id: number, data: UpdateShipmentStatusData): Promise<Shipment> {
    try {
      const row = await prisma.shipment.update({
        where: { id },
        data: {
          status: data.status,
          ...(data.shippedAt !== undefined && { shippedAt: data.shippedAt }),
          ...(data.deliveredAt !== undefined && { deliveredAt: data.deliveredAt }),
        },
        select: shipmentListSelect,
      });
      return mapShipment(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ShipmentNotFoundError();
      }
      throw err;
    }
  }
}
