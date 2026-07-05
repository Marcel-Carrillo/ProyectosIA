import { Decimal } from '@prisma/client/runtime/library';
import { CustomerOrderService } from '../customerOrderService';
import { ICustomerOrderRepository, CustomerOrderCreateData } from '../../../domain/repositories/customerOrderRepository';
import { CustomerOrder } from '../../../domain/models/customerOrder';
import { CustomerNotFoundError } from '../../../infrastructure/repositories/customerRepository';
import { VariantNotFoundError } from '../../../infrastructure/repositories/productVariantRepository';
import { CustomerOrderNotFoundError } from '../../../infrastructure/repositories/customerOrderRepository';
import {
  OrderStatusTransitionInvalidError,
  OrderNotPayableError,
  OrderNotCancellableError,
  PaymentGatewayUnavailableError,
  PaymentIntentAlreadyCapturedError,
} from '../../validator';

const mockCustomerFindUnique = jest.fn();
const mockVariantFindUnique = jest.fn();
const mockOrderFindUnique = jest.fn();
const mockOrderUpdate = jest.fn();

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    customer: { findUnique: (...args: unknown[]) => mockCustomerFindUnique(...args) },
    productVariant: { findUnique: (...args: unknown[]) => mockVariantFindUnique(...args) },
    customerOrder: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
      update: (...args: unknown[]) => mockOrderUpdate(...args),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        customerOrder: {
          findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
          update: (...args: unknown[]) => mockOrderUpdate(...args),
        },
      })
    ),
  },
}));

const mockResumePaymentIntent = jest.fn();
const mockCancelPaymentIntent = jest.fn();

jest.mock('../paymentService', () => ({
  paymentService: {
    resumePaymentIntent: (...args: unknown[]) => mockResumePaymentIntent(...args),
    cancelPaymentIntent: (...args: unknown[]) => mockCancelPaymentIntent(...args),
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

describe('CustomerOrderService - getOrCreatePaymentSession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns clientSecret without persisting when PaymentIntent was reused', async () => {
    const order = makeOrder({ customerId: 1, status: 'PendingPayment', paymentStatus: 'Pending' });
    mockRepo.findById.mockResolvedValue(order);
    mockResumePaymentIntent.mockResolvedValue({
      clientSecret: 'cs_1',
      stripePaymentIntentId: 'pi_1',
      reused: true,
    });

    const result = await service.getOrCreatePaymentSession(1, 1);

    expect(result.clientSecret).toBe('cs_1');
    expect(mockRepo.updateStripeFields).not.toHaveBeenCalled();
  });

  it('persists new stripePaymentIntentId when PaymentIntent was reissued', async () => {
    const order = makeOrder({ customerId: 1, status: 'PendingPayment', paymentStatus: 'Pending' });
    mockRepo.findById.mockResolvedValue(order);
    mockResumePaymentIntent.mockResolvedValue({
      clientSecret: 'cs_2',
      stripePaymentIntentId: 'pi_2',
      reused: false,
    });

    await service.getOrCreatePaymentSession(1, 1);

    expect(mockRepo.updateStripeFields).toHaveBeenCalledWith(1, { stripePaymentIntentId: 'pi_2' });
  });

  it('throws CustomerOrderNotFoundError when order does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.getOrCreatePaymentSession(1, 999)).rejects.toBeInstanceOf(
      CustomerOrderNotFoundError
    );
  });

  it('throws CustomerOrderNotFoundError when order belongs to another customer', async () => {
    mockRepo.findById.mockResolvedValue(makeOrder({ customerId: 2 }));
    await expect(service.getOrCreatePaymentSession(1, 1)).rejects.toBeInstanceOf(
      CustomerOrderNotFoundError
    );
  });

  it('throws OrderNotPayableError when order status is not PendingPayment', async () => {
    mockRepo.findById.mockResolvedValue(makeOrder({ customerId: 1, status: 'Paid', paymentStatus: 'Paid' }));
    await expect(service.getOrCreatePaymentSession(1, 1)).rejects.toBeInstanceOf(OrderNotPayableError);
  });

  it('throws OrderNotPayableError when paymentStatus is Paid', async () => {
    mockRepo.findById.mockResolvedValue(
      makeOrder({ customerId: 1, status: 'PendingPayment', paymentStatus: 'Paid' })
    );
    await expect(service.getOrCreatePaymentSession(1, 1)).rejects.toBeInstanceOf(OrderNotPayableError);
  });

  it('propagates PaymentGatewayUnavailableError from resumePaymentIntent', async () => {
    mockRepo.findById.mockResolvedValue(
      makeOrder({ customerId: 1, status: 'PendingPayment', paymentStatus: 'Pending' })
    );
    mockResumePaymentIntent.mockRejectedValue(new PaymentGatewayUnavailableError());
    await expect(service.getOrCreatePaymentSession(1, 1)).rejects.toBeInstanceOf(
      PaymentGatewayUnavailableError
    );
  });
});

