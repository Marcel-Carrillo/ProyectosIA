import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../prismaClient';
import { SupplierOrder, SupplierOrderItem } from '../../domain/models/supplierOrder';
import {
  ISupplierOrderRepository,
  SupplierOrderCreateData,
  SupplierOrderStatusUpdateData,
  SupplierOrderListFilters,
  SupplierOrderListResult,
  GenerateSupplierOrdersResult,
} from '../../domain/repositories/supplierOrderRepository';
import { CustomerOrderNotFoundError } from './customerOrderRepository';

export class SupplierOrderNotFoundError extends Error {
  readonly code = 'SUPPLIER_ORDER_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Supplier order not found');
    this.name = 'SupplierOrderNotFoundError';
    Object.setPrototypeOf(this, SupplierOrderNotFoundError.prototype);
  }
}

export class SupplierOrderNumberConflictError extends Error {
  readonly code = 'SUPPLIER_ORDER_NUMBER_CONFLICT' as const;
  readonly status = 409;

  constructor() {
    super('Supplier order number already exists');
    this.name = 'SupplierOrderNumberConflictError';
    Object.setPrototypeOf(this, SupplierOrderNumberConflictError.prototype);
  }
}

export class CustomerOrderNotEligibleError extends Error {
  readonly code = 'CUSTOMER_ORDER_NOT_ELIGIBLE' as const;
  readonly status = 422;

  constructor(message = 'Customer order is not eligible for supplier order creation') {
    super(message);
    this.name = 'CustomerOrderNotEligibleError';
    Object.setPrototypeOf(this, CustomerOrderNotEligibleError.prototype);
  }
}

export class VariantSupplierMissingError extends Error {
  readonly code = 'VARIANT_SUPPLIER_MISSING' as const;
  readonly status = 422;

  constructor(message = 'Product variant has no supplier assigned') {
    super(message);
    this.name = 'VariantSupplierMissingError';
    Object.setPrototypeOf(this, VariantSupplierMissingError.prototype);
  }
}

export class SupplierBlockedError extends Error {
  readonly code = 'SUPPLIER_BLOCKED' as const;
  readonly status = 422;

  constructor(message = 'Supplier is blocked and cannot receive orders') {
    super(message);
    this.name = 'SupplierBlockedError';
    Object.setPrototypeOf(this, SupplierBlockedError.prototype);
  }
}

export class SupplierOrderStatusTransitionInvalidError extends Error {
  readonly code = 'SUPPLIER_ORDER_STATUS_TRANSITION_INVALID' as const;
  readonly status = 422;

  constructor(message = 'Invalid supplier order status transition') {
    super(message);
    this.name = 'SupplierOrderStatusTransitionInvalidError';
    Object.setPrototypeOf(this, SupplierOrderStatusTransitionInvalidError.prototype);
  }
}

const supplierRefSelect = { id: true, name: true } as const;
const customerOrderRefSelect = { id: true, orderNumber: true } as const;

