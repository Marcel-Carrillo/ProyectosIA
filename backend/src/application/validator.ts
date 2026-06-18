import {
  OrderStatusTransitionInvalidError,
  PaymentStatusTransitionInvalidError,
  FulfillmentStatusTransitionInvalidError,
} from '../infrastructure/repositories/customerOrderRepository';
import {
  SupplierOrderStatusTransitionInvalidError,
  CustomerOrderNotEligibleError,
} from '../infrastructure/repositories/supplierOrderRepository';

export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export function validateRequiredFields(
  data: Record<string, unknown>,
  fields: string[]
): void {
  for (const field of fields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`Field '${field}' is required`);
    }
  }
}

export function validateProductData(data: Record<string, unknown>): void {
  const name = data['name'];
  if (name === undefined || name === null || name === '') {
    throw new ValidationError("Field 'name' is required");
  }
  if (typeof name === 'string' && name.length > 150) {
    throw new ValidationError("Field 'name' must not exceed 150 characters");
  }

  const status = data['status'];
  if (status !== undefined && status !== null && status !== '') {
    const validStatuses = ['Draft', 'Active', 'Inactive', 'Archived'];
    if (!validStatuses.includes(status as string)) {
      throw new ValidationError(`Field 'status' must be one of: ${validStatuses.join(', ')}`);
    }
  }
}

export function validateProductVariantPublicPrice(publicPrice: unknown): void {
  if (publicPrice === undefined || publicPrice === null || publicPrice === '') {
    throw new ValidationError("Field 'publicPrice' is required");
  }
  const price = Number(publicPrice);
  if (isNaN(price) || price <= 0) {
    throw new ValidationError("Field 'publicPrice' must be a positive number");
  }
}

export function validateProductVariantData(data: Record<string, unknown>): void {
  validateProductVariantPublicPrice(data['publicPrice']);

  const sku = data['sku'];
  if (sku === undefined || sku === null || sku === '') {
    throw new ValidationError("Field 'sku' is required");
  }
}

export function validateProductImageData(data: Record<string, unknown>): void {
  const url = data['url'];
  if (url === undefined || url === null || url === '') {
    throw new ValidationError("Field 'url' is required");
  }
  if (typeof url === 'string' && url.length > 500) {
    throw new ValidationError("Field 'url' must not exceed 500 characters");
  }
}

export function validateCategoryData(data: Record<string, unknown>): void {
  const name = data['name'];
  if (name === undefined || name === null || name === '') {
    throw new ValidationError("Field 'name' is required");
  }

  const status = data['status'];
  if (status !== undefined && status !== null && status !== '') {
    if (status !== 'Active' && status !== 'Inactive') {
      throw new ValidationError("Field 'status' must be 'Active' or 'Inactive'");
    }
  }

  const parentId = data['parentId'];
  if (parentId !== undefined && parentId !== null) {
    if (typeof parentId !== 'number' || !Number.isInteger(parentId) || parentId <= 0) {
      throw new ValidationError("Field 'parentId' must be a positive integer");
    }
  }
}

const SUPPLIER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSupplierOptionalFields(data: Record<string, unknown>): void {
  const contactName = data['contactName'];
  if (contactName !== undefined && contactName !== null && contactName !== '') {
    if (typeof contactName === 'string' && contactName.length > 150) {
      throw new ValidationError("Field 'contactName' must not exceed 150 characters");
    }
  }

  const contactEmail = data['contactEmail'];
  
  if (contactEmail !== undefined && contactEmail !== null && contactEmail !== '') {
    if (typeof contactEmail !== 'string') {
      throw new ValidationError("Field 'contactEmail' must be a string");
    }
  
    if (contactEmail.length > 255) {
      throw new ValidationError("Field 'contactEmail' must not exceed 255 characters");
    }
  
    if (!SUPPLIER_EMAIL_REGEX.test(contactEmail)) {
      throw new ValidationError("Field 'contactEmail' must be a valid email address");
    }
  }

  const contactPhone = data['contactPhone'];
  if (contactPhone !== undefined && contactPhone !== null && contactPhone !== '') {
    if (typeof contactPhone === 'string' && contactPhone.length > 30) {
      throw new ValidationError("Field 'contactPhone' must not exceed 30 characters");
    }
  }

  const website = data['website'];
  if (website !== undefined && website !== null && website !== '') {
    if (typeof website === 'string' && website.length > 500) {
      throw new ValidationError("Field 'website' must not exceed 500 characters");
    }
  }

  const notes = data['notes'];
  if (notes !== undefined && notes !== null && notes !== '') {
    if (typeof notes === 'string' && notes.length > 2000) {
      throw new ValidationError("Field 'notes' must not exceed 2000 characters");
    }
  }

  const status = data['status'];
  if (status !== undefined && status !== null && status !== '') {
    const validStatuses = ['Active', 'Inactive', 'Blocked'];
    if (!validStatuses.includes(status as string)) {
      throw new ValidationError(`Field 'status' must be one of: ${validStatuses.join(', ')}`);
    }
  }
}

