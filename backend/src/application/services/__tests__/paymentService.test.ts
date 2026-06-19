import { PaymentService } from '../paymentService';
import {
  PaymentGatewayUnavailableError,
  PaymentWebhookSignatureInvalidError,
} from '../../validator';
import { CustomerOrder } from '../../../domain/models/customerOrder';
import { StripeWebhookEvent } from '../../../domain/models/stripeWebhookEvent';

const address = {
  fullName: 'Test User',
  streetLine1: 'Main St',
  city: 'Malaga',
  province: 'Malaga',
  postalCode: '29001',
  country: 'Spain',
};

const mockCreatePI = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('../../../infrastructure/stripe/stripeClient', () => ({
  stripe: {
    paymentIntents: { create: (...args: unknown[]) => mockCreatePI(...args) },
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
  },
}));

const mockOrderUpdate = jest.fn();
const mockOrderFindUnique = jest.fn();
const mockRefundFindFirst = jest.fn();
const mockRefundFindMany = jest.fn();
const mockRefundUpdate = jest.fn();

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    customerOrder: {
      update: (...args: unknown[]) => mockOrderUpdate(...args),
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
    },
    refund: {
      findFirst: (...args: unknown[]) => mockRefundFindFirst(...args),
      findMany: (...args: unknown[]) => mockRefundFindMany(...args),
      update: (...args: unknown[]) => mockRefundUpdate(...args),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        refund: {
          update: mockRefundUpdate,
          findMany: mockRefundFindMany,
        },
        customerOrder: {
          update: mockOrderUpdate,
          findUnique: mockOrderFindUnique,
        },
      };
      return cb(tx);
    }),
  },
}));

jest.mock('../../../infrastructure/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const makeOrder = (overrides: Partial<ConstructorParameters<typeof CustomerOrder>[0]> = {}) =>
  new CustomerOrder({
    id: 1,
    orderNumber: 'ORD-000001',
    customerId: 1,
    totalAmount: '29.99',
    currency: 'EUR',
    shippingAddressSnapshot: address,
    billingAddressSnapshot: address,
    subtotalAmount: '29.99',
    shippingAmount: '0.00',
    discountAmount: '0.00',
    ...overrides,
  });

const mockOrderRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  findByStripePaymentIntentId: jest.fn(),
  updateStripeFields: jest.fn(),
  generateNextOrderNumber: jest.fn(),
};

const mockWebhookEventRepo = {
  findByStripeEventId: jest.fn(),
  create: jest.fn(),
};

const service = new PaymentService(mockOrderRepo, mockWebhookEventRepo);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_abc';
  process.env.STRIPE_MODE = 'test';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
});

describe('getConfig', () => {
  it('returns publishableKey and mode from env', () => {
    const config = service.getConfig();
    expect(config.publishableKey).toBe('pk_test_abc');
    expect(config.mode).toBe('test');
  });

  it('does not include secret key', () => {
    const config = service.getConfig();
    const json = JSON.stringify(config);
    expect(json).not.toContain('sk_');
  });
});

describe('createPaymentIntent', () => {
  it('returns clientSecret and stripePaymentIntentId on success', async () => {
    mockCreatePI.mockResolvedValue({ id: 'pi_123', client_secret: 'pi_123_secret' });
    const result = await service.createPaymentIntent(makeOrder());
    expect(result.clientSecret).toBe('pi_123_secret');
    expect(result.stripePaymentIntentId).toBe('pi_123');
  });

  it('throws PaymentGatewayUnavailableError when Stripe throws', async () => {
    mockCreatePI.mockRejectedValue(new Error('Network error'));
    await expect(service.createPaymentIntent(makeOrder())).rejects.toThrow(
      PaymentGatewayUnavailableError
    );
  });

  it('throws PaymentGatewayUnavailableError when intent.client_secret is null', async () => {
    mockCreatePI.mockResolvedValue({ id: 'pi_123', client_secret: null });
    await expect(service.createPaymentIntent(makeOrder())).rejects.toThrow(
      PaymentGatewayUnavailableError
    );
  });

  it('uses correct idempotency key format', async () => {
    mockCreatePI.mockResolvedValue({ id: 'pi_123', client_secret: 'secret' });
    await service.createPaymentIntent(makeOrder({ id: 42, orderNumber: 'ORD-000042' }));
    expect(mockCreatePI).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: 'order:42:pi' })
    );
  });

  it('calls Stripe with correct amount in minor units', async () => {
    mockCreatePI.mockResolvedValue({ id: 'pi_123', client_secret: 'secret' });
    await service.createPaymentIntent(makeOrder({ totalAmount: '29.99' }));
    expect(mockCreatePI).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2999, currency: 'eur' }),
      expect.anything()
    );
  });
});