const itemSelect = {
  id: true,
  supplierOrderId: true,
  customerOrderItemId: true,
  productVariantId: true,
  supplierReferenceSnapshot: true,
  quantity: true,
  supplierCost: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const orderSelect = {
  id: true,
  supplierOrderNumber: true,
  customerOrderId: true,
  supplierId: true,
  status: true,
  requestedAt: true,
  confirmedAt: true,
  shippedAt: true,
  deliveredAt: true,
  trackingNumber: true,
  trackingUrl: true,
  internalNotes: true,
  createdAt: true,
  updatedAt: true,
  supplier: { select: supplierRefSelect },
  customerOrder: { select: customerOrderRefSelect },
  items: { select: itemSelect },
} as const;

type OrderRow = Prisma.SupplierOrderGetPayload<{ select: typeof orderSelect }>;

function mapOrder(row: OrderRow): SupplierOrder {
  return new SupplierOrder({
    ...row,
    items: row.items?.map((item) => new SupplierOrderItem(item)),
    supplier: row.supplier ?? undefined,
    customerOrder: row.customerOrder ?? undefined,
  });
}

const ELIGIBLE_CUSTOMER_ORDER_STATUSES = new Set(['Paid', 'Processing']);

export class SupplierOrderRepository implements ISupplierOrderRepository {
  async findAll(filters: SupplierOrderListFilters = {}): Promise<SupplierOrderListResult> {
    const page =
      filters.page != null && Number.isFinite(filters.page) && filters.page >= 1
        ? filters.page
        : 1;
    const pageSize =
      filters.pageSize != null && Number.isFinite(filters.pageSize) && filters.pageSize >= 1
        ? filters.pageSize
        : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SupplierOrderWhereInput = {};
    if (filters.customerOrderId) where.customerOrderId = filters.customerOrderId;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.supplierOrderNumber = { contains: filters.search, mode: 'insensitive' };
    }

    const sortField = filters.sort ?? 'createdAt';
    const sortOrder = filters.order === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.SupplierOrderOrderByWithRelationInput =
      sortField === 'supplierOrderNumber'
        ? { supplierOrderNumber: sortOrder }
        : { createdAt: sortOrder };

    const [rows, total] = await prisma.$transaction([
      prisma.supplierOrder.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: { ...orderSelect, items: false },
      }),
      prisma.supplierOrder.count({ where }),
    ]);

    return {
      items: rows.map((row) => mapOrder({ ...row, items: [] })),
      total,
      page,
      pageSize,
    };
  }

  async findById(id: number): Promise<SupplierOrder | null> {
    const row = await prisma.supplierOrder.findUnique({
      where: { id },
      select: orderSelect,
    });
    return row ? mapOrder(row) : null;
  }

  async findByCustomerOrderId(customerOrderId: number): Promise<SupplierOrder[]> {
    const rows = await prisma.supplierOrder.findMany({
      where: { customerOrderId },
      select: orderSelect,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapOrder);
  }

  async generateNextSupplierOrderNumber(): Promise<string> {
    const last = await prisma.supplierOrder.findFirst({
      orderBy: { id: 'desc' },
      select: { supplierOrderNumber: true },
    });
    let nextNum = 1;
    if (last?.supplierOrderNumber) {
      const match = last.supplierOrderNumber.match(/SPO-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return `SPO-${String(nextNum).padStart(6, '0')}`;
  }

  async create(data: SupplierOrderCreateData): Promise<SupplierOrder> {
    try {
      const row = await prisma.supplierOrder.create({
        data: {
          supplierOrderNumber: data.supplierOrderNumber,
          customerOrderId: data.customerOrderId,
          supplierId: data.supplierId,
          status: 'Draft',
          internalNotes: data.internalNotes ?? null,
          items: {
            create: data.items.map((item) => ({
              customerOrderItemId: item.customerOrderItemId,
              productVariantId: item.productVariantId,
              supplierReferenceSnapshot: item.supplierReferenceSnapshot ?? null,
              quantity: item.quantity,
              supplierCost: item.supplierCost,
              status: 'Draft',
            })),
          },
        },
        select: orderSelect,
      });
      return mapOrder(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new SupplierOrderNumberConflictError();
      }
      throw err;
    }
  }

  async generateFromCustomerOrder(customerOrderId: number): Promise<GenerateSupplierOrdersResult> {
    const customerOrder = await prisma.customerOrder.findUnique({
      where: { id: customerOrderId },
      include: {
        items: {
          include: {
            productVariant: {
              select: {
                id: true,
                supplierId: true,
                supplierCost: true,
                supplierReference: true,
                supplier: { select: { id: true, status: true } },
              },
            },
          },
        },
      },
    });

    if (!customerOrder) throw new CustomerOrderNotFoundError();
    if (customerOrder.status === 'Cancelled') {
      throw new CustomerOrderNotEligibleError('Cancelled customer orders cannot generate supplier orders');
    }
    if (!ELIGIBLE_CUSTOMER_ORDER_STATUSES.has(customerOrder.status)) {
      throw new CustomerOrderNotEligibleError(
        'Supplier orders can only be created from paid or processing customer orders'
      );
    }

    const existingItems = await prisma.supplierOrderItem.findMany({
      where: {
        customerOrderItem: { customerOrderId },
      },
      select: { customerOrderItemId: true },
    });
    const coveredItemIds = new Set(existingItems.map((i) => i.customerOrderItemId));

    const uncoveredItems = customerOrder.items.filter((item) => !coveredItemIds.has(item.id));
    let created = false;

    if (uncoveredItems.length > 0) {
      const bySupplier = new Map<number, typeof uncoveredItems>();
      for (const item of uncoveredItems) {
        const supplierId = item.productVariant.supplierId;
        if (!supplierId) throw new VariantSupplierMissingError();
        if (item.productVariant.supplier?.status === 'Blocked') {
          throw new SupplierBlockedError();
        }
        const group = bySupplier.get(supplierId) ?? [];
        group.push(item);
        bySupplier.set(supplierId, group);
      }

      await prisma.$transaction(async (tx) => {
        for (const [supplierId, items] of bySupplier) {
          const last = await tx.supplierOrder.findFirst({
            orderBy: { id: 'desc' },
            select: { supplierOrderNumber: true },
          });
          let nextNum = 1;
          if (last?.supplierOrderNumber) {
            const match = last.supplierOrderNumber.match(/SPO-(\d+)/);
            if (match) nextNum = parseInt(match[1], 10) + 1;
          }
          const supplierOrderNumber = `SPO-${String(nextNum).padStart(6, '0')}`;

          await tx.supplierOrder.create({
            data: {
              supplierOrderNumber,
              customerOrderId,
              supplierId,
              status: 'Draft',
              items: {
                create: items.map((item) => ({
                  customerOrderItemId: item.id,
                  productVariantId: item.productVariantId,
                  supplierReferenceSnapshot: item.productVariant.supplierReference,
                  quantity: item.quantity,
                  supplierCost: new Decimal(item.productVariant.supplierCost?.toString() ?? '0'),
                  status: 'Draft',
                })),
              },
            },
          });
          created = true;
        }

        if (created) {
          await tx.customerOrder.update({
            where: { id: customerOrderId },
            data: { fulfillmentStatus: 'SupplierOrderPlaced' },
          });
        }
      });
    }

    const orders = await this.findByCustomerOrderId(customerOrderId);
    return { orders, created };
  }

  async updateStatus(
    id: number,
    data: SupplierOrderStatusUpdateData
  ): Promise<SupplierOrder> {
    try {
      const row = await prisma.$transaction(async (tx) => {
        const updated = await tx.supplierOrder.update({
          where: { id },
          data: {
            status: data.status,
            ...(data.trackingNumber !== undefined && { trackingNumber: data.trackingNumber }),
            ...(data.trackingUrl !== undefined && { trackingUrl: data.trackingUrl }),
            ...(data.requestedAt !== undefined && { requestedAt: data.requestedAt }),
            ...(data.confirmedAt !== undefined && { confirmedAt: data.confirmedAt }),
            ...(data.shippedAt !== undefined && { shippedAt: data.shippedAt }),
            ...(data.deliveredAt !== undefined && { deliveredAt: data.deliveredAt }),
          },
          select: { id: true, customerOrderId: true },
        });

        await tx.supplierOrderItem.updateMany({
          where: { supplierOrderId: id },
          data: { status: data.status },
        });

        await this.recomputeCustomerFulfillmentInTx(tx, updated.customerOrderId);

        return tx.supplierOrder.findUnique({
          where: { id },
          select: orderSelect,
        });
      });

      if (!row) throw new SupplierOrderNotFoundError();
      return mapOrder(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new SupplierOrderNotFoundError();
      }
      throw err;
    }
  }

  async recomputeCustomerFulfillmentStatus(customerOrderId: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await this.recomputeCustomerFulfillmentInTx(tx, customerOrderId);
    });
  }

  private async recomputeCustomerFulfillmentInTx(
    tx: Prisma.TransactionClient,
    customerOrderId: number
  ): Promise<void> {
    const supplierOrders = await tx.supplierOrder.findMany({
      where: { customerOrderId },
      select: { status: true },
    });

    if (supplierOrders.length === 0) return;

    const statuses = supplierOrders.map((o) => o.status);
    let fulfillmentStatus: string;

    if (statuses.every((s) => s === 'Delivered')) {
      fulfillmentStatus = 'Fulfilled';
    } else if (
      statuses.some((s) => s === 'OutOfStock' || s === 'Cancelled') &&
      !statuses.some((s) => s === 'Delivered' || s === 'Shipped')
    ) {
      fulfillmentStatus = 'Blocked';
    } else if (
      statuses.some((s) => s === 'Delivered' || s === 'Shipped' || s === 'Confirmed')
    ) {
      fulfillmentStatus = 'PartiallyFulfilled';
    } else {
      fulfillmentStatus = 'SupplierOrderPlaced';
    }

    await tx.customerOrder.update({
      where: { id: customerOrderId },
      data: { fulfillmentStatus },
    });
  }
}