export function validateSupplierData(
  data: Record<string, unknown>,
  options: { requireName?: boolean } = { requireName: true }
): void {
  const name = data['name'];
  if (options.requireName !== false) {
    if (name === undefined || name === null || name === '') {
      throw new ValidationError("Field 'name' is required");
    }
  }
  if (name !== undefined && name !== null && name !== '') {
    if (typeof name === 'string' && name.length > 150) {
      throw new ValidationError("Field 'name' must not exceed 150 characters");
    }
  }
  validateSupplierOptionalFields(data);
}

const CUSTOMER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCustomerData(
  data: Record<string, unknown>,
  options: { requireFields?: boolean } = { requireFields: true }
): void {
  const firstName = data['firstName'];
  if (options.requireFields !== false) {
    if (firstName === undefined || firstName === null || firstName === '') {
      throw new ValidationError("Field 'firstName' is required");
    }
  }
  if (firstName !== undefined && firstName !== null && firstName !== '') {
    if (typeof firstName === 'string' && firstName.length > 100) {
      throw new ValidationError("Field 'firstName' must not exceed 100 characters");
    }
  }

  const lastName = data['lastName'];
  if (options.requireFields !== false) {
    if (lastName === undefined || lastName === null || lastName === '') {
      throw new ValidationError("Field 'lastName' is required");
    }
  }
  if (lastName !== undefined && lastName !== null && lastName !== '') {
    if (typeof lastName === 'string' && lastName.length > 100) {
      throw new ValidationError("Field 'lastName' must not exceed 100 characters");
    }
  }

  const email = data['email'];
  if (options.requireFields !== false) {
    if (email === undefined || email === null || email === '') {
      throw new ValidationError("Field 'email' is required");
    }
  }
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string') {
      throw new ValidationError("Field 'email' must be a string");
    }
    if (email.length > 255) {
      throw new ValidationError("Field 'email' must not exceed 255 characters");
    }
    if (!CUSTOMER_EMAIL_REGEX.test(email)) {
      throw new ValidationError("Field 'email' must be a valid email address");
    }
  }

  const phone = data['phone'];
  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone === 'string' && phone.length > 30) {
      throw new ValidationError("Field 'phone' must not exceed 30 characters");
    }
  }
}

const CUSTOMER_ORDER_STATUSES = [
  'PendingPayment',
  'Paid',
  'Processing',
  'Completed',
  'Cancelled',
  'Refunded',
] as const;

const PAYMENT_STATUSES = [
  'Pending',
  'Authorized',
  'Paid',
  'Failed',
  'Refunded',
  'PartiallyRefunded',
] as const;

const FULFILLMENT_STATUSES = [
  'NotStarted',
  'PendingSupplierOrder',
  'SupplierOrderPlaced',
  'PartiallyFulfilled',
  'Fulfilled',
  'Blocked',
  'Cancelled',
] as const;

const PAID_ORDER_STATUSES = new Set(['Paid', 'Processing', 'Completed', 'Refunded']);

function validateAddressSnapshotField(
  data: unknown,
  fieldName: string,
  requireAll = true
): void {
  if (data === undefined || data === null) {
    if (requireAll) throw new ValidationError(`Field '${fieldName}' is required`);
    return;
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new ValidationError(`Field '${fieldName}' must be an object`);
  }
  validateCustomerAddressData(
    { ...(data as Record<string, unknown>), type: 'Shipping' },
    { requireAll }
  );
}

