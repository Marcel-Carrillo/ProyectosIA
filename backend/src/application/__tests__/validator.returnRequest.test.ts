import {
  ValidationError,
  validateReturnRequestCreateData,
  validateReturnRequestStatusUpdate,
} from '../validator';

describe('validateReturnRequestCreateData', () => {
  it('passes for minimal valid data', () => {
    expect(() =>
      validateReturnRequestCreateData({ customerOrderId: 1, customerOrderItemId: 2, reason: 'Damaged' })
    ).not.toThrow();
  });

  it('throws when customerOrderId is missing', () => {
    expect(() =>
      validateReturnRequestCreateData({ customerOrderItemId: 2, reason: 'Damaged' })
    ).toThrow(ValidationError);
  });

  it('throws when customerOrderId is 0', () => {
    expect(() =>
      validateReturnRequestCreateData({ customerOrderId: 0, customerOrderItemId: 2, reason: 'Damaged' })
    ).toThrow(ValidationError);
  });

  it('throws when customerOrderId is negative', () => {
    expect(() =>
      validateReturnRequestCreateData({ customerOrderId: -1, customerOrderItemId: 2, reason: 'Damaged' })
    ).toThrow(ValidationError);
  });

  it('throws when customerOrderId is a string', () => {
    expect(() =>
      validateReturnRequestCreateData({ customerOrderId: 'abc', customerOrderItemId: 2, reason: 'Damaged' })
    ).toThrow(ValidationError);
  });

  it('throws when customerOrderItemId is missing', () => {
    expect(() =>
      validateReturnRequestCreateData({ customerOrderId: 1, reason: 'Damaged' })
    ).toThrow(ValidationError);
  });

  it('throws when customerOrderItemId is not a positive integer', () => {
    expect(() =>
      validateReturnRequestCreateData({ customerOrderId: 1, customerOrderItemId: 0, reason: 'Damaged' })
    ).toThrow(ValidationError);
  });

  it('throws when reason is missing', () => {
    expect(() =>
      validateReturnRequestCreateData({ customerOrderId: 1, customerOrderItemId: 2 })
    ).toThrow(ValidationError);
  });

  it('throws when reason is empty string', () => {
    expect(() =>
      validateReturnRequestCreateData({ customerOrderId: 1, customerOrderItemId: 2, reason: '' })
    ).toThrow(ValidationError);
  });

  it('throws when reason exceeds 500 characters', () => {
    expect(() =>
      validateReturnRequestCreateData({ customerOrderId: 1, customerOrderItemId: 2, reason: 'x'.repeat(501) })
    ).toThrow(ValidationError);
  });

  it('passes with reason exactly 500 characters', () => {
    expect(() =>
      validateReturnRequestCreateData({ customerOrderId: 1, customerOrderItemId: 2, reason: 'x'.repeat(500) })
    ).not.toThrow();
  });
});

describe('validateReturnRequestStatusUpdate', () => {
  const validStatuses = ['Requested', 'Approved', 'Rejected', 'Received', 'Refunded', 'Cancelled'];

  it.each(validStatuses)('passes for valid status "%s"', (status) => {
    expect(() => validateReturnRequestStatusUpdate({ status })).not.toThrow();
  });

  it('throws when status is missing', () => {
    expect(() => validateReturnRequestStatusUpdate({})).toThrow(ValidationError);
  });

  it('throws when status is empty string', () => {
    expect(() => validateReturnRequestStatusUpdate({ status: '' })).toThrow(ValidationError);
  });

  it('throws for an invalid status value', () => {
    expect(() => validateReturnRequestStatusUpdate({ status: 'Processing' })).toThrow(ValidationError);
  });

  it('throws for an unknown value', () => {
    expect(() => validateReturnRequestStatusUpdate({ status: 'Unknown' })).toThrow(ValidationError);
  });
});
