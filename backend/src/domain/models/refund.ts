export type RefundStatus =
  | 'Pending'
  | 'Processing'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Completed', 'Failed', 'Cancelled'],
  Completed: [],
  Failed: [],
  Cancelled: [],
};

export function isValidRefundTransition(from: RefundStatus, to: RefundStatus): boolean {
  return REFUND_TRANSITIONS[from]?.includes(to) ?? false;
}

export class Refund {
  id?: number;
  customerOrderId: number;
  returnRequestId: number | null;
  amount: string;
  reason: string | null;
  status: RefundStatus;
  paymentProviderReference: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  processedAt: Date | null;

  constructor(data: {
    id?: number;
    customerOrderId: number;
    returnRequestId?: number | null;
    amount: string | number | { toString(): string };
    reason?: string | null;
    status?: string;
    paymentProviderReference?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    processedAt?: Date | null;
  }) {
    this.id = data.id;
    this.customerOrderId = data.customerOrderId;
    this.returnRequestId = data.returnRequestId ?? null;
    this.amount = String(data.amount);
    this.reason = data.reason ?? null;
    this.status = (data.status as RefundStatus) ?? 'Pending';
    this.paymentProviderReference = data.paymentProviderReference ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.processedAt = data.processedAt ?? null;
  }
}