export function validateCustomerOrderCreateData(data: Record<string, unknown>): void {
  const customerId = data['customerId'];
  if (customerId === undefined || customerId === null) {
    throw new ValidationError("Field 'customerId' is required");
  }
  if (!Number.isInteger(customerId) || (customerId as number) < 1) {
    throw new ValidationError("Field 'customerId' must be a positive integer");
  }

  const items = data['items'];
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("Field 'items' must be a non-empty array");
  }
  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      throw new ValidationError('Each item must be an object');
    }
    const record = item as Record<string, unknown>;
    const productVariantId = record['productVariantId'];
    if (!Number.isInteger(productVariantId) || (productVariantId as number) < 1) {
      throw new ValidationError("Each item's 'productVariantId' must be a positive integer");
    }
    const quantity = record['quantity'];
    if (!Number.isInteger(quantity) || (quantity as number) < 1) {
      throw new ValidationError("Each item's 'quantity' must be a positive integer");
    }
  }

  validateAddressSnapshotField(data['shippingAddressSnapshot'], 'shippingAddressSnapshot');
  validateAddressSnapshotField(data['billingAddressSnapshot'], 'billingAddressSnapshot');

  const shippingAmount = data['shippingAmount'];
  if (shippingAmount !== undefined && shippingAmount !== null) {
    const num = Number(shippingAmount);
    if (!Number.isFinite(num) || num < 0) {
      throw new ValidationError("Field 'shippingAmount' must be >= 0");
    }
  }

  const discountAmount = data['discountAmount'];
  if (discountAmount !== undefined && discountAmount !== null) {
    const num = Number(discountAmount);
    if (!Number.isFinite(num) || num < 0) {
      throw new ValidationError("Field 'discountAmount' must be >= 0");
    }
  }
}

export function validateCustomerOrderStatusUpdate(
  current: {
    status: string;
    paymentStatus: string;
    fulfillmentStatus: string;
  },
  update: Record<string, unknown>
): void {
  const status = update['status'];
  if (status !== undefined && status !== null && status !== '') {
    if (!CUSTOMER_ORDER_STATUSES.includes(status as (typeof CUSTOMER_ORDER_STATUSES)[number])) {
      throw new ValidationError(`Field 'status' must be one of: ${CUSTOMER_ORDER_STATUSES.join(', ')}`);
    }
    if (
      status === 'PendingPayment' &&
      (PAID_ORDER_STATUSES.has(current.status) || current.paymentStatus === 'Paid')
    ) {
      throw new OrderStatusTransitionInvalidError(
        'A paid order cannot move back to PendingPayment'
      );
    }
  }

  const paymentStatus = update['paymentStatus'];
  if (paymentStatus !== undefined && paymentStatus !== null && paymentStatus !== '') {
    if (!PAYMENT_STATUSES.includes(paymentStatus as (typeof PAYMENT_STATUSES)[number])) {
      throw new ValidationError(
        `Field 'paymentStatus' must be one of: ${PAYMENT_STATUSES.join(', ')}`
      );
    }
  }

  const fulfillmentStatus = update['fulfillmentStatus'];
  if (fulfillmentStatus !== undefined && fulfillmentStatus !== null && fulfillmentStatus !== '') {
    if (
      !FULFILLMENT_STATUSES.includes(fulfillmentStatus as (typeof FULFILLMENT_STATUSES)[number])
    ) {
      throw new ValidationError(
        `Field 'fulfillmentStatus' must be one of: ${FULFILLMENT_STATUSES.join(', ')}`
      );
    }
    if (
      current.status === 'Cancelled' &&
      fulfillmentStatus !== current.fulfillmentStatus &&
      fulfillmentStatus !== 'Cancelled'
    ) {
      throw new FulfillmentStatusTransitionInvalidError(
        'A cancelled order cannot advance fulfillment status'
      );
    }
  }
}

export {
  OrderStatusTransitionInvalidError,
  PaymentStatusTransitionInvalidError,
  FulfillmentStatusTransitionInvalidError,
};

const SUPPLIER_ORDER_STATUSES = [
  'Draft',
  'Requested',
  'Confirmed',
  'OutOfStock',
  'Shipped',
  'Delivered',
  'Cancelled',
] as const;

const ELIGIBLE_SUPPLIER_ORDER_CUSTOMER_STATUSES = new Set(['Paid', 'Processing']);

