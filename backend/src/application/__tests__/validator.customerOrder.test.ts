import {
  validateCustomerOrderCreateData,
  validateCustomerOrderStatusUpdate,
  OrderStatusTransitionInvalidError,
  FulfillmentStatusTransitionInvalidError,
  ValidationError,
} from '../validator';

const validAddress = {
  fullName: 'Jane Doe',
  phone: '+34600000000',
  streetLine1: 'Main St 1',
  city: 'Malaga',
  province: 'Malaga',
  postalCode: '29001',
  country: 'Spain',
};

describe('validateCustomerOrderCreateData', () => {
  it('accepts valid create payload', () => {
    expect(() =>
      validateCustomerOrderCreateData({
        customerId: 1,
        items: [{ productVariantId: 1, quantity: 2 }],
        shippingAddressSnapshot: validAddress,
        billingAddressSnapshot: validAddress,
      })
    ).not.toThrow();
  });

  it('rejects missing customerId', () => {
    expect(() =>
      validateCustomerOrderCreateData({
        items: [{ productVariantId: 1, quantity: 1 }],
        shippingAddressSnapshot: validAddress,
        billingAddressSnapshot: validAddress,
      })
    ).toThrow(ValidationError);
  });

  it('rejects empty items', () => {
    expect(() =>
      validateCustomerOrderCreateData({
        customerId: 1,
        items: [],
        shippingAddressSnapshot: validAddress,
        billingAddressSnapshot: validAddress,
      })
    ).toThrow(ValidationError);
  });

  it('rejects invalid quantity', () => {
    expect(() =>
      validateCustomerOrderCreateData({
        customerId: 1,
        items: [{ productVariantId: 1, quantity: 0 }],
        shippingAddressSnapshot: validAddress,
        billingAddressSnapshot: validAddress,
      })
    ).toThrow(ValidationError);
  });
});

describe('validateCustomerOrderStatusUpdate', () => {
  it('rejects paid order returning to PendingPayment', () => {
    expect(() =>
      validateCustomerOrderStatusUpdate(
        { status: 'Paid', paymentStatus: 'Paid', fulfillmentStatus: 'NotStarted' },
        { status: 'PendingPayment' }
      )
    ).toThrow(OrderStatusTransitionInvalidError);
  });

  it('rejects fulfillment advance on cancelled order', () => {
    expect(() =>
      validateCustomerOrderStatusUpdate(
        { status: 'Cancelled', paymentStatus: 'Pending', fulfillmentStatus: 'NotStarted' },
        { fulfillmentStatus: 'PendingSupplierOrder' }
      )
    ).toThrow(FulfillmentStatusTransitionInvalidError);
  });

  it('allows independent payment status update', () => {
    expect(() =>
      validateCustomerOrderStatusUpdate(
        { status: 'PendingPayment', paymentStatus: 'Pending', fulfillmentStatus: 'NotStarted' },
        { paymentStatus: 'Paid' }
      )
    ).not.toThrow();
  });
});