describe('CustomerOrderService - cancelPendingOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cancels a pending order and cancels its PaymentIntent', async () => {
    const order = makeOrder({
      customerId: 1,
      status: 'PendingPayment',
      paymentStatus: 'Pending',
      stripePaymentIntentId: 'pi_1',
    });
    mockRepo.findById
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce(makeOrder({ customerId: 1, status: 'Cancelled', fulfillmentStatus: 'Cancelled' }));
    mockOrderFindUnique.mockResolvedValue({ status: 'PendingPayment', paymentStatus: 'Pending' });
    mockOrderUpdate.mockResolvedValue({});
    mockCancelPaymentIntent.mockResolvedValue(undefined);

    const result = await service.cancelPendingOrder(1, 1);

    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'Cancelled', fulfillmentStatus: 'Cancelled' }),
      })
    );
    expect(mockCancelPaymentIntent).toHaveBeenCalledWith('pi_1');
    expect(result.status).toBe('Cancelled');
  });

  it('does not call Stripe when order has no stripePaymentIntentId', async () => {
    const order = makeOrder({
      customerId: 1,
      status: 'PendingPayment',
      paymentStatus: 'Pending',
      stripePaymentIntentId: null,
    });
    mockRepo.findById.mockResolvedValueOnce(order).mockResolvedValueOnce(order);
    mockOrderFindUnique.mockResolvedValue({ status: 'PendingPayment', paymentStatus: 'Pending' });
    mockOrderUpdate.mockResolvedValue({});

    await service.cancelPendingOrder(1, 1);

    expect(mockCancelPaymentIntent).not.toHaveBeenCalled();
  });

  it('is idempotent when order is already Cancelled', async () => {
    const order = makeOrder({ customerId: 1, status: 'Cancelled' });
    mockRepo.findById.mockResolvedValue(order);

    const result = await service.cancelPendingOrder(1, 1);

    expect(result).toBe(order);
    expect(mockOrderUpdate).not.toHaveBeenCalled();
    expect(mockCancelPaymentIntent).not.toHaveBeenCalled();
  });

  it('throws CustomerOrderNotFoundError for non-existent order', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.cancelPendingOrder(1, 999)).rejects.toBeInstanceOf(CustomerOrderNotFoundError);
  });

  it('throws CustomerOrderNotFoundError for another customer order', async () => {
    mockRepo.findById.mockResolvedValue(makeOrder({ customerId: 2, status: 'PendingPayment' }));
    await expect(service.cancelPendingOrder(1, 1)).rejects.toBeInstanceOf(CustomerOrderNotFoundError);
  });

  it('throws OrderNotCancellableError when outer status is not cancellable', async () => {
    mockRepo.findById.mockResolvedValue(
      makeOrder({ customerId: 1, status: 'Paid', paymentStatus: 'Paid' })
    );
    await expect(service.cancelPendingOrder(1, 1)).rejects.toBeInstanceOf(OrderNotCancellableError);
    expect(mockOrderFindUnique).not.toHaveBeenCalled();
  });

  it('throws OrderNotCancellableError when the webhook wins the race inside the transaction', async () => {
    const order = makeOrder({ customerId: 1, status: 'PendingPayment', paymentStatus: 'Pending' });
    mockRepo.findById.mockResolvedValue(order);
    mockOrderFindUnique.mockResolvedValue({ status: 'Paid', paymentStatus: 'Paid' });

    await expect(service.cancelPendingOrder(1, 1)).rejects.toBeInstanceOf(OrderNotCancellableError);
    expect(mockOrderUpdate).not.toHaveBeenCalled();
    expect(mockCancelPaymentIntent).not.toHaveBeenCalled();
  });

  it('rolls back to prior status when Stripe reports the PaymentIntent already captured', async () => {
    const order = makeOrder({
      customerId: 1,
      status: 'PendingPayment',
      fulfillmentStatus: 'NotStarted',
      paymentStatus: 'Pending',
      stripePaymentIntentId: 'pi_1',
    });
    mockRepo.findById.mockResolvedValueOnce(order).mockResolvedValueOnce(order);
    mockOrderFindUnique.mockResolvedValue({ status: 'PendingPayment', paymentStatus: 'Pending' });
    mockOrderUpdate.mockResolvedValue({});
    mockCancelPaymentIntent.mockRejectedValue(new PaymentIntentAlreadyCapturedError());

    await expect(service.cancelPendingOrder(1, 1)).rejects.toBeInstanceOf(OrderNotCancellableError);

    expect(mockOrderUpdate).toHaveBeenCalledTimes(2);
    expect(mockOrderUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PendingPayment',
          fulfillmentStatus: 'NotStarted',
          cancelledAt: null,
        }),
      })
    );
  });

  it('rolls back and preserves the original error on a generic Stripe failure', async () => {
    const order = makeOrder({
      customerId: 1,
      status: 'PendingPayment',
      fulfillmentStatus: 'NotStarted',
      paymentStatus: 'Pending',
      stripePaymentIntentId: 'pi_1',
    });
    mockRepo.findById.mockResolvedValueOnce(order).mockResolvedValueOnce(order);
    mockOrderFindUnique.mockResolvedValue({ status: 'PendingPayment', paymentStatus: 'Pending' });
    mockOrderUpdate.mockResolvedValue({});
    mockCancelPaymentIntent.mockRejectedValue(new PaymentGatewayUnavailableError());

    await expect(service.cancelPendingOrder(1, 1)).rejects.toBeInstanceOf(
      PaymentGatewayUnavailableError
    );

    expect(mockOrderUpdate).toHaveBeenCalledTimes(2);
  });
});