const SUPPLIER_ORDER_TRANSITIONS: Record<string, Set<string>> = {
  Draft: new Set(['Requested', 'Cancelled']),
  Requested: new Set(['Confirmed', 'OutOfStock', 'Cancelled']),
  Confirmed: new Set(['Shipped', 'OutOfStock', 'Cancelled']),
  OutOfStock: new Set(['Cancelled']),
  Shipped: new Set(['Delivered']),
  Delivered: new Set(),
  Cancelled: new Set(),
};

export function validateSupplierOrderCreateData(data: Record<string, unknown>): void {
  const customerOrderId = data['customerOrderId'];
  if (!Number.isInteger(customerOrderId) || (customerOrderId as number) < 1) {
    throw new ValidationError("Field 'customerOrderId' must be a positive integer");
  }

  const supplierId = data['supplierId'];
  if (!Number.isInteger(supplierId) || (supplierId as number) < 1) {
    throw new ValidationError("Field 'supplierId' must be a positive integer");
  }

  const items = data['items'];
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("Field 'items' must be a non-empty array");
  }

  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      throw new ValidationError('Each item must be an object');
    }
    const record = item as Record<string, unknown>;
    if (!Number.isInteger(record['customerOrderItemId']) || (record['customerOrderItemId'] as number) < 1) {
      throw new ValidationError("Each item's 'customerOrderItemId' must be a positive integer");
    }
    if (!Number.isInteger(record['productVariantId']) || (record['productVariantId'] as number) < 1) {
      throw new ValidationError("Each item's 'productVariantId' must be a positive integer");
    }
    if (!Number.isInteger(record['quantity']) || (record['quantity'] as number) < 1) {
      throw new ValidationError("Each item's 'quantity' must be a positive integer");
    }
    const cost = Number(record['supplierCost']);
    if (!Number.isFinite(cost) || cost < 0) {
      throw new ValidationError("Each item's 'supplierCost' must be >= 0");
    }
  }

  const internalNotes = data['internalNotes'];
  if (internalNotes !== undefined && internalNotes !== null && typeof internalNotes === 'string') {
    if (internalNotes.length > 2000) {
      throw new ValidationError("Field 'internalNotes' must not exceed 2000 characters");
    }
  }
}

export function validateCustomerOrderEligibleForSupplierOrder(status: string): void {
  if (status === 'Cancelled') {
    throw new CustomerOrderNotEligibleError('Cancelled customer orders cannot generate supplier orders');
  }
  if (!ELIGIBLE_SUPPLIER_ORDER_CUSTOMER_STATUSES.has(status)) {
    throw new CustomerOrderNotEligibleError(
      'Supplier orders can only be created from paid or processing customer orders'
    );
  }
}

export function validateSupplierOrderStatusUpdate(
  currentStatus: string,
  update: Record<string, unknown>
): void {
  const status = update['status'];
  if (status === undefined || status === null || status === '') {
    throw new ValidationError("Field 'status' is required");
  }
  if (!SUPPLIER_ORDER_STATUSES.includes(status as (typeof SUPPLIER_ORDER_STATUSES)[number])) {
    throw new ValidationError(
      `Field 'status' must be one of: ${SUPPLIER_ORDER_STATUSES.join(', ')}`
    );
  }

  const allowed = SUPPLIER_ORDER_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.has(status as string)) {
    throw new SupplierOrderStatusTransitionInvalidError(
      `Cannot transition supplier order from ${currentStatus} to ${status}`
    );
  }

  const trackingNumber = update['trackingNumber'];
  if (trackingNumber !== undefined && trackingNumber !== null && typeof trackingNumber === 'string') {
    if (trackingNumber.length > 100) {
      throw new ValidationError("Field 'trackingNumber' must not exceed 100 characters");
    }
  }

  const trackingUrl = update['trackingUrl'];
  if (trackingUrl !== undefined && trackingUrl !== null && typeof trackingUrl === 'string') {
    if (trackingUrl.length > 500) {
      throw new ValidationError("Field 'trackingUrl' must not exceed 500 characters");
    }
  }
}

export {
  SupplierOrderStatusTransitionInvalidError,
  CustomerOrderNotEligibleError,
  VariantSupplierMissingError,
  SupplierBlockedError,
} from '../infrastructure/repositories/supplierOrderRepository';

