import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { ReturnRequest } from '../../domain/models/returnRequest';
import {
  IReturnRequestRepository,
  ReturnRequestListFilters,
  ReturnRequestListResult,
  ReturnRequestCreateData,
  ReturnRequestStatusUpdateData,
} from '../../domain/repositories/returnRequestRepository';

export class ReturnRequestNotFoundError extends Error {
  readonly code = 'RETURN_REQUEST_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Return request not found');
    this.name = 'ReturnRequestNotFoundError';
    Object.setPrototypeOf(this, ReturnRequestNotFoundError.prototype);
  }
}

export class ReturnRequestOrderCancelledError extends Error {
  readonly code = 'RETURN_REQUEST_ORDER_CANCELLED' as const;
  readonly status = 409;

  constructor() {
    super('Cannot create a return request for a cancelled order');
    this.name = 'ReturnRequestOrderCancelledError';
    Object.setPrototypeOf(this, ReturnRequestOrderCancelledError.prototype);
  }
}

export class ReturnRequestItemMismatchError extends Error {
  readonly code = 'RETURN_REQUEST_ITEM_MISMATCH' as const;
  readonly status = 422;

  constructor() {
    super('The order item does not belong to the specified order');
    this.name = 'ReturnRequestItemMismatchError';
    Object.setPrototypeOf(this, ReturnRequestItemMismatchError.prototype);
  }
}

export class ReturnRequestTransitionInvalidError extends Error {
  readonly code = 'RETURN_REQUEST_TRANSITION_INVALID' as const;
  readonly status = 409;

  constructor(message = 'Invalid return request status transition') {
    super(message);
    this.name = 'ReturnRequestTransitionInvalidError';
    Object.setPrototypeOf(this, ReturnRequestTransitionInvalidError.prototype);
  }
}

const returnRequestSelect = {
  id: true,
  customerOrderId: true,
  customerOrderItemId: true,
  reason: true,
  status: true,
  requestedAt: true,
  approvedAt: true,
  rejectedAt: true,
  receivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ReturnRequestRow = Prisma.ReturnRequestGetPayload<{ select: typeof returnRequestSelect }>;

function mapReturnRequest(row: ReturnRequestRow): ReturnRequest {
  return new ReturnRequest({ ...row });
}

export class ReturnRequestRepository implements IReturnRequestRepository {
  async findAll(filters: ReturnRequestListFilters): Promise<ReturnRequestListResult> {
    const page = filters.page && filters.page >= 1 ? filters.page : 1;
    const limit = filters.limit && filters.limit >= 1 ? Math.min(filters.limit, 100) : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ReturnRequestWhereInput = {};
    if (filters.customerOrderId) where.customerOrderId = filters.customerOrderId;
    if (filters.status) where.status = filters.status;

    const [rows, total] = await prisma.$transaction([
      prisma.returnRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: returnRequestSelect,
      }),
      prisma.returnRequest.count({ where }),
    ]);

    return { items: rows.map(mapReturnRequest), total, page, limit };
  }

  async findById(id: number): Promise<ReturnRequest | null> {
    const row = await prisma.returnRequest.findUnique({
      where: { id },
      select: returnRequestSelect,
    });
    return row ? mapReturnRequest(row) : null;
  }

  async create(data: ReturnRequestCreateData): Promise<ReturnRequest> {
    const row = await prisma.returnRequest.create({
      data: {
        customerOrderId: data.customerOrderId,
        customerOrderItemId: data.customerOrderItemId,
        reason: data.reason,
        status: 'Requested',
        requestedAt: data.requestedAt,
      },
      select: returnRequestSelect,
    });
    return mapReturnRequest(row);
  }

  async updateStatus(id: number, data: ReturnRequestStatusUpdateData): Promise<ReturnRequest> {
    try {
      const row = await prisma.returnRequest.update({
        where: { id },
        data: {
          status: data.status,
          ...(data.approvedAt !== undefined && { approvedAt: data.approvedAt }),
          ...(data.rejectedAt !== undefined && { rejectedAt: data.rejectedAt }),
          ...(data.receivedAt !== undefined && { receivedAt: data.receivedAt }),
        },
        select: returnRequestSelect,
      });
      return mapReturnRequest(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ReturnRequestNotFoundError();
      }
      throw err;
    }
  }
}
