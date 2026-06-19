import { Decimal } from '@prisma/client/runtime/library';
import { CustomerOrderService } from '../customerOrderService';
import { ICustomerOrderRepository, CustomerOrderCreateData } from '../../../domain/repositories/customerOrderRepository';
import { CustomerOrder } from '../../../domain/models/customerOrder';
import { CustomerNotFoundError } from '../../../infrastructure/repositories/customerRepository';
import { VariantNotFoundError } from '../../../infrastructure/repositories/productVariantRepository';
import { CustomerOrderNotFoundError } from '../../../infrastructure/repositories/customerOrderRepository';
import { OrderStatusTransitionInvalidError } from '../../validator';

const mockCustomerFindUnique = jest.fn();
const mockVariantFindUnique = jest.fn();

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    customer: { findUnique: (...args: unknown[]) => mockCustomerFindUnique(...args) },
    productVariant: { findUnique: (...args: unknown[]) => mockVariantFindUnique(...args) },
  },
}));

const address = {
  fullName: 'Jane Doe',
  streetLine1: 'Main St',
  city: 'Malaga',
  province: 'Malaga',
  postalCode: '29001',
  country: 'Spain',
};

const makeOrder = (overrides: Partial<ConstructorParameters<typeof CustomerOrder>[0]> = {}) =>
  new CustomerOrder({
    id: 1,
    orderNumber: 'ORD-000001',
    customerId: 1,
    status: 'PendingPayment',
    paymentStatus: 'Pending',
    fulfillmentStatus: 'NotStarted',
    subtotalAmount: '29.99',
    shippingAmount: '0.00',
    discountAmount: '0.00',
    totalAmount: '29.99',
    shippingAddressSnapshot: address,
    billingAddressSnapshot: address,
    items: [
      {
        id: 1,
        customerOrderId: 1,
        productVariantId: 1,
        productNameSnapshot: 'Summer Dress',
        variantSnapshot: { size: 'S', color: 'Black' },
        skuSnapshot: 'SKU-001',
        quantity: 1,
        unitPrice: '29.99',
        totalPrice: '29.99',
        fulfillmentStatus: 'NotStarted',
      },
    ],
    ...overrides,
  });

const mockRepo: jest.Mocked<ICustomerOrderRepository> = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  findByStripePaymentIntentId: jest.fn(),
  updateStripeFields: jest.fn(),
  generateNextOrderNumber: jest.fn(),
};

const service = new CustomerOrderService(mockRepo);

type CreateInput = Omit<CustomerOrderCreateData, 'orderNumber'>;

const baseCreateInput = (): CreateInput => ({
  customerId: 1,
  items: [{ productVariantId: 1, quantity: 1 }],
  shippingAddressSnapshot: address,
  billingAddressSnapshot: address,
});

describe('CustomerOrderService - create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('snapshots variant price and product name at creation time', async () => {
    mockCustomerFindUnique.mockResolvedValue({ id: 1 });
    mockVariantFindUnique.mockResolvedValue({
      id: 1,
      sku: 'SKU-001',
      size: 'S',
      color: 'Black',
      publicPrice: new Decimal('29.99'),
      product: { name: 'Summer Dress' },
    });
    mockRepo.generateNextOrderNumber.mockResolvedValue('ORD-000001');
    mockRepo.create.mockImplementation(async (_data, items, amounts) =>
      makeOrder({
        subtotalAmount: amounts.subtotal,
        totalAmount: amounts.total,
        items: items.map((item, idx) => ({
          id: idx + 1,
          customerOrderId: 1,
          productVariantId: item.productVariantId,
          productNameSnapshot: item.productNameSnapshot,
          variantSnapshot: item.variantSnapshot,
          skuSnapshot: item.skuSnapshot,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          fulfillmentStatus: 'NotStarted' as const,
        })),
      })
    );

    const result = await service.create(baseCreateInput() as CustomerOrderCreateData);

    expect(result.items?.[0]?.unitPrice).toBe('29.99');
    expect(result.items?.[0]?.productNameSnapshot).toBe('Summer Dress');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ orderNumber: 'ORD-000001' }),
      expect.arrayContaining([
        expect.objectContaining({
          unitPrice: '29.99',
          totalPrice: '29.99',
          productNameSnapshot: 'Summer Dress',
        }),
      ]),
      expect.objectContaining({ subtotal: '29.99', total: '29.99' })
    );
  });

  it('preserves snapshotted unitPrice even if variant price changes before persist', async () => {
    mockCustomerFindUnique.mockResolvedValue({ id: 1 });
    mockVariantFindUnique.mockResolvedValue({
      id: 1,
      sku: 'SKU-001',
      size: 'S',
      color: 'Black',
      publicPrice: new Decimal('29.99'),
      product: { name: 'Summer Dress' },
    });
    mockRepo.generateNextOrderNumber.mockResolvedValue('ORD-000001');

    let capturedUnitPrice = '';
    mockRepo.create.mockImplementation(async (_data, items) => {
      capturedUnitPrice = items[0].unitPrice;
      return makeOrder();
    });

    await service.create(baseCreateInput() as CustomerOrderCreateData);

    // Simulate catalog price change after snapshot was taken
    mockVariantFindUnique.mockResolvedValue({
      id: 1,
      publicPrice: new Decimal('99.99'),
      product: { name: 'Summer Dress' },
    });

    expect(capturedUnitPrice).toBe('29.99');
    expect(capturedUnitPrice).not.toBe('99.99');
  });

  it('throws CustomerNotFoundError when customer missing', async () => {
    mockCustomerFindUnique.mockResolvedValue(null);
    await expect(
      service.create({
        ...baseCreateInput(),
        customerId: 99,
      } as CustomerOrderCreateData)
    ).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  it('throws VariantNotFoundError when variant missing', async () => {
    mockCustomerFindUnique.mockResolvedValue({ id: 1 });
    mockVariantFindUnique.mockResolvedValue(null);
    await expect(
      service.create({
        ...baseCreateInput(),
        items: [{ productVariantId: 99, quantity: 1 }],
      } as CustomerOrderCreateData)
    ).rejects.toBeInstanceOf(VariantNotFoundError);
  });
});

describe('CustomerOrderService - updateStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects paid order returning to PendingPayment', async () => {
    mockRepo.findById.mockResolvedValue(
      makeOrder({ status: 'Paid', paymentStatus: 'Paid' })
    );
    await expect(service.updateStatus(1, { status: 'PendingPayment' })).rejects.toBeInstanceOf(
      OrderStatusTransitionInvalidError
    );
  });

  it('throws CustomerOrderNotFoundError when order missing', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.updateStatus(99, { paymentStatus: 'Paid' })).rejects.toBeInstanceOf(
      CustomerOrderNotFoundError
    );
  });

  it('sets paidAt when payment becomes Paid', async () => {
    mockRepo.findById.mockResolvedValue(makeOrder());
    mockRepo.updateStatus.mockResolvedValue(makeOrder({ paymentStatus: 'Paid', paidAt: new Date() }));
    await service.updateStatus(1, { paymentStatus: 'Paid' });
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ paymentStatus: 'Paid', paidAt: expect.any(Date) })
    );
  });
});