describe('handleWebhookEvent', () => {
  const rawBody = Buffer.from('{}');
  const signature = 'sig_test';

  it('throws PaymentWebhookSignatureInvalidError on bad signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    await expect(service.handleWebhookEvent(rawBody, signature)).rejects.toThrow(
      PaymentWebhookSignatureInvalidError
    );
  });

  it('returns early (no-op) if event already processed', async () => {
    mockConstructEvent.mockReturnValue({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: {} } });
    mockWebhookEventRepo.findByStripeEventId.mockResolvedValue(new StripeWebhookEvent({ stripeEventId: 'evt_1', type: 'payment_intent.succeeded' }));
    await service.handleWebhookEvent(rawBody, signature);
    expect(mockWebhookEventRepo.create).not.toHaveBeenCalled();
  });

  it('persists event after processing', async () => {
    mockConstructEvent.mockReturnValue({ id: 'evt_new', type: 'unknown.type', data: { object: {} } });
    mockWebhookEventRepo.findByStripeEventId.mockResolvedValue(null);
    mockWebhookEventRepo.create.mockResolvedValue({});
    await service.handleWebhookEvent(rawBody, signature);
    expect(mockWebhookEventRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ stripeEventId: 'evt_new', type: 'unknown.type' })
    );
  });

  it('does not throw if handler throws (swallows error, still persists event)', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_err',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_x', latest_charge: null } },
    });
    mockWebhookEventRepo.findByStripeEventId.mockResolvedValue(null);
    mockOrderRepo.findByStripePaymentIntentId.mockRejectedValue(new Error('DB error'));
    mockWebhookEventRepo.create.mockResolvedValue({});
    await expect(service.handleWebhookEvent(rawBody, signature)).resolves.not.toThrow();
    expect(mockWebhookEventRepo.create).toHaveBeenCalled();
  });
});

describe('handlePaymentIntentSucceeded (via webhook)', () => {
  const makeEvent = (intentId: string, latestCharge: string | null = 'ch_123') => ({
    id: 'evt_1',
    type: 'payment_intent.succeeded',
    data: { object: { id: intentId, latest_charge: latestCharge } },
  });

  beforeEach(() => {
    mockWebhookEventRepo.findByStripeEventId.mockResolvedValue(null);
    mockWebhookEventRepo.create.mockResolvedValue({});
  });

  it('sets status=Paid, paymentStatus=Paid, paidAt for PendingPayment order', async () => {
    mockConstructEvent.mockReturnValue(makeEvent('pi_123', 'ch_123'));
    mockOrderRepo.findByStripePaymentIntentId.mockResolvedValue(makeOrder());
    mockOrderUpdate.mockResolvedValue({});
    await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'Paid', paymentStatus: 'Paid' }),
      })
    );
  });

  it('is a no-op if order already Paid', async () => {
    mockConstructEvent.mockReturnValue(makeEvent('pi_123'));
    mockOrderRepo.findByStripePaymentIntentId.mockResolvedValue(makeOrder({ paymentStatus: 'Paid' }));
    await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it('logs warning and returns if order not found', async () => {
    mockConstructEvent.mockReturnValue(makeEvent('pi_notfound'));
    mockOrderRepo.findByStripePaymentIntentId.mockResolvedValue(null);
    await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it('stores stripeChargeId from intent.latest_charge (string form)', async () => {
    mockConstructEvent.mockReturnValue(makeEvent('pi_123', 'ch_abc'));
    mockOrderRepo.findByStripePaymentIntentId.mockResolvedValue(makeOrder());
    mockOrderUpdate.mockResolvedValue({});
    await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stripeChargeId: 'ch_abc' }),
      })
    );
  });
});

