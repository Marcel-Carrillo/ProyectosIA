import {
  deriveShippingStatus,
  toPublicShipment,
  toPublicOrder,
} from '../customerAccountController';

const address = {
  fullName: 'Jane Doe',
  streetLine1: 'Main St',
  city: 'Malaga',
  province: 'Malaga',
  postalCode: '29001',
  country: 'Spain',
};

const baseOrder = {
  id: 1,
  orderNumber: 'ORD-000001',
  customerId: 1,
  status: 'Paid',
  paymentStatus: 'Paid',
  subtotalAmount: '29.99',
  shippingAmount: '0.00',
  discountAmount: '0.00',
  totalAmount: '29.99',
  currency: 'EUR',
  shippingAddressSnapshot: address,
  billingAddressSnapshot: address,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('customerAccountController - deriveShippingStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return Preparing when shipments array is empty', () => {
    expect(deriveShippingStatus([])).toBe('Preparing');
  });

  it('should return Preparing when every shipment is Pending', () => {
    expect(deriveShippingStatus([{ status: 'Pending' }, { status: 'Pending' }])).toBe('Preparing');
  });

  it('should return Problem when any shipment is Failed, regardless of other statuses', () => {
    expect(deriveShippingStatus([{ status: 'Delivered' }, { status: 'Failed' }])).toBe('Problem');
  });

  it('should return Problem when any shipment is Returned, regardless of other statuses', () => {
    expect(deriveShippingStatus([{ status: 'Shipped' }, { status: 'Returned' }])).toBe('Problem');
  });

  it('should return Delivered when every shipment is Delivered and array is non-empty', () => {
    expect(deriveShippingStatus([{ status: 'Delivered' }, { status: 'Delivered' }])).toBe('Delivered');
  });

  it('should return InTransit when any shipment is InTransit and not all Delivered', () => {
    expect(deriveShippingStatus([{ status: 'Pending' }, { status: 'InTransit' }])).toBe('InTransit');
    expect(deriveShippingStatus([{ status: 'InTransit' }, { status: 'Delivered' }])).toBe('InTransit');
  });

  it('should return Shipped when any shipment is Shipped and none InTransit/Problem, not all Delivered', () => {
    expect(deriveShippingStatus([{ status: 'Pending' }, { status: 'Shipped' }])).toBe('Shipped');
    expect(deriveShippingStatus([{ status: 'Shipped' }, { status: 'Delivered' }])).toBe('Shipped');
  });

  it('should prioritize InTransit over Shipped when both are present', () => {
    expect(deriveShippingStatus([{ status: 'Shipped' }, { status: 'InTransit' }])).toBe('InTransit');
  });

  it('should fall back to Preparing for a mixed state matching no other rule', () => {
    expect(deriveShippingStatus([{ status: 'Pending' }, { status: 'Delivered' }])).toBe('Preparing');
  });
});

describe('customerAccountController - toPublicShipment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should expose only the customer-safe allow-list of fields', () => {
    const result = toPublicShipment({
      status: 'Shipped',
      carrier: 'DHL',
      trackingNumber: 'X1',
      trackingUrl: 'https://t',
      shippedAt: new Date(),
      deliveredAt: null,
    });
    expect(Object.keys(result).sort()).toEqual(
      ['carrier', 'deliveredAt', 'shippedAt', 'status', 'trackingNumber', 'trackingUrl'].sort()
    );
  });

  it('should never emit supplierOrderId, supplierOrder, id, or customerOrderId even when present on the input', () => {
    const fixture = {
      id: 1,
      customerOrderId: 5,
      supplierOrderId: 99,
      supplierOrder: { id: 99, status: 'Draft' },
      status: 'Shipped',
      carrier: 'DHL',
      trackingNumber: 'X1',
      trackingUrl: 'https://t',
      shippedAt: new Date(),
      deliveredAt: null,
    };
    const result = toPublicShipment(fixture);
    const json = JSON.stringify(result);
    expect(json).not.toContain('supplierOrderId');
    expect(json).not.toContain('supplierOrder');
    expect(json).not.toContain('customerOrderId');
  });
});

describe('customerAccountController - toPublicOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should not include fulfillmentStatus at the order level even if present on the input row', () => {
    const order = { ...baseOrder, fulfillmentStatus: 'Blocked' };
    const result = toPublicOrder(order);
    expect('fulfillmentStatus' in result).toBe(false);
  });

  it('should not include fulfillmentStatus on any item even if present on the input row', () => {
    const order = {
      ...baseOrder,
      items: [
        {
          id: 1,
          productVariantId: 1,
          productNameSnapshot: 'Dress',
          variantSnapshot: {},
          skuSnapshot: 'SKU-1',
          quantity: 1,
          unitPrice: '10.00',
          totalPrice: '10.00',
          fulfillmentStatus: 'Fulfilled',
        },
      ],
    };
    const result = toPublicOrder(order);
    expect(result.items?.[0] && 'fulfillmentStatus' in result.items[0]).toBe(false);
  });

  it('should always include shippingStatus derived from the order shipments', () => {
    const order = { ...baseOrder, shipments: [{ status: 'Shipped', carrier: null, trackingNumber: null, trackingUrl: null, shippedAt: null, deliveredAt: null }] };
    const result = toPublicOrder(order);
    expect(result.shippingStatus).toBe('Shipped');
  });

  it('should include shippingStatus as Preparing when order.shipments is undefined', () => {
    const result = toPublicOrder(baseOrder);
    expect(result.shippingStatus).toBe('Preparing');
  });

  it('should include a shipments array by default (detail shape)', () => {
    const order = { ...baseOrder, shipments: [{ status: 'Shipped', carrier: 'DHL', trackingNumber: 'X1', trackingUrl: 'https://t', shippedAt: new Date(), deliveredAt: null }] };
    const result = toPublicOrder(order);
    expect(Array.isArray(result.shipments)).toBe(true);
    expect(Object.keys(result.shipments![0]).sort()).toEqual(
      ['carrier', 'deliveredAt', 'shippedAt', 'status', 'trackingNumber', 'trackingUrl'].sort()
    );
  });

  it('should omit the shipments array when includeShipments is false (list shape)', () => {
    const result = toPublicOrder(baseOrder, { includeShipments: false });
    expect('shipments' in result).toBe(false);
  });

  it('should never leak supplierOrderId/supplierOrder through toPublicOrder shipments mapping', () => {
    const order = {
      ...baseOrder,
      shipments: [
        {
          status: 'Shipped',
          carrier: 'DHL',
          trackingNumber: 'X1',
          trackingUrl: 'https://t',
          shippedAt: new Date(),
          deliveredAt: null,
          supplierOrderId: 42,
        },
      ],
    };
    const json = JSON.stringify(toPublicOrder(order));
    expect(json).not.toContain('supplierOrderId');
    expect(json).not.toContain('supplierOrder');
  });
});
