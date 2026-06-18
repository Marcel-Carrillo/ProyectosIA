import { Refund, RefundStatus } from '../models/refund';

export interface RefundListFilters {
  customerOrderId?: number;
  status?: RefundStatus;
  page?: number;
  limit?: number;
}

export interface RefundListResult {
  items: Refund[];
  total: number;
  page: number;
  limit: number;
}

export interface RefundCreateData {
  customerOrderId: number;
  returnRequestId?: number | null;
  amount: string;
  reason?: string | null;
  paymentProviderReference?: string | null;
}

export interface RefundStatusUpdateData {
  status: RefundStatus;
  paymentProviderReference?: string | null;
  processedAt?: Date | null;
}

export interface IRefundRepository {
  findAll(filters: RefundListFilters): Promise<RefundListResult>;
  findById(id: number): Promise<Refund | null>;
  create(data: RefundCreateData): Promise<Refund>;
  updateStatus(id: number, data: RefundStatusUpdateData): Promise<Refund>;
}
