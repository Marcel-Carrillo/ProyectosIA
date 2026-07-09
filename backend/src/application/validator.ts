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

export class TranslationLocaleInvalidError extends Error {
  readonly code = 'TRANSLATION_LOCALE_INVALID' as const;
  readonly status = 422;

  constructor() {
    super("Field 'locale' must be one of: en, es");
    this.name = 'TranslationLocaleInvalidError';
    Object.setPrototypeOf(this, TranslationLocaleInvalidError.prototype);
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

const GTIN_VALID_LENGTHS = [8, 12, 13, 14];

export function isValidGtinFormat(value: string): boolean {
  return /^\d+$/.test(value) && GTIN_VALID_LENGTHS.includes(value.length);
}

/**
 * Validates and normalizes `data['gtin']` in place: trims whitespace, converts an
 * empty string to `null`, and throws on invalid format/length. Shared between
 * validateProductData (create) and ProductService.update() so both paths reject
 * the same malformed GTINs instead of only enforcing the rule on create.
 */
export function validateAndNormalizeGtinField(data: Record<string, unknown>): void {
  const gtin = data['gtin'];
  if (gtin === undefined || gtin === null) return;
  if (typeof gtin !== 'string') {
    throw new ValidationError("Field 'gtin' must be a string");
  }
  const trimmed = gtin.trim();
  if (trimmed === '') {
    data['gtin'] = null;
  } else if (!isValidGtinFormat(trimmed)) {
    throw new ValidationError(
      "Field 'gtin' must contain only digits and be 8, 12, 13, or 14 characters long"
    );
  } else {
    data['gtin'] = trimmed;
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

  validateAndNormalizeGtinField(data);
}

const SUPPORTED_LOCALES = ['en', 'es'];

export function validateTranslationsArray(translations: unknown): void {
  if (translations === undefined || translations === null) return;
  if (!Array.isArray(translations)) {
    throw new ValidationError("Field 'translations' must be an array");
  }
  for (const item of translations) {
    validateTranslationInput(item as Record<string, unknown>);
  }
}

export function validateTranslationInput(data: Record<string, unknown>): void {
  const locale = data['locale'];
  if (!locale || !SUPPORTED_LOCALES.includes(locale as string)) {
    throw new TranslationLocaleInvalidError();
  }
  const name = data['name'];
  if (!name || name === '') {
    throw new ValidationError("Field 'name' is required for translation");
  }
  if (typeof name === 'string' && name.length > 150) {
    throw new ValidationError("Translation 'name' must not exceed 150 characters");
  }
  const description = data['description'];
  if (description !== undefined && description !== null && typeof description === 'string' && description.length > 2000) {
    throw new ValidationError("Translation 'description' must not exceed 2000 characters");
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

const VALID_STOCK_POLICIES = ['SupplierManaged', 'InternalStock', 'Hybrid'] as const;

export function validateProductVariantStockPolicy(stockPolicy: unknown): void {
  if (stockPolicy === undefined || stockPolicy === null || stockPolicy === '') return;
  if (!VALID_STOCK_POLICIES.includes(stockPolicy as (typeof VALID_STOCK_POLICIES)[number])) {
    throw new ValidationError(
      `Field 'stockPolicy' must be one of: ${VALID_STOCK_POLICIES.join(', ')}`
    );
  }
}

export function validateProductVariantData(data: Record<string, unknown>): void {
  validateProductVariantPublicPrice(data['publicPrice']);

  const sku = data['sku'];
  if (sku === undefined || sku === null || sku === '') {
    throw new ValidationError("Field 'sku' is required");
  }

  validateProductVariantStockPolicy(data['stockPolicy']);
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

const PAYABLE_PAYMENT_STATUSES = new Set(['Pending', 'Failed']);

export function validatePendingOrderPayable(order: { status: string; paymentStatus: string }): void {
  if (order.status !== 'PendingPayment' || !PAYABLE_PAYMENT_STATUSES.has(order.paymentStatus)) {
    throw new OrderNotPayableError();
  }
}

export function validatePendingOrderCancellable(order: { status: string }): void {
  if (order.status === 'Cancelled') return;
  if (order.status !== 'PendingPayment') {
    throw new OrderNotCancellableError();
  }
}

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

// ─────────────────────────────────────────────────────────────────────────────
// ReturnRequest validators
// ─────────────────────────────────────────────────────────────────────────────

const RETURN_REQUEST_STATUSES = [
  'Requested',
  'Approved',
  'Rejected',
  'Received',
  'Refunded',
  'Cancelled',
] as const;

export function validateReturnRequestCreateData(data: Record<string, unknown>): void {
  const customerOrderId = data['customerOrderId'];
  if (customerOrderId === undefined || customerOrderId === null) {
    throw new ValidationError("Field 'customerOrderId' is required");
  }
  if (!Number.isInteger(customerOrderId) || (customerOrderId as number) < 1) {
    throw new ValidationError("Field 'customerOrderId' must be a positive integer");
  }

  const customerOrderItemId = data['customerOrderItemId'];
  if (customerOrderItemId === undefined || customerOrderItemId === null) {
    throw new ValidationError("Field 'customerOrderItemId' is required");
  }
  if (!Number.isInteger(customerOrderItemId) || (customerOrderItemId as number) < 1) {
    throw new ValidationError("Field 'customerOrderItemId' must be a positive integer");
  }

  const reason = data['reason'];
  if (reason === undefined || reason === null || reason === '') {
    throw new ValidationError("Field 'reason' is required");
  }
  if (typeof reason === 'string' && reason.length > 500) {
    throw new ValidationError("Field 'reason' must not exceed 500 characters");
  }
}

export function validateReturnRequestStatusUpdate(data: Record<string, unknown>): void {
  const status = data['status'];
  if (status === undefined || status === null || status === '') {
    throw new ValidationError("Field 'status' is required");
  }
  if (!RETURN_REQUEST_STATUSES.includes(status as (typeof RETURN_REQUEST_STATUSES)[number])) {
    throw new ValidationError(
      `Field 'status' must be one of: ${RETURN_REQUEST_STATUSES.join(', ')}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Review validators
// ─────────────────────────────────────────────────────────────────────────────

// Rejects genuine control characters (null byte, etc.) but deliberately allows
// ordinary punctuation including '<' and '>' — review text is stored as plain
// text and rendered through Seo.tsx's existing <script>-escaping mechanism at
// render time, not sanitized/blacklisted at the input boundary.
// Built from character codes (not a literal escape sequence in source) to avoid
// editor/tooling mangling of raw control bytes: matches ASCII 0-8, 11, 12,
// 14-31, and 127 (DEL) -- i.e. all C0 control codes except tab(9)/LF(10)/CR(13).
const CONTROL_CHAR_CODES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
  25, 26, 27, 28, 29, 30, 31, 127,
];
const CONTROL_CHARS_PATTERN =
  '[' + CONTROL_CHAR_CODES.map((c) => String.fromCharCode(c)).join('') + ']';
const CONTROL_CHARS_REGEX = new RegExp(CONTROL_CHARS_PATTERN);

export function validateReviewData(data: Record<string, unknown>): void {
  const productId = data['productId'];
  if (productId === undefined || productId === null) {
    throw new ValidationError("Field 'productId' is required");
  }
  if (!Number.isInteger(productId) || (productId as number) < 1) {
    throw new ValidationError("Field 'productId' must be a positive integer");
  }

  const rating = data['rating'];
  if (rating === undefined || rating === null || rating === '') {
    throw new ValidationError("Field 'rating' is required");
  }
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
    throw new ValidationError("Field 'rating' must be an integer between 1 and 5");
  }

  const title = data['title'];
  if (title !== undefined && title !== null && title !== '') {
    if (typeof title !== 'string') {
      throw new ValidationError("Field 'title' must be a string");
    }
    if (title.length > 150) {
      throw new ValidationError("Field 'title' must not exceed 150 characters");
    }
    if (CONTROL_CHARS_REGEX.test(title)) {
      throw new ValidationError("Field 'title' contains invalid control characters");
    }
  }

  const body = data['body'];
  if (body !== undefined && body !== null && body !== '') {
    if (typeof body !== 'string') {
      throw new ValidationError("Field 'body' must be a string");
    }
    if (body.length > 2000) {
      throw new ValidationError("Field 'body' must not exceed 2000 characters");
    }
    if (CONTROL_CHARS_REGEX.test(body)) {
      throw new ValidationError("Field 'body' contains invalid control characters");
    }
  }
}

const REVIEW_MODERATION_STATUSES = ['Approved', 'Rejected'] as const;

export function validateReviewStatusUpdate(data: Record<string, unknown>): void {
  const status = data['status'];
  if (status === undefined || status === null || status === '') {
    throw new ValidationError("Field 'status' is required");
  }
  if (!REVIEW_MODERATION_STATUSES.includes(status as (typeof REVIEW_MODERATION_STATUSES)[number])) {
    throw new ValidationError(
      `Field 'status' must be one of: ${REVIEW_MODERATION_STATUSES.join(', ')}`
    );
  }

  const moderationNote = data['moderationNote'];
  if (moderationNote !== undefined && moderationNote !== null && moderationNote !== '') {
    if (typeof moderationNote === 'string' && moderationNote.length > 500) {
      throw new ValidationError("Field 'moderationNote' must not exceed 500 characters");
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stripe / Payment error classes
// ─────────────────────────────────────────────────────────────────────────────

export class PaymentGatewayUnavailableError extends Error {
  readonly code = 'PAYMENT_GATEWAY_UNAVAILABLE' as const;
  readonly status = 503;

  constructor(message = 'Payment gateway is unavailable') {
    super(message);
    this.name = 'PaymentGatewayUnavailableError';
    Object.setPrototypeOf(this, PaymentGatewayUnavailableError.prototype);
  }
}

export class PaymentWebhookSignatureInvalidError extends Error {
  readonly code = 'PAYMENT_WEBHOOK_SIGNATURE_INVALID' as const;
  readonly status = 400;

  constructor(message = 'Webhook signature verification failed') {
    super(message);
    this.name = 'PaymentWebhookSignatureInvalidError';
    Object.setPrototypeOf(this, PaymentWebhookSignatureInvalidError.prototype);
  }
}

export class RefundStripeError extends Error {
  readonly code = 'REFUND_STRIPE_ERROR' as const;
  readonly status = 409;

  constructor(message = 'Stripe refund creation failed') {
    super(message);
    this.name = 'RefundStripeError';
    Object.setPrototypeOf(this, RefundStripeError.prototype);
  }
}

export class OrderNotPayableError extends Error {
  readonly code = 'ORDER_NOT_PAYABLE' as const;
  readonly status = 409;

  constructor(message = 'Order is not in a payable state') {
    super(message);
    this.name = 'OrderNotPayableError';
    Object.setPrototypeOf(this, OrderNotPayableError.prototype);
  }
}

export class OrderNotCancellableError extends Error {
  readonly code = 'ORDER_NOT_CANCELLABLE' as const;
  readonly status = 409;

  constructor(message = 'Order is not in a cancellable state') {
    super(message);
    this.name = 'OrderNotCancellableError';
    Object.setPrototypeOf(this, OrderNotCancellableError.prototype);
  }
}

// Internal, payment-layer-only error: thrown by paymentService.cancelPaymentIntent and
// always caught + translated to OrderNotCancellableError inside customerOrderService.cancelPendingOrder.
// Must never be wired into errorHandler.ts directly.
export class PaymentIntentAlreadyCapturedError extends Error {
  readonly code = 'PAYMENT_INTENT_ALREADY_CAPTURED' as const;
  readonly status = 409;

  constructor(message = 'PaymentIntent is already captured and cannot be cancelled') {
    super(message);
    this.name = 'PaymentIntentAlreadyCapturedError';
    Object.setPrototypeOf(this, PaymentIntentAlreadyCapturedError.prototype);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CJ Dropshipping integration validators + error classes
// ─────────────────────────────────────────────────────────────────────────────

export function validateCjConnectionData(data: Record<string, unknown>): void {
  const externalAccountRef = data['externalAccountRef'];
  if (externalAccountRef !== undefined && externalAccountRef !== null && externalAccountRef !== '') {
    if (typeof externalAccountRef !== 'string') {
      throw new ValidationError("Field 'externalAccountRef' must be a string");
    }
    if (externalAccountRef.length > 150) {
      throw new ValidationError("Field 'externalAccountRef' must not exceed 150 characters");
    }
  }
  // No field named apiKey/secret/credential is ever accepted here — the request
  // body only allows externalAccountRef; the CJ Dropshipping API key always
  // comes from environment/SSM configuration, never from a client request.
}

// Validates the order-push request body accepts ONLY logisticName. There is no
// `isSandbox` field anywhere in this validator, so nothing downstream can ever
// read one — sandbox mode is always forced server-side (design.md Decision 5).
export function validateCjOrderPushData(data: Record<string, unknown>): { logisticName: string } {
  const logisticName = data['logisticName'];
  if (typeof logisticName !== 'string' || logisticName.trim().length === 0) {
    throw new ValidationError("Field 'logisticName' is required and must be a non-empty string");
  }
  if ('isSandbox' in data) {
    throw new ValidationError("Field 'isSandbox' is not accepted — sandbox mode is always forced server-side");
  }
  return { logisticName };
}

export class CjConnectionNotReadyError extends Error {
  readonly code = 'CJ_CONNECTION_NOT_READY' as const;
  readonly status = 422;

  constructor(message = 'CJ Dropshipping connection must be Connected before syncing') {
    super(message);
    this.name = 'CjConnectionNotReadyError';
    Object.setPrototypeOf(this, CjConnectionNotReadyError.prototype);
  }
}

export class CjApiUnavailableError extends Error {
  readonly code = 'CJ_API_UNAVAILABLE' as const;
  readonly status = 502;

  constructor(message = 'CJ Dropshipping API is currently unavailable') {
    super(message);
    this.name = 'CjApiUnavailableError';
    Object.setPrototypeOf(this, CjApiUnavailableError.prototype);
  }
}

export class CjItemNotMappedError extends Error {
  readonly code = 'CJ_ITEM_NOT_MAPPED' as const;
  readonly status = 422;

  constructor(message = 'Supplier order item has no corresponding staged CJ Dropshipping variant') {
    super(message);
    this.name = 'CjItemNotMappedError';
    Object.setPrototypeOf(this, CjItemNotMappedError.prototype);
  }
}

export class CjOrderAlreadyPushedError extends Error {
  readonly code = 'CJ_ORDER_ALREADY_PUSHED' as const;
  readonly status = 409;

  constructor(message = 'Supplier order has already been pushed to CJ Dropshipping') {
    super(message);
    this.name = 'CjOrderAlreadyPushedError';
    Object.setPrototypeOf(this, CjOrderAlreadyPushedError.prototype);
  }
}

export class CjOrderNotPushedError extends Error {
  readonly code = 'CJ_ORDER_NOT_PUSHED' as const;
  readonly status = 422;

  constructor(message = 'Supplier order has not been pushed to CJ Dropshipping yet') {
    super(message);
    this.name = 'CjOrderNotPushedError';
    Object.setPrototypeOf(this, CjOrderNotPushedError.prototype);
  }
}

export class CjCatalogItemNotPromotedError extends Error {
  readonly code = 'CJ_CATALOG_ITEM_NOT_PROMOTED' as const;
  readonly status = 422;

  constructor(message = 'CJ catalog item has not been promoted to a product variant') {
    super(message);
    this.name = 'CjCatalogItemNotPromotedError';
    Object.setPrototypeOf(this, CjCatalogItemNotPromotedError.prototype);
  }
}

export class CjPromotionPriceRequiredError extends Error {
  readonly code = 'CJ_PROMOTION_PRICE_REQUIRED' as const;
  readonly status = 422;

  constructor(message = 'publicPrice is required: no explicit price given and CJ_DEFAULT_MARKUP_MULTIPLIER is not configured') {
    super(message);
    this.name = 'CjPromotionPriceRequiredError';
    Object.setPrototypeOf(this, CjPromotionPriceRequiredError.prototype);
  }
}

export class CjPromotionCategoryRequiredError extends Error {
  readonly code = 'CJ_PROMOTION_CATEGORY_REQUIRED' as const;
  readonly status = 422;

  constructor(message = 'A valid categoryId is required to promote CJ catalog items') {
    super(message);
    this.name = 'CjPromotionCategoryRequiredError';
    Object.setPrototypeOf(this, CjPromotionCategoryRequiredError.prototype);
  }
}

export class CjCatalogItemSyncFailedCannotPromoteError extends Error {
  readonly code = 'CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE' as const;
  readonly status = 422;

  constructor(message = 'CJ catalog item failed to sync and cannot be promoted') {
    super(message);
    this.name = 'CjCatalogItemSyncFailedCannotPromoteError';
    Object.setPrototypeOf(this, CjCatalogItemSyncFailedCannotPromoteError.prototype);
  }
}

export class CjCatalogItemNotFoundError extends Error {
  readonly code = 'CJ_CATALOG_ITEM_NOT_FOUND' as const;
  readonly status = 422;

  constructor(message = 'CJ catalog item not found for this supplier') {
    super(message);
    this.name = 'CjCatalogItemNotFoundError';
    Object.setPrototypeOf(this, CjCatalogItemNotFoundError.prototype);
  }
}

export interface CjPromotionItemError {
  cjCatalogItemId: number;
  code: string;
  message: string;
}

// Aggregate error carrying a per-item error list. Bulk promotion pre-validates
// every requested item before opening a transaction (design.md Risk mitigation);
// when any item fails, this single error reports all of them at once instead of
// only the first, so the admin can fix every problem in one round trip.
export class CjPromotionValidationError extends Error {
  readonly code = 'CJ_PROMOTION_VALIDATION_FAILED' as const;
  readonly status = 422;
  readonly itemErrors: CjPromotionItemError[];

  constructor(itemErrors: CjPromotionItemError[]) {
    super('One or more items failed promotion validation');
    this.name = 'CjPromotionValidationError';
    this.itemErrors = itemErrors;
    Object.setPrototypeOf(this, CjPromotionValidationError.prototype);
  }
}

export interface CjPromotionItemInput {
  cjCatalogItemId: number;
  publicPrice?: number;
  compareAtPrice?: number;
}

export interface CjPromotionRequestInput {
  items: CjPromotionItemInput[];
  categoryId?: number;
  activate?: boolean;
}

// categoryId is intentionally NOT required here: a missing or non-existent
// category both surface as CjPromotionCategoryRequiredError (422) thrown by
// the service layer after a DB lookup, per the capability spec's literal
// wording ("a missing or invalid categoryId" -> the same error code). This
// validator only rejects structurally malformed input (400 ValidationError).
export function validateCjPromotionData(data: Record<string, unknown>): CjPromotionRequestInput {
  const rawItems = data['items'];
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ValidationError("Field 'items' is required and must be a non-empty array");
  }

  const items: CjPromotionItemInput[] = rawItems.map((rawItem, index) => {
    if (typeof rawItem !== 'object' || rawItem === null) {
      throw new ValidationError(`Item at index ${index} must be an object`);
    }
    const item = rawItem as Record<string, unknown>;
    const cjCatalogItemId = item['cjCatalogItemId'];
    if (typeof cjCatalogItemId !== 'number' || !Number.isInteger(cjCatalogItemId) || cjCatalogItemId <= 0) {
      throw new ValidationError(`Item at index ${index}: 'cjCatalogItemId' must be a positive integer`);
    }

    let publicPrice: number | undefined;
    if (item['publicPrice'] !== undefined) {
      const value = item['publicPrice'];
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new ValidationError(`Item at index ${index}: 'publicPrice' must be a positive number`);
      }
      publicPrice = value;
    }

    let compareAtPrice: number | undefined;
    if (item['compareAtPrice'] !== undefined) {
      const value = item['compareAtPrice'];
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new ValidationError(`Item at index ${index}: 'compareAtPrice' must be a positive number`);
      }
      compareAtPrice = value;
    }

    return { cjCatalogItemId, publicPrice, compareAtPrice };
  });

  const rawCategoryId = data['categoryId'];
  let categoryId: number | undefined;
  if (rawCategoryId !== undefined && rawCategoryId !== null) {
    if (typeof rawCategoryId !== 'number' || !Number.isInteger(rawCategoryId) || rawCategoryId <= 0) {
      throw new ValidationError("Field 'categoryId' must be a positive integer when provided");
    }
    categoryId = rawCategoryId;
  }

  let activate: boolean | undefined;
  if (data['activate'] !== undefined) {
    if (typeof data['activate'] !== 'boolean') {
      throw new ValidationError("Field 'activate' must be a boolean when provided");
    }
    activate = data['activate'];
  }

  return { items, categoryId, activate };
}
