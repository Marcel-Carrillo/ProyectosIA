import {
  CustomerOrder,
  AddressSnapshot,
  CustomerOrderStatus,
  PaymentStatus,
  FulfillmentStatus,
} from '../models/customerOrder';

export interface CustomerOrderItemInput {
  productVariantId: number;
  quantity: number;
}

export interface CustomerOrderCreateData {
  orderNumber: string;
  customerId: number;
  items: CustomerOrderItemInput[];
  shippingAddressSnapshot: AddressSnapshot;
  billingAddressSnapshot: AddressSnapshot;
  shippingAmount?: number;
  discountAmount?: number;
  currency?: string;
}

export interface CustomerOrderStatusUpdateData {
  status?: CustomerOrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  paidAt?: Date | null;
  cancelledAt?: Date | null;
}

export interface CustomerOrderListFilters {
  page?: number;
  pageSize?: number;
  customerId?: number;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: 'createdAt' | 'totalAmount' | 'orderNumber';
  order?: 'asc' | 'desc';
}

export interface CustomerOrderListResult {
  items: CustomerOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ResolvedOrderLineItem {
  productVariantId: number;
  productNameSnapshot: string;
  variantSnapshot: Record<string, unknown>;
  skuSnapshot: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

export interface ICustomerOrderRepository {
  findAll(filters?: CustomerOrderListFilters): Promise<CustomerOrderListResult>;
  findById(id: number): Promise<CustomerOrder | null>;
  create(
    data: CustomerOrderCreateData,
    resolvedItems: ResolvedOrderLineItem[],
    amounts: { subtotal: string; shipping: string; discount: string; total: string }
  ): Promise<CustomerOrder>;
  updateStatus(id: number, data: CustomerOrderStatusUpdateData): Promise<CustomerOrder>;
  findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<CustomerOrder | null>;
  updateStripeFields(
    id: number,
    data: { stripePaymentIntentId?: string | null; stripeChargeId?: string | null }
  ): Promise<CustomerOrder>;
  generateNextOrderNumber(): Promise<string>;
}
