export type RefundStatus =
  | 'Pending'
  | 'Processing'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export interface Refund {
  id: number;
  customerOrderId: number;
  returnRequestId: number | null;
  amount: string;
  reason: string | null;
  status: RefundStatus;
  paymentProviderReference: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
}

export interface RefundListResult {
  items: Refund[];
  total: number;
  page: number;
  limit: number;
}

export interface RefundListFilters {
  customerOrderId?: number;
  status?: RefundStatus;
  page?: number;
  limit?: number;
}

export interface CreateRefundInput {
  customerOrderId: number;
  amount: string | number;
  reason?: string | null;
  returnRequestId?: number | null;
  paymentProviderReference?: string | null;
}

export interface UpdateRefundStatusInput {
  status: RefundStatus;
  paymentProviderReference?: string | null;
}

export const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Completed', 'Failed', 'Cancelled'],
  Completed: [],
  Failed: [],
  Cancelled: [],
};

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  Pending: 'Pendiente',
  Processing: 'En proceso',
  Completed: 'Completado',
  Failed: 'Fallido',
  Cancelled: 'Cancelado',
};

export const REFUND_STATUS_COLORS: Record<RefundStatus, string> = {
  Pending: 'secondary',
  Processing: 'warning',
  Completed: 'success',
  Failed: 'danger',
  Cancelled: 'dark',
};
