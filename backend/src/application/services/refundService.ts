import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prismaClient';
import { Refund, RefundStatus, isValidRefundTransition } from '../../domain/models/refund';
import {
  IRefundRepository,
  RefundListFilters,
  RefundListResult,
} from '../../domain/repositories/refundRepository';
import {
  RefundNotFoundError,
  RefundOrderNotPaidError,
  RefundAmountExceedsBalanceError,
  RefundTransitionInvalidError,
} from '../../infrastructure/repositories/refundRepository';
import { CustomerOrderNotFoundError } from '../../infrastructure/repositories/customerOrderRepository';
import { validateRefundCreateData, validateRefundStatusUpdate } from '../validator';

const ELIGIBLE_ORDER_PAYMENT_STATUSES = new Set(['Paid', 'PartiallyRefunded']);

function computePaymentStatus(
  totalAmount: Decimal,
  completedSum: Decimal
): string {
  if (completedSum.isZero()) return 'Paid';
  if (completedSum.gte(totalAmount)) return 'Refunded';
  return 'PartiallyRefunded';
}

export class RefundService {
  constructor(private readonly refundRepository: IRefundRepository) {}

  async list(filters: RefundListFilters): Promise<RefundListResult> {
    return this.refundRepository.findAll(filters);
  }

  async getById(id: number): Promise<Refund> {
    const refund = await this.refundRepository.findById(id);
    if (!refund) throw new RefundNotFoundError();
    return refund;
  }

  async create(input: Record<string, unknown>): Promise<Refund> {
    validateRefundCreateData(input);

    const customerOrderId = input['customerOrderId'] as number;
    const amount = String(input['amount']);
    const amountDecimal = new Decimal(amount);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const order = await tx.customerOrder.findUnique({
        where: { id: customerOrderId },
        select: {
          id: true,
          paymentStatus: true,
          totalAmount: true,
          refunds: {
            where: { status: { in: ['Completed', 'Processing'] } },
            select: { amount: true },
          },
        },
      });

      if (!order) throw new CustomerOrderNotFoundError();

      if (!ELIGIBLE_ORDER_PAYMENT_STATUSES.has(order.paymentStatus)) {
        throw new RefundOrderNotPaidError();
      }

      const alreadyCommitted = order.refunds.reduce(
        (acc, r) => acc.plus(r.amount.toString()),
        new Decimal(0)
      );

      const refundableBalance = new Decimal(order.totalAmount.toString()).minus(alreadyCommitted);

      if (amountDecimal.gt(refundableBalance)) {
        throw new RefundAmountExceedsBalanceError();
      }

      const refund = await tx.refund.create({
        data: {
          customerOrderId,
          returnRequestId: (input['returnRequestId'] as number | null) ?? null,
          amount,
          reason: (input['reason'] as string | null) ?? null,
          paymentProviderReference: (input['paymentProviderReference'] as string | null) ?? null,
          status: 'Pending',
        },
      });

      return new Refund({ ...refund, amount: refund.amount.toString() });
    });
  }

  async updateStatus(id: number, input: Record<string, unknown>): Promise<Refund> {
    validateRefundStatusUpdate(input);

    const newStatus = input['status'] as RefundStatus;
    const paymentProviderReference = (input['paymentProviderReference'] as string | null) ?? undefined;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.refund.findUnique({
        where: { id },
        select: { id: true, status: true, customerOrderId: true },
      });

      if (!existing) throw new RefundNotFoundError();

      if (!isValidRefundTransition(existing.status as RefundStatus, newStatus)) {
        throw new RefundTransitionInvalidError(
          `Cannot transition refund from ${existing.status} to ${newStatus}`
        );
      }

      const processedAt = newStatus === 'Completed' ? new Date() : undefined;

      const updated = await tx.refund.update({
        where: { id },
        data: {
          status: newStatus,
          ...(processedAt !== undefined && { processedAt }),
          ...(paymentProviderReference !== undefined && { paymentProviderReference }),
        },
      });

      if (newStatus === 'Completed' || newStatus === 'Cancelled' || newStatus === 'Failed') {
        const completedRefunds = await tx.refund.findMany({
          where: {
            customerOrderId: existing.customerOrderId,
            status: 'Completed',
          },
          select: { amount: true },
        });

        const completedSum = completedRefunds.reduce(
          (acc, r) => acc.plus(r.amount.toString()),
          new Decimal(0)
        );

        const order = await tx.customerOrder.findUnique({
          where: { id: existing.customerOrderId },
          select: { totalAmount: true },
        });

        if (order) {
          const newPaymentStatus = computePaymentStatus(
            new Decimal(order.totalAmount.toString()),
            completedSum
          );

          await tx.customerOrder.update({
            where: { id: existing.customerOrderId },
            data: { paymentStatus: newPaymentStatus },
          });
        }
      }

      return new Refund({ ...updated, amount: updated.amount.toString() });
    });
  }
}