describe('handlePaymentIntentFailed (via webhook)', () => {
  beforeEach(() => {
    mockWebhookEventRepo.findByStripeEventId.mockResolvedValue(null);
    mockWebhookEventRepo.create.mockResolvedValue({});
  });

  it('sets paymentStatus=Failed', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_f',
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_fail' } },
    });
    mockOrderRepo.findByStripePaymentIntentId.mockResolvedValue(makeOrder());
    mockOrderUpdate.mockResolvedValue({});
    await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentStatus: 'Failed' }) })
    );
  });

  it('logs warning and returns if order not found', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_f2',
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_notfound' } },
    });
    mockOrderRepo.findByStripePaymentIntentId.mockResolvedValue(null);
    await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });
});

describe('handleChargeRefunded (via webhook)', () => {
  const makeChargeEvent = (refundId: string) => ({
    id: 'evt_r',
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_123',
        refunds: { data: [{ id: refundId }] },
      },
    },
  });

  beforeEach(() => {
    mockWebhookEventRepo.findByStripeEventId.mockResolvedValue(null);
    mockWebhookEventRepo.create.mockResolvedValue({});
  });

  it('transitions Processing refund to Completed', async () => {
    mockConstructEvent.mockReturnValue(makeChargeEvent('re_123'));
    mockRefundFindFirst.mockResolvedValue({ id: 10, status: 'Processing', customerOrderId: 1 });
    mockRefundUpdate.mockResolvedValue({});
    mockRefundFindMany.mockResolvedValue([{ amount: { toString: () => '10.00' } }]);
    mockOrderFindUnique.mockResolvedValue({ totalAmount: { toString: () => '29.99' } });
    mockOrderUpdate.mockResolvedValue({});
    await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'Completed' }) })
    );
  });

  it('is a no-op if refund already Completed', async () => {
    mockConstructEvent.mockReturnValue(makeChargeEvent('re_done'));
    mockRefundFindFirst.mockResolvedValue({ id: 11, status: 'Completed', customerOrderId: 1 });
    await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
    expect(mockRefundUpdate).not.toHaveBeenCalled();
  });

  it('logs warning and skips if refund not found by paymentProviderReference', async () => {
    mockConstructEvent.mockReturnValue(makeChargeEvent('re_notfound'));
    mockRefundFindFirst.mockResolvedValue(null);
    await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
    expect(mockRefundUpdate).not.toHaveBeenCalled();
  });

  it('recalculates paymentStatus to Refunded when fully refunded', async () => {
    mockConstructEvent.mockReturnValue(makeChargeEvent('re_full'));
    mockRefundFindFirst.mockResolvedValue({ id: 12, status: 'Processing', customerOrderId: 1 });
    mockRefundUpdate.mockResolvedValue({});
    mockRefundFindMany.mockResolvedValue([{ amount: { toString: () => '29.99' } }]);
    mockOrderFindUnique.mockResolvedValue({ totalAmount: { toString: () => '29.99' } });
    mockOrderUpdate.mockResolvedValue({});
    await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentStatus: 'Refunded' }) })
    );
  });

  it('recalculates paymentStatus to PartiallyRefunded for partial', async () => {
    mockConstructEvent.mockReturnValue(makeChargeEvent('re_partial'));
    mockRefundFindFirst.mockResolvedValue({ id: 13, status: 'Processing', customerOrderId: 1 });
    mockRefundUpdate.mockResolvedValue({});
    mockRefundFindMany.mockResolvedValue([{ amount: { toString: () => '10.00' } }]);
    mockOrderFindUnique.mockResolvedValue({ totalAmount: { toString: () => '29.99' } });
    mockOrderUpdate.mockResolvedValue({});
    await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentStatus: 'PartiallyRefunded' }) })
    );
  });
});
