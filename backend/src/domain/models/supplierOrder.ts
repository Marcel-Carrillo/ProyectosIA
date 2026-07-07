export type SupplierOrderStatus =
  | 'Draft'
  | 'Requested'
  | 'Confirmed'
  | 'OutOfStock'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export class SupplierOrderItem {
  id?: number;
  supplierOrderId?: number;
  customerOrderItemId: number;
  productVariantId: number;
  supplierReferenceSnapshot?: string | null;
  quantity: number;
  supplierCost: string;
  status: SupplierOrderStatus;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    supplierOrderId?: number;
    customerOrderItemId: number;
    productVariantId: number;
    supplierReferenceSnapshot?: string | null;
    quantity: number;
    supplierCost: string | number | { toString(): string };
    status?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.supplierOrderId = data.supplierOrderId;
    this.customerOrderItemId = data.customerOrderItemId;
    this.productVariantId = data.productVariantId;
    this.supplierReferenceSnapshot = data.supplierReferenceSnapshot ?? null;
    this.quantity = data.quantity;
    this.supplierCost = String(data.supplierCost);
    this.status = (data.status as SupplierOrderStatus) ?? 'Draft';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}

export interface SupplierOrderSupplierRef {
  id: number;
  name: string;
}

export interface SupplierOrderCustomerOrderRef {
  id: number;
  orderNumber: string;
}

export class SupplierOrder {
  id?: number;
  supplierOrderNumber: string;
  customerOrderId: number;
  supplierId: number;
  status: SupplierOrderStatus;
  requestedAt?: Date | null;
  confirmedAt?: Date | null;
  shippedAt?: Date | null;
  deliveredAt?: Date | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  internalNotes?: string | null;
  // External CJ Dropshipping order fields — intentionally separate from the
  // internal status/tracking fields above (design.md Decision 4): these track
  // the *external* CJ order's own lifecycle, never mixed with the internal,
  // manually-driven fulfillment status.
  externalProvider?: string | null;
  externalOrderId?: string | null;
  externalOrderStatus?: string | null;
  externalTrackingNumber?: string | null;
  externalTrackingProvider?: string | null;
  sandbox: boolean;
  pushedAt?: Date | null;
  lastStatusSyncedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  items?: SupplierOrderItem[];
  supplier?: SupplierOrderSupplierRef;
  customerOrder?: SupplierOrderCustomerOrderRef;

  constructor(data: {
    id?: number;
    supplierOrderNumber: string;
    customerOrderId: number;
    supplierId: number;
    status?: string;
    requestedAt?: Date | null;
    confirmedAt?: Date | null;
    shippedAt?: Date | null;
    deliveredAt?: Date | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    internalNotes?: string | null;
    externalProvider?: string | null;
    externalOrderId?: string | null;
    externalOrderStatus?: string | null;
    externalTrackingNumber?: string | null;
    externalTrackingProvider?: string | null;
    sandbox?: boolean;
    pushedAt?: Date | null;
    lastStatusSyncedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    items?: SupplierOrderItem[];
    supplier?: SupplierOrderSupplierRef;
    customerOrder?: SupplierOrderCustomerOrderRef;
  }) {
    this.id = data.id;
    this.supplierOrderNumber = data.supplierOrderNumber;
    this.customerOrderId = data.customerOrderId;
    this.supplierId = data.supplierId;
    this.status = (data.status as SupplierOrderStatus) ?? 'Draft';
    this.requestedAt = data.requestedAt ?? null;
    this.confirmedAt = data.confirmedAt ?? null;
    this.shippedAt = data.shippedAt ?? null;
    this.deliveredAt = data.deliveredAt ?? null;
    this.trackingNumber = data.trackingNumber ?? null;
    this.trackingUrl = data.trackingUrl ?? null;
    this.internalNotes = data.internalNotes ?? null;
    this.externalProvider = data.externalProvider ?? null;
    this.externalOrderId = data.externalOrderId ?? null;
    this.externalOrderStatus = data.externalOrderStatus ?? null;
    this.externalTrackingNumber = data.externalTrackingNumber ?? null;
    this.externalTrackingProvider = data.externalTrackingProvider ?? null;
    this.sandbox = data.sandbox ?? true;
    this.pushedAt = data.pushedAt ?? null;
    this.lastStatusSyncedAt = data.lastStatusSyncedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.items = data.items;
    this.supplier = data.supplier;
    this.customerOrder = data.customerOrder;
  }
}