export function validateCustomerAddressData(
  data: Record<string, unknown>,
  options: { requireAll?: boolean } = { requireAll: true }
): void {
  const VALID_TYPES = ['Shipping', 'Billing'];

  const type = data['type'];
  if (options.requireAll !== false) {
    if (type === undefined || type === null || type === '') {
      throw new ValidationError("Field 'type' is required");
    }
  }
  if (type !== undefined && type !== null && type !== '') {
    if (!VALID_TYPES.includes(type as string)) {
      throw new ValidationError(`Field 'type' must be one of: ${VALID_TYPES.join(', ')}`);
    }
  }

  const fullName = data['fullName'];
  if (options.requireAll !== false) {
    if (fullName === undefined || fullName === null || fullName === '') {
      throw new ValidationError("Field 'fullName' is required");
    }
  }
  if (fullName !== undefined && fullName !== null && fullName !== '') {
    if (typeof fullName === 'string' && fullName.length > 150) {
      throw new ValidationError("Field 'fullName' must not exceed 150 characters");
    }
  }

  const streetLine1 = data['streetLine1'];
  if (options.requireAll !== false) {
    if (streetLine1 === undefined || streetLine1 === null || streetLine1 === '') {
      throw new ValidationError("Field 'streetLine1' is required");
    }
  }
  if (streetLine1 !== undefined && streetLine1 !== null && streetLine1 !== '') {
    if (typeof streetLine1 === 'string' && streetLine1.length > 150) {
      throw new ValidationError("Field 'streetLine1' must not exceed 150 characters");
    }
  }

  const streetLine2 = data['streetLine2'];
  if (streetLine2 !== undefined && streetLine2 !== null && streetLine2 !== '') {
    if (typeof streetLine2 === 'string' && streetLine2.length > 150) {
      throw new ValidationError("Field 'streetLine2' must not exceed 150 characters");
    }
  }

  const city = data['city'];
  if (options.requireAll !== false) {
    if (city === undefined || city === null || city === '') {
      throw new ValidationError("Field 'city' is required");
    }
  }
  if (city !== undefined && city !== null && city !== '') {
    if (typeof city === 'string' && city.length > 100) {
      throw new ValidationError("Field 'city' must not exceed 100 characters");
    }
  }

  const province = data['province'];
  if (options.requireAll !== false) {
    if (province === undefined || province === null || province === '') {
      throw new ValidationError("Field 'province' is required");
    }
  }
  if (province !== undefined && province !== null && province !== '') {
    if (typeof province === 'string' && province.length > 100) {
      throw new ValidationError("Field 'province' must not exceed 100 characters");
    }
  }

  const postalCode = data['postalCode'];
  if (options.requireAll !== false) {
    if (postalCode === undefined || postalCode === null || postalCode === '') {
      throw new ValidationError("Field 'postalCode' is required");
    }
  }
  if (postalCode !== undefined && postalCode !== null && postalCode !== '') {
    if (typeof postalCode === 'string' && postalCode.length > 20) {
      throw new ValidationError("Field 'postalCode' must not exceed 20 characters");
    }
  }

  const country = data['country'];
  if (options.requireAll !== false) {
    if (country === undefined || country === null || country === '') {
      throw new ValidationError("Field 'country' is required");
    }
  }
  if (country !== undefined && country !== null && country !== '') {
    if (typeof country === 'string' && country.length > 100) {
      throw new ValidationError("Field 'country' must not exceed 100 characters");
    }
  }

  const phone = data['phone'];
  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone === 'string' && phone.length > 30) {
      throw new ValidationError("Field 'phone' must not exceed 30 characters");
    }
  }
}

const REFUND_STATUSES = ['Pending', 'Processing', 'Completed', 'Failed', 'Cancelled'] as const;

