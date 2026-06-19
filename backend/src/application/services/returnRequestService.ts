import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prismaClient';
import {
  ReturnRequest,
  ReturnRequestStatus,
  isValidReturnRequestTransition,
} from '../../domain/models/returnRequest';
import {
  IReturnRequestRepository,
  ReturnRequestListFilters,
  ReturnRequestListResult,
} from '../../domain/repositories/returnRequestRepository';
import {
  ReturnRequestNotFoundError,
  ReturnRequestOrderCancelledError,
  ReturnRequestItemMismatchError,
  ReturnRequestTransitionInvalidError,
} from '../../infrastructure/repositories/returnRequestRepository';
import {
  CustomerOrderNotFoundError,
  CustomerOrderItemNotFoundError,
} from '../../infrastructure/repositories/customerOrderRepository';
import {
  validateReturnRequestCreateData,
  validateReturnRequestStatusUpdate,
} from '../validator';

export class ReturnRequestService {
  constructor(private readonly returnRequestRepository: IReturnRequestRepository) {}

  async list(filters: ReturnRequestListFilters): Promise<ReturnRequestListResult> {
    return this.returnRequestRepository.findAll(filters);
  }

  async getById(id: number): Promise<ReturnRequest> {
    const rr = await this.returnRequestRepository.findById(id);
    if (!rr) throw new ReturnRequestNotFoundError();
    return rr;
  }

  async create(input: Record<string, unknown>): Promise<ReturnRequest> {
    validateReturnRequestCreateData(input);

    const customerOrderId = input['customerOrderId'] as number;
    const customerOrderItemId = input['customerOrderItemId'] as number;
    const reason = input['reason'] as string;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const order = await tx.customerOrder.findUnique({
        where: { id: customerOrderId },
        select: { id: true, status: true },
      });
      if (!order) throw new CustomerOrderNotFoundError();

      if (order.status === 'Cancelled') throw new ReturnRequestOrderCancelledError();

      const item = await tx.customerOrderItem.findUnique({
        where: { id: customerOrderItemId },
        select: { id: true, customerOrderId: true },
      });
      if (!item) throw new CustomerOrderItemNotFoundError();

      if (item.customerOrderId !== customerOrderId) {
        throw new ReturnRequestItemMismatchError();
      }

      const row = await tx.returnRequest.create({
        data: {
          customerOrderId,
          customerOrderItemId,
          reason,
          status: 'Requested',
          requestedAt: new Date(),
        },
      });

      return new ReturnRequest({ ...row });
    });
  }

  async updateStatus(id: number, input: Record<string, unknown>): Promise<ReturnRequest> {
    validateReturnRequestStatusUpdate(input);

    const newStatus = input['status'] as ReturnRequestStatus;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.returnRequest.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!existing) throw new ReturnRequestNotFoundError();

      if (!isValidReturnRequestTransition(existing.status as ReturnRequestStatus, newStatus)) {
        throw new ReturnRequestTransitionInvalidError(
          `Cannot transition return request from ${existing.status} to ${newStatus}`
        );
      }

      const approvedAt = newStatus === 'Approved' ? new Date() : undefined;
      const rejectedAt = newStatus === 'Rejected' ? new Date() : undefined;
      const receivedAt = newStatus === 'Received' ? new Date() : undefined;

      const updated = await tx.returnRequest.update({
        where: { id },
        data: {
          status: newStatus,
          ...(approvedAt !== undefined && { approvedAt }),
          ...(rejectedAt !== undefined && { rejectedAt }),
          ...(receivedAt !== undefined && { receivedAt }),
        },
      });

      return new ReturnRequest({ ...updated });
    });
  }
}
