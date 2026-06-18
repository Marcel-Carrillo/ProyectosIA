import { ValidationError, validateShipmentCreateData, validateShipmentStatusUpdate } from '../validator';

describe('validateShipmentCreateData', () => {
  it('passes for minimal valid data', () => {
    expect(() => validateShipmentCreateData({ customerOrderId: 1 })).not.toThrow();
  });

  it('throws when customerOrderId is missing', () => {
    expect(() => validateShipmentCreateData({})).toThrow(ValidationError);
  });

  it('throws when customerOrderId is not a positive integer', () => {
    expect(() => validateShipmentCreateData({ customerOrderId: 0 })).toThrow(ValidationError);
    expect(() => validateShipmentCreateData({ customerOrderId: 'abc' })).toThrow(ValidationError);
  });

  it('throws when supplierOrderId is invalid', () => {
    expect(() =>
      validateShipmentCreateData({ customerOrderId: 1, supplierOrderId: -5 })
    ).toThrow(ValidationError);
  });

  it('throws when carrier exceeds 100 chars', () => {
    expect(() =>
      validateShipmentCreateData({ customerOrderId: 1, carrier: 'a'.repeat(101) })
    ).toThrow(ValidationError);
  });

  it('throws when trackingNumber exceeds 100 chars', () => {
    expect(() =>
      validateShipmentCreateData({ customerOrderId: 1, trackingNumber: 'x'.repeat(101) })
    ).toThrow(ValidationError);
  });

  it('throws when trackingUrl exceeds 500 chars', () => {
    expect(() =>
      validateShipmentCreateData({ customerOrderId: 1, trackingUrl: 'u'.repeat(501) })
    ).toThrow(ValidationError);
  });

  it('passes with all optional fields valid', () => {
    expect(() =>
      validateShipmentCreateData({
        customerOrderId: 1,
        supplierOrderId: 2,
        carrier: 'DHL',
        trackingNumber: 'TRK123',
        trackingUrl: 'https://example.com/track/TRK123',
      })
    ).not.toThrow();
  });
});

describe('validateShipmentStatusUpdate', () => {
  it('passes for each valid status', () => {
    const valid = ['Pending', 'Shipped', 'InTransit', 'Delivered', 'Failed', 'Returned'];
    for (const status of valid) {
      expect(() => validateShipmentStatusUpdate({ status })).not.toThrow();
    }
  });

  it('throws when status is missing', () => {
    expect(() => validateShipmentStatusUpdate({})).toThrow(ValidationError);
  });

  it('throws for invalid status', () => {
    expect(() => validateShipmentStatusUpdate({ status: 'Unknown' })).toThrow(ValidationError);
  });
});