export function validateRefundCreateData(data: Record<string, unknown>): void {
  const customerOrderId = data['customerOrderId'];
  if (customerOrderId === undefined || customerOrderId === null) {
    throw new ValidationError("Field 'customerOrderId' is required");
  }
  if (!Number.isInteger(customerOrderId) || (customerOrderId as number) < 1) {
    throw new ValidationError("Field 'customerOrderId' must be a positive integer");
  }

  const amount = data['amount'];
  if (amount === undefined || amount === null || amount === '') {
    throw new ValidationError("Field 'amount' is required");
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new ValidationError("Field 'amount' must be a positive number");
  }

  const returnRequestId = data['returnRequestId'];
  if (returnRequestId !== undefined && returnRequestId !== null) {
    if (!Number.isInteger(returnRequestId) || (returnRequestId as number) < 1) {
      throw new ValidationError("Field 'returnRequestId' must be a positive integer");
    }
  }

  const reason = data['reason'];
  if (reason !== undefined && reason !== null && reason !== '') {
    if (typeof reason === 'string' && reason.length > 500) {
      throw new ValidationError("Field 'reason' must not exceed 500 characters");
    }
  }

  const refundPaymentRef = data['paymentProviderReference'];
  if (refundPaymentRef !== undefined && refundPaymentRef !== null && refundPaymentRef !== '') {
    if (typeof refundPaymentRef === 'string' && refundPaymentRef.length > 150) {
      throw new ValidationError("Field 'paymentProviderReference' must not exceed 150 characters");
    }
  }
}

export function validateRefundStatusUpdate(data: Record<string, unknown>): void {
  const status = data['status'];
  if (status === undefined || status === null || status === '') {
    throw new ValidationError("Field 'status' is required");
  }
  if (!REFUND_STATUSES.includes(status as (typeof REFUND_STATUSES)[number])) {
    throw new ValidationError(
      `Field 'status' must be one of: ${REFUND_STATUSES.join(', ')}`
    );
  }

  const statusPaymentRef = data['paymentProviderReference'];
  if (statusPaymentRef !== undefined && statusPaymentRef !== null && statusPaymentRef !== '') {
    if (typeof statusPaymentRef === 'string' && statusPaymentRef.length > 150) {
      throw new ValidationError("Field 'paymentProviderReference' must not exceed 150 characters");
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shipment validators
// ─────────────────────────────────────────────────────────────────────────────
const SHIPMENT_STATUSES = [
  'Pending',
  'Shipped',
  'InTransit',
  'Delivered',
  'Failed',
  'Returned',
] as const;

export function validateShipmentCreateData(data: Record<string, unknown>): void {
  const customerOrderId = data['customerOrderId'];
  if (customerOrderId === undefined || customerOrderId === null) {
    throw new ValidationError("Field 'customerOrderId' is required");
  }
  if (!Number.isInteger(customerOrderId) || (customerOrderId as number) < 1) {
    throw new ValidationError("Field 'customerOrderId' must be a positive integer");
  }

  const supplierOrderId = data['supplierOrderId'];
  if (supplierOrderId !== undefined && supplierOrderId !== null) {
    if (!Number.isInteger(supplierOrderId) || (supplierOrderId as number) < 1) {
      throw new ValidationError("Field 'supplierOrderId' must be a positive integer");
    }
  }

  const carrier = data['carrier'];
  if (carrier !== undefined && carrier !== null && carrier !== '') {
    if (typeof carrier === 'string' && carrier.length > 100) {
      throw new ValidationError("Field 'carrier' must not exceed 100 characters");
    }
  }

  const trackingNumber = data['trackingNumber'];
  if (trackingNumber !== undefined && trackingNumber !== null && trackingNumber !== '') {
    if (typeof trackingNumber === 'string' && trackingNumber.length > 100) {
      throw new ValidationError("Field 'trackingNumber' must not exceed 100 characters");
    }
  }

  const trackingUrl = data['trackingUrl'];
  if (trackingUrl !== undefined && trackingUrl !== null && trackingUrl !== '') {
    if (typeof trackingUrl === 'string' && trackingUrl.length > 500) {
      throw new ValidationError("Field 'trackingUrl' must not exceed 500 characters");
    }
  }
}

export function validateShipmentStatusUpdate(data: Record<string, unknown>): void {
  const status = data['status'];
  if (status === undefined || status === null || status === '') {
    throw new ValidationError("Field 'status' is required");
  }
  if (!SHIPMENT_STATUSES.includes(status as (typeof SHIPMENT_STATUSES)[number])) {
    throw new ValidationError(
      `Field 'status' must be one of: ${SHIPMENT_STATUSES.join(', ')}`
    );
  }
}
