import {
  validateSupplierOrderCreateData,
  validateSupplierOrderStatusUpdate,
  validateCustomerOrderEligibleForSupplierOrder,
  SupplierOrderStatusTransitionInvalidError,
  CustomerOrderNotEligibleError,
  ValidationError,
} from '../validator';

describe('validateSupplierOrderCreateData', () => {
  it('accepts valid create payload', () => {
    expect(() =>
      validateSupplierOrderCreateData({
        customerOrderId: 1,
        supplierId: 1,
        items: [
          {
            customerOrderItemId: 1,
            productVariantId: 1,
            quantity: 2,
            supplierCost: 10.5,
          },
        ],
      })
    ).not.toThrow();
  });

  it('rejects invalid supplierCost', () => {
    expect(() =>
      validateSupplierOrderCreateData({
        customerOrderId: 1,
        supplierId: 1,
        items: [
          {
            customerOrderItemId: 1,
            productVariantId: 1,
            quantity: 1,
            supplierCost: -1,
          },
        ],
      })
    ).toThrow(ValidationError);
  });
});

describe('validateSupplierOrderStatusUpdate', () => {
  it('allows Draft to Requested', () => {
    expect(() =>
      validateSupplierOrderStatusUpdate('Draft', { status: 'Requested' })
    ).not.toThrow();
  });

  it('rejects Delivered to Draft', () => {
    expect(() =>
      validateSupplierOrderStatusUpdate('Delivered', { status: 'Draft' })
    ).toThrow(SupplierOrderStatusTransitionInvalidError);
  });
});

describe('validateCustomerOrderEligibleForSupplierOrder', () => {
  it('accepts Paid', () => {
    expect(() => validateCustomerOrderEligibleForSupplierOrder('Paid')).not.toThrow();
  });

  it('rejects PendingPayment', () => {
    expect(() => validateCustomerOrderEligibleForSupplierOrder('PendingPayment')).toThrow(
      CustomerOrderNotEligibleError
    );
  });

  it('rejects Cancelled', () => {
    expect(() => validateCustomerOrderEligibleForSupplierOrder('Cancelled')).toThrow(
      CustomerOrderNotEligibleError
    );
  });
});
