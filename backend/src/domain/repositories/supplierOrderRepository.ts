import {
  SupplierOrder,
  SupplierOrderStatus,
} from '../models/supplierOrder';

export interface SupplierOrderItemInput {
  customerOrderItemId: number;
  productVariantId: number;
  quantity: number;
  supplierCost: string;
  supplierReferenceSnapshot?: string | null;
}

export interface SupplierOrderCreateData {
  supplierOrderNumber: string;
  customerOrderId: number;
  supplierId: number;
  items: SupplierOrderItemInput[];
  internalNotes?: string | null;
}

export interface SupplierOrderStatusUpdateData {
  status: SupplierOrderStatus;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  requestedAt?: Date | null;
  confirmedAt?: Date | null;
  shippedAt?: Date | null;
  deliveredAt?: Date | null;
}

export interface SupplierOrderListFilters {
  page?: number;
  pageSize?: number;
  customerOrderId?: number;
  supplierId?: number;
  status?: string;
  search?: string;
  sort?: 'createdAt' | 'supplierOrderNumber';
  order?: 'asc' | 'desc';
}

export interface SupplierOrderListResult {
  items: SupplierOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GenerateSupplierOrdersResult {
  orders: SupplierOrder[];
  created: boolean;
}

export interface SupplierOrderExternalPushData {
  externalProvider: string;
  externalOrderId: string;
  sandbox: boolean;
  pushedAt: Date;
}

export interface SupplierOrderExternalStatusData {
  externalOrderStatus: string;
  externalTrackingNumber?: string | null;
  externalTrackingProvider?: string | null;
  lastStatusSyncedAt: Date;
}

export interface ISupplierOrderRepository {
  findAll(filters?: SupplierOrderListFilters): Promise<SupplierOrderListResult>;
  findById(id: number): Promise<SupplierOrder | null>;
  findByCustomerOrderId(customerOrderId: number): Promise<SupplierOrder[]>;
  findByExternalOrderId(externalOrderId: string): Promise<SupplierOrder | null>;
  create(data: SupplierOrderCreateData): Promise<SupplierOrder>;
  generateFromCustomerOrder(customerOrderId: number): Promise<GenerateSupplierOrdersResult>;
  updateStatus(id: number, data: SupplierOrderStatusUpdateData): Promise<SupplierOrder>;
  // Returns null when no row was updated because externalOrderId was already
  // set by a concurrent push between the caller's own check and this write —
  // the caller must treat that as "already pushed", not silently overwrite it.
  updateExternalOrder(id: number, data: SupplierOrderExternalPushData): Promise<SupplierOrder | null>;
  updateExternalOrderStatus(id: number, data: SupplierOrderExternalStatusData): Promise<SupplierOrder>;
  generateNextSupplierOrderNumber(): Promise<string>;
  // Candidate set for the scheduled CJ status-sync job: pushed to CJ
  // (externalOrderId set) but not yet in a terminal externalOrderStatus.
  findPushedNonTerminal(): Promise<SupplierOrder[]>;
  recomputeCustomerFulfillmentStatus(customerOrderId: number): Promise<void>;
}
