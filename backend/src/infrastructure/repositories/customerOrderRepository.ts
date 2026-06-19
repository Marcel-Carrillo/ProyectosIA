import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import {
  CustomerOrder,
  CustomerOrderItem,
  AddressSnapshot,
} from '../../domain/models/customerOrder';
import {
  ICustomerOrderRepository,
  CustomerOrderCreateData,
  CustomerOrderStatusUpdateData,
  CustomerOrderListFilters,
  CustomerOrderListResult,
  ResolvedOrderLineItem,
} from '../../domain/repositories/customerOrderRepository';

export class CustomerOrderNotFoundError extends Error {
  readonly code = 'CUSTOMER_ORDER_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Customer order not found');
    this.name = 'CustomerOrderNotFoundError';
    Object.setPrototypeOf(this, CustomerOrderNotFoundError.prototype);
  }
}

export class CustomerOrderItemNotFoundError extends Error {
  readonly code = 'CUSTOMER_ORDER_ITEM_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Customer order item not found');
    this.name = 'CustomerOrderItemNotFoundError';
    Object.setPrototypeOf(this, CustomerOrderItemNotFoundError.prototype);
  }
}

export class OrderNumberConflictError extends Error {
  readonly code = 'ORDER_NUMBER_CONFLICT' as const;
  readonly status = 409;

  constructor() {
    super('Order number already exists');
    this.name = 'OrderNumberConflictError';
    Object.setPrototypeOf(this, OrderNumberConflictError.prototype);
  }
}

export class OrderStatusTransitionInvalidError extends Error {
  readonly code = 'ORDER_STATUS_TRANSITION_INVALID' as const;
  readonly status = 422;

  constructor(message = 'Invalid order status transition') {
    super(message);
    this.name = 'OrderStatusTransitionInvalidError';
    Object.setPrototypeOf(this, OrderStatusTransitionInvalidError.prototype);
  }
}

export class PaymentStatusTransitionInvalidError extends Error {
  readonly code = 'PAYMENT_STATUS_TRANSITION_INVALID' as const;
  readonly status = 422;

  constructor(message = 'Invalid payment status transition') {
    super(message);
    this.name = 'PaymentStatusTransitionInvalidError';
    Object.setPrototypeOf(this, PaymentStatusTransitionInvalidError.prototype);
  }
}

export class FulfillmentStatusTransitionInvalidError extends Error {
  readonly code = 'FULFILLMENT_STATUS_TRANSITION_INVALID' as const;
  readonly status = 422;

  constructor(message = 'Invalid fulfillment status transition') {
    super(message);
    this.name = 'FulfillmentStatusTransitionInvalidError';
    Object.setPrototypeOf(this, FulfillmentStatusTransitionInvalidError.prototype);
  }
}

const customerRefSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

const itemSelect = {
  id: true,
  customerOrderId: true,
  productVariantId: true,
  productNameSnapshot: true,
  variantSnapshot: true,
  skuSnapshot: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  fulfillmentStatus: true,
  createdAt: true,
  updatedAt: true,
} as const;

const orderSelect = {
  id: true,
  orderNumber: true,
  customerId: true,
  status: true,
  paymentStatus: true,
  fulfillmentStatus: true,
  subtotalAmount: true,
  shippingAmount: true,
  discountAmount: true,
  totalAmount: true,
  currency: true,
  shippingAddressSnapshot: true,
  billingAddressSnapshot: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  cancelledAt: true,
  stripePaymentIntentId: true,
  stripeChargeId: true,
  customer: { select: customerRefSelect },
  items: { select: itemSelect },
} as const;

