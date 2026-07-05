import {
  validatePendingOrderPayable,
  validatePendingOrderCancellable,
  OrderNotPayableError,
  OrderNotCancellableError,
} from '../validator';

describe('validatePendingOrderPayable', () => {
  it('passes when status is PendingPayment and paymentStatus is Pending', () => {
    expect(() =>
      validatePendingOrderPayable({ status: 'PendingPayment', paymentStatus: 'Pending' })
    ).not.toThrow();
  });

  it('passes when status is PendingPayment and paymentStatus is Failed', () => {
    expect(() =>
      validatePendingOrderPayable({ status: 'PendingPayment', paymentStatus: 'Failed' })
    ).not.toThrow();
  });

  it('throws OrderNotPayableError when paymentStatus is Paid', () => {
    expect(() =>
      validatePendingOrderPayable({ status: 'PendingPayment', paymentStatus: 'Paid' })
    ).toThrow(OrderNotPayableError);
  });

  it.each(['Paid', 'Processing', 'Completed', 'Cancelled', 'Refunded'])(
    'throws OrderNotPayableError when status is %s',
    (status) => {
      expect(() => validatePendingOrderPayable({ status, paymentStatus: 'Pending' })).toThrow(
        OrderNotPayableError
      );
    }
  );

  it('throws an error with code ORDER_NOT_PAYABLE and status 409', () => {
    try {
      validatePendingOrderPayable({ status: 'Paid', paymentStatus: 'Paid' });
      fail('expected validatePendingOrderPayable to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(OrderNotPayableError);
      expect((err as OrderNotPayableError).code).toBe('ORDER_NOT_PAYABLE');
      expect((err as OrderNotPayableError).status).toBe(409);
    }
  });
});

describe('validatePendingOrderCancellable', () => {
  it('passes when status is PendingPayment', () => {
    expect(() => validatePendingOrderCancellable({ status: 'PendingPayment' })).not.toThrow();
  });

  it('passes idempotently when status is already Cancelled', () => {
    expect(() => validatePendingOrderCancellable({ status: 'Cancelled' })).not.toThrow();
  });

  it.each(['Paid', 'Processing', 'Completed', 'Refunded'])(
    'throws OrderNotCancellableError when status is %s',
    (status) => {
      expect(() => validatePendingOrderCancellable({ status })).toThrow(OrderNotCancellableError);
    }
  );

  it('throws an error with code ORDER_NOT_CANCELLABLE and status 409', () => {
    try {
      validatePendingOrderCancellable({ status: 'Paid' });
      fail('expected validatePendingOrderCancellable to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(OrderNotCancellableError);
      expect((err as OrderNotCancellableError).code).toBe('ORDER_NOT_CANCELLABLE');
      expect((err as OrderNotCancellableError).status).toBe(409);
    }
  });
});
