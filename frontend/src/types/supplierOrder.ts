export type SupplierOrderStatus =
  | 'Draft'
  | 'Requested'
  | 'Confirmed'
  | 'OutOfStock'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export interface SupplierOrderItem {
  id: number;
  supplierOrderId: number;
  customerOrderItemId: number;
  productVariantId: number;
  supplierReferenceSnapshot?: string | null;
  quantity: number;
  supplierCost: string;
  status: SupplierOrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierOrder {
  id: number;
  supplierOrderNumber: string;
  customerOrderId: number;
  supplierId: number;
  status: SupplierOrderStatus;
  requestedAt?: string | null;
  confirmedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  internalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: SupplierOrderItem[];
  supplier?: { id: number; name: string };
  customerOrder?: { id: number; orderNumber: string };
}

export interface SupplierOrderQueryParams {
  page?: number;
  pageSize?: number;
  customerOrderId?: number;
  supplierId?: number;
  status?: SupplierOrderStatus;
  search?: string;
  sort?: 'createdAt' | 'supplierOrderNumber';
  order?: 'asc' | 'desc';
}

export interface SupplierOrderListData {
  items: SupplierOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SupplierOrderListResponse {
  success: boolean;
  data: SupplierOrderListData;
  message: string;
}

export interface SupplierOrderResponse {
  success: boolean;
  data: SupplierOrder;
  message: string;
}

export interface SupplierOrderListGenerateResponse {
  success: boolean;
  data: SupplierOrder[];
  message: string;
}

export interface CreateSupplierOrderItemInput {
  customerOrderItemId: number;
  productVariantId: number;
  quantity: number;
  supplierCost: number;
}

export interface CreateSupplierOrderInput {
  customerOrderId: number;
  supplierId: number;
  items: CreateSupplierOrderItemInput[];
  internalNotes?: string;
}

export interface UpdateSupplierOrderStatusInput {
  status: SupplierOrderStatus;
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface SupplierOrderAdminApiError {
  success: false;
  error: { message: string; code: string };
}
