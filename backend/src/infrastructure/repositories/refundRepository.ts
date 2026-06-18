import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { Refund } from '../../domain/models/refund';
import {
  IRefundRepository,
  RefundListFilters,
  RefundListResult,
  RefundCreateData,
  RefundStatusUpdateData,
} from '../../domain/repositories/refundRepository';

export class RefundNotFoundError extends Error {
  readonly code = 'REFUND_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Refund not found');
    this.name = 'RefundNotFoundError';
    Object.setPrototypeOf(this, RefundNotFoundError.prototype);
  }
}

export class RefundOrderNotPaidError extends Error {
  readonly code = 'REFUND_ORDER_NOT_PAID' as const;
  readonly status = 409;

  constructor() {
    super('Refund cannot be created: order payment status is not Paid or PartiallyRefunded');
    this.name = 'RefundOrderNotPaidError';
    Object.setPrototypeOf(this, RefundOrderNotPaidError.prototype);
  }
}

export class RefundAmountExceedsBalanceError extends Error {
  readonly code = 'REFUND_AMOUNT_EXCEEDS_BALANCE' as const;
  readonly status = 409;

  constructor() {
    super('Refund amount exceeds the refundable balance for this order');
    this.name = 'RefundAmountExceedsBalanceError';
    Object.setPrototypeOf(this, RefundAmountExceedsBalanceError.prototype);
  }
}

export class RefundTransitionInvalidError extends Error {
  readonly code = 'REFUND_TRANSITION_INVALID' as const;
  readonly status = 409;

  constructor(message = 'Invalid refund status transition') {
    super(message);
    this.name = 'RefundTransitionInvalidError';
    Object.setPrototypeOf(this, RefundTransitionInvalidError.prototype);
  }
}

const refundSelect = {
  id: true,
  customerOrderId: true,
  returnRequestId: true,
  amount: true,
  reason: true,
  status: true,
  paymentProviderReference: true,
  createdAt: true,
  updatedAt: true,
  processedAt: true,
} as const;

type RefundRow = Prisma.RefundGetPayload<{ select: typeof refundSelect }>;

function mapRefund(row: RefundRow): Refund {
  return new Refund({
    ...row,
    amount: row.amount.toString(),
  });
}

export class RefundRepository implements IRefundRepository {
  async findAll(filters: RefundListFilters): Promise<RefundListResult> {
    const page = filters.page && filters.page >= 1 ? filters.page : 1;
    const limit = filters.limit && filters.limit >= 1 ? Math.min(filters.limit, 100) : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.RefundWhereInput = {};
    if (filters.customerOrderId) where.customerOrderId = filters.customerOrderId;
    if (filters.status) where.status = filters.status;

    const [rows, total] = await prisma.$transaction([
      prisma.refund.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: refundSelect,
      }),
      prisma.refund.count({ where }),
    ]);

    return { items: rows.map(mapRefund), total, page, limit };
  }

  async findById(id: number): Promise<Refund | null> {
    const row = await prisma.refund.findUnique({
      where: { id },
      select: refundSelect,
    });
    return row ? mapRefund(row) : null;
  }

  async create(data: RefundCreateData): Promise<Refund> {
    const row = await prisma.refund.create({
      data: {
        customerOrderId: data.customerOrderId,
        returnRequestId: data.returnRequestId ?? null,
        amount: data.amount,
        reason: data.reason ?? null,
        paymentProviderReference: data.paymentProviderReference ?? null,
        status: 'Pending',
      },
      select: refundSelect,
    });
    return mapRefund(row);
  }

  async updateStatus(id: number, data: RefundStatusUpdateData): Promise<Refund> {
    try {
      const row = await prisma.refund.update({
        where: { id },
        data: {
          status: data.status,
          ...(data.processedAt !== undefined && { processedAt: data.processedAt }),
          ...(data.paymentProviderReference !== undefined && {
            paymentProviderReference: data.paymentProviderReference,
          }),
        },
        select: refundSelect,
      });
      return mapRefund(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new RefundNotFoundError();
      }
      throw err;
    }
  }
}