type OrderRow = Prisma.CustomerOrderGetPayload<{ select: typeof orderSelect }>;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function startOfUtcDay(isoDate: string): Date | undefined {
  if (!ISO_DATE_RE.test(isoDate)) return undefined;
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function endOfUtcDay(isoDate: string): Date | undefined {
  if (!ISO_DATE_RE.test(isoDate)) return undefined;
  return new Date(`${isoDate}T23:59:59.999Z`);
}

function mapOrder(row: OrderRow): CustomerOrder {
  return new CustomerOrder({
    ...row,
    shippingAddressSnapshot: row.shippingAddressSnapshot as unknown as AddressSnapshot,
    billingAddressSnapshot: row.billingAddressSnapshot as unknown as AddressSnapshot,
    items: row.items?.map(
      (item) =>
        new CustomerOrderItem({
          ...item,
          variantSnapshot: item.variantSnapshot as Record<string, unknown>,
        })
    ),
    customer: row.customer ?? undefined,
  });
}

export class CustomerOrderRepository implements ICustomerOrderRepository {
  async findAll(filters: CustomerOrderListFilters = {}): Promise<CustomerOrderListResult> {
    const page =
      filters.page != null && Number.isFinite(filters.page) && filters.page >= 1
        ? filters.page
        : 1;
    const pageSize =
      filters.pageSize != null && Number.isFinite(filters.pageSize) && filters.pageSize >= 1
        ? filters.pageSize
        : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CustomerOrderWhereInput = {};
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.status) where.status = filters.status;
    if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
    if (filters.fulfillmentStatus) where.fulfillmentStatus = filters.fulfillmentStatus;
    if (filters.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const createdFrom = filters.createdFrom ? startOfUtcDay(filters.createdFrom) : undefined;
    const createdTo = filters.createdTo ? endOfUtcDay(filters.createdTo) : undefined;
    if (createdFrom || createdTo) {
      where.createdAt = {
        ...(createdFrom ? { gte: createdFrom } : {}),
        ...(createdTo ? { lte: createdTo } : {}),
      };
    }

    const sortField = filters.sort ?? 'createdAt';
    const sortOrder = filters.order === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.CustomerOrderOrderByWithRelationInput =
      sortField === 'totalAmount'
        ? { totalAmount: sortOrder }
        : sortField === 'orderNumber'
          ? { orderNumber: sortOrder }
          : { createdAt: sortOrder };

    const [rows, total] = await prisma.$transaction([
      prisma.customerOrder.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          ...orderSelect,
          items: false,
        },
      }),
      prisma.customerOrder.count({ where }),
    ]);

    return {
      items: rows.map((row) => mapOrder({ ...row, items: [] })),
      total,
      page,
      pageSize,
    };
  }

  async findById(id: number): Promise<CustomerOrder | null> {
    const row = await prisma.customerOrder.findUnique({
      where: { id },
      select: orderSelect,
    });
    return row ? mapOrder(row) : null;
  }

  async generateNextOrderNumber(): Promise<string> {
    const last = await prisma.customerOrder.findFirst({
      orderBy: { id: 'desc' },
      select: { orderNumber: true },
    });
    let nextNum = 1;
    if (last?.orderNumber) {
      const match = last.orderNumber.match(/ORD-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return `ORD-${String(nextNum).padStart(6, '0')}`;
  }

  async create(
    data: CustomerOrderCreateData,
    resolvedItems: ResolvedOrderLineItem[],
    amounts: { subtotal: string; shipping: string; discount: string; total: string }
  ): Promise<CustomerOrder> {
    try {
      const row = await prisma.customerOrder.create({
        data: {
          orderNumber: data.orderNumber,
          customerId: data.customerId,
          status: 'PendingPayment',
          paymentStatus: 'Pending',
          fulfillmentStatus: 'NotStarted',
          subtotalAmount: amounts.subtotal,
          shippingAmount: amounts.shipping,
          discountAmount: amounts.discount,
          totalAmount: amounts.total,
          currency: data.currency ?? 'EUR',
          shippingAddressSnapshot: data.shippingAddressSnapshot as unknown as Prisma.InputJsonValue,
          billingAddressSnapshot: data.billingAddressSnapshot as unknown as Prisma.InputJsonValue,
          items: {
            create: resolvedItems.map((item) => ({
              productVariantId: item.productVariantId,
              productNameSnapshot: item.productNameSnapshot,
              variantSnapshot: item.variantSnapshot as Prisma.InputJsonValue,
              skuSnapshot: item.skuSnapshot,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              fulfillmentStatus: 'NotStarted',
            })),
          },
        },
        select: orderSelect,
      });
      return mapOrder(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new OrderNumberConflictError();
      }
      throw err;
    }
  }

  async findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<CustomerOrder | null> {
    const row = await prisma.customerOrder.findUnique({
      where: { stripePaymentIntentId },
      select: orderSelect,
    });
    return row ? mapOrder(row) : null;
  }

  async updateStripeFields(
    id: number,
    data: { stripePaymentIntentId?: string | null; stripeChargeId?: string | null }
  ): Promise<CustomerOrder> {
    try {
      const row = await prisma.customerOrder.update({
        where: { id },
        data: {
          ...(data.stripePaymentIntentId !== undefined && {
            stripePaymentIntentId: data.stripePaymentIntentId,
          }),
          ...(data.stripeChargeId !== undefined && {
            stripeChargeId: data.stripeChargeId,
          }),
        },
        select: orderSelect,
      });
      return mapOrder(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new CustomerOrderNotFoundError();
      }
      throw err;
    }
  }

  async updateStatus(
    id: number,
    data: CustomerOrderStatusUpdateData
  ): Promise<CustomerOrder> {
    try {
      const row = await prisma.customerOrder.update({
        where: { id },
        data: {
          ...(data.status !== undefined && { status: data.status }),
          ...(data.paymentStatus !== undefined && { paymentStatus: data.paymentStatus }),
          ...(data.fulfillmentStatus !== undefined && { fulfillmentStatus: data.fulfillmentStatus }),
          ...(data.paidAt !== undefined && { paidAt: data.paidAt }),
          ...(data.cancelledAt !== undefined && { cancelledAt: data.cancelledAt }),
        },
        select: orderSelect,
      });
      return mapOrder(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new CustomerOrderNotFoundError();
      }
      throw err;
    }
  }
}
