import { ReturnRequest, ReturnRequestStatus } from '../models/returnRequest';

export interface ReturnRequestListFilters {
  customerOrderId?: number;
  status?: ReturnRequestStatus;
  page?: number;
  limit?: number;
}

export interface ReturnRequestListResult {
  items: ReturnRequest[];
  total: number;
  page: number;
  limit: number;
}

export interface ReturnRequestCreateData {
  customerOrderId: number;
  customerOrderItemId: number;
  reason: string;
  requestedAt: Date;
}

export interface ReturnRequestStatusUpdateData {
  status: ReturnRequestStatus;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  receivedAt?: Date | null;
}

export interface IReturnRequestRepository {
  findAll(filters: ReturnRequestListFilters): Promise<ReturnRequestListResult>;
  findById(id: number): Promise<ReturnRequest | null>;
  create(data: ReturnRequestCreateData): Promise<ReturnRequest>;
  updateStatus(id: number, data: ReturnRequestStatusUpdateData): Promise<ReturnRequest>;
}
