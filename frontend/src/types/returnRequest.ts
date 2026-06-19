export type ReturnRequestStatus =
  | 'Requested'
  | 'Approved'
  | 'Rejected'
  | 'Received'
  | 'Refunded'
  | 'Cancelled';

export interface ReturnRequest {
  id: number;
  customerOrderId: number;
  customerOrderItemId: number;
  reason: string;
  status: ReturnRequestStatus;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnRequestListResult {
  items: ReturnRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface ReturnRequestListFilters {
  customerOrderId?: number;
  status?: ReturnRequestStatus;
  page?: number;
  limit?: number;
}

export interface CreateReturnRequestInput {
  customerOrderId: number;
  customerOrderItemId: number;
  reason: string;
}

export interface UpdateReturnRequestStatusInput {
  status: ReturnRequestStatus;
}

// 'Refunded' is intentionally absent from Received's transitions — the UI
// must NOT expose "Mark as Refunded" (reserved for KAN-20). The backend still
// accepts it; the UI just never sends it.
export const RETURN_REQUEST_TRANSITIONS: Record<ReturnRequestStatus, ReturnRequestStatus[]> = {
  Requested: ['Approved', 'Rejected', 'Cancelled'],
  Approved: ['Received', 'Cancelled'],
  Received: ['Cancelled'],
  Rejected: [],
  Refunded: [],
  Cancelled: [],
};
