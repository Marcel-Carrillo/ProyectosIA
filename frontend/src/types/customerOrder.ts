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

export interface CustomerOrderItem {
  id: number;
  customerOrderId: number;
  productVariantId: number;
  productNameSnapshot: string;
  variantSnapshot: Record<string, unknown>;
  skuSnapshot: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  fulfillmentStatus: FulfillmentStatus;
}

export interface CustomerOrderCustomerRef {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CustomerOrder {
  id: number;
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
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
  items?: CustomerOrderItem[];
  customer?: CustomerOrderCustomerRef;
}

export interface CustomerOrderQueryParams {
  page?: number;
  pageSize?: number;
  customerId?: number;
  status?: CustomerOrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: 'createdAt' | 'totalAmount' | 'orderNumber';
  order?: 'asc' | 'desc';
}

export interface CustomerOrderListData {
  items: CustomerOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CustomerOrderListResponse {
  success: boolean;
  data: CustomerOrderListData;
  message: string;
}

export interface CustomerOrderResponse {
  success: boolean;
  data: CustomerOrder;
  message: string;
}

export interface CreateCustomerOrderItemInput {
  productVariantId: number;
  quantity: number;
}

export interface CreateCustomerOrderInput {
  customerId: number;
  items: CreateCustomerOrderItemInput[];
  shippingAddressSnapshot: AddressSnapshot;
  billingAddressSnapshot: AddressSnapshot;
  shippingAmount?: number;
  discountAmount?: number;
}

export interface UpdateCustomerOrderStatusInput {
  status?: CustomerOrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
}

export interface CustomerOrderAdminApiError {
  success: false;
  error: { message: string; code: string };
}
