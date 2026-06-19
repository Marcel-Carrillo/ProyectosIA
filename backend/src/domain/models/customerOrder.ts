export type CustomerOrderStatus =
  | 'PendingPayment'
  | 'Paid'
  | 'Processing'
  | 'Completed'
  | 'Cancelled'
  | 'Refunded';

export type PaymentStatus =
  | 'Pending'
  | 'Authorized'
  | 'Paid'
  | 'Failed'
  | 'Refunded'
  | 'PartiallyRefunded';

export type FulfillmentStatus =
  | 'NotStarted'
  | 'PendingSupplierOrder'
  | 'SupplierOrderPlaced'
  | 'PartiallyFulfilled'
  | 'Fulfilled'
  | 'Blocked'
  | 'Cancelled';

export interface AddressSnapshot {
  fullName: string;
  phone?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export class CustomerOrderItem {
  id?: number;
  customerOrderId?: number;
  productVariantId: number;
  productNameSnapshot: string;
  variantSnapshot: Record<string, unknown>;
  skuSnapshot: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  fulfillmentStatus: FulfillmentStatus;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    customerOrderId?: number;
    productVariantId: number;
    productNameSnapshot: string;
    variantSnapshot: Record<string, unknown>;
    skuSnapshot: string;
    quantity: number;
    unitPrice: string | number | { toString(): string };
    totalPrice: string | number | { toString(): string };
    fulfillmentStatus?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.customerOrderId = data.customerOrderId;
    this.productVariantId = data.productVariantId;
    this.productNameSnapshot = data.productNameSnapshot;
    this.variantSnapshot = data.variantSnapshot;
    this.skuSnapshot = data.skuSnapshot;
    this.quantity = data.quantity;
    this.unitPrice = String(data.unitPrice);
    this.totalPrice = String(data.totalPrice);
    this.fulfillmentStatus = (data.fulfillmentStatus as FulfillmentStatus) ?? 'NotStarted';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}

export interface CustomerOrderCustomerRef {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

export class CustomerOrder {
  id?: number;
  orderNumber: string;
  customerId: number;
  status: CustomerOrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotalAmount: string;
  shippingAmount: string;
  discountAmount: string;
  totalAmount: string;
  currency: string;
  shippingAddressSnapshot: AddressSnapshot;
  billingAddressSnapshot: AddressSnapshot;
  createdAt?: Date;
  updatedAt?: Date;
  paidAt?: Date | null;
  cancelledAt?: Date | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  items?: CustomerOrderItem[];
  customer?: CustomerOrderCustomerRef;

  constructor(data: {
    id?: number;
    orderNumber: string;
    customerId: number;
    status?: string;
    paymentStatus?: string;
    fulfillmentStatus?: string;
    subtotalAmount: string | number | { toString(): string };
    shippingAmount: string | number | { toString(): string };
    discountAmount: string | number | { toString(): string };
    totalAmount: string | number | { toString(): string };
    currency?: string;
    shippingAddressSnapshot: AddressSnapshot;
    billingAddressSnapshot: AddressSnapshot;
    createdAt?: Date;
    updatedAt?: Date;
    paidAt?: Date | null;
    cancelledAt?: Date | null;
    stripePaymentIntentId?: string | null;
    stripeChargeId?: string | null;
    items?: CustomerOrderItem[];
    customer?: CustomerOrderCustomerRef;
  }) {
    this.id = data.id;
    this.orderNumber = data.orderNumber;
    this.customerId = data.customerId;
    this.status = (data.status as CustomerOrderStatus) ?? 'PendingPayment';
    this.paymentStatus = (data.paymentStatus as PaymentStatus) ?? 'Pending';
    this.fulfillmentStatus = (data.fulfillmentStatus as FulfillmentStatus) ?? 'NotStarted';
    this.subtotalAmount = String(data.subtotalAmount);
    this.shippingAmount = String(data.shippingAmount);
    this.discountAmount = String(data.discountAmount);
    this.totalAmount = String(data.totalAmount);
    this.currency = data.currency ?? 'EUR';
    this.shippingAddressSnapshot = data.shippingAddressSnapshot;
    this.billingAddressSnapshot = data.billingAddressSnapshot;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.paidAt = data.paidAt ?? null;
    this.cancelledAt = data.cancelledAt ?? null;
    this.stripePaymentIntentId = data.stripePaymentIntentId ?? null;
    this.stripeChargeId = data.stripeChargeId ?? null;
    this.items = data.items;
    this.customer = data.customer;
  }
}
