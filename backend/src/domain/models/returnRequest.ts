export type ReturnRequestStatus =
  | 'Requested'
  | 'Approved'
  | 'Rejected'
  | 'Received'
  | 'Refunded'
  | 'Cancelled';

export const RETURN_REQUEST_TRANSITIONS: Record<ReturnRequestStatus, ReturnRequestStatus[]> = {
  Requested: ['Approved', 'Rejected', 'Cancelled'],
  Approved: ['Received', 'Cancelled'],
  Received: ['Refunded', 'Cancelled'],
  Rejected: [],
  Refunded: [],
  Cancelled: [],
};

export function isValidReturnRequestTransition(
  from: ReturnRequestStatus,
  to: ReturnRequestStatus
): boolean {
  return RETURN_REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

export class ReturnRequest {
  id?: number;
  customerOrderId: number;
  customerOrderItemId: number;
  reason: string;
  status: ReturnRequestStatus;
  requestedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  receivedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    customerOrderId: number;
    customerOrderItemId: number;
    reason: string;
    status?: string;
    requestedAt: Date;
    approvedAt?: Date | null;
    rejectedAt?: Date | null;
    receivedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.customerOrderId = data.customerOrderId;
    this.customerOrderItemId = data.customerOrderItemId;
    this.reason = data.reason;
    this.status = (data.status as ReturnRequestStatus) ?? 'Requested';
    this.requestedAt = data.requestedAt;
    this.approvedAt = data.approvedAt ?? null;
    this.rejectedAt = data.rejectedAt ?? null;
    this.receivedAt = data.receivedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
