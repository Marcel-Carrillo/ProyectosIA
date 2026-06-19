import { RefundService } from '../refundService';
import {
  RefundStripeError,
} from '../../validator';
import {
  RefundNotFoundError,
  RefundTransitionInvalidError,
} from '../../../infrastructure/repositories/refundRepository';
import { Refund } from '../../../domain/models/refund';

const mockStripeRefundCreate = jest.fn();

jest.mock('../../../infrastructure/stripe/stripeClient', () => ({
  stripe: {
    refunds: { create: (...args: unknown[]) => mockStripeRefundCreate(...args) },
  },
}));

jest.mock('../../../infrastructure/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockTxRefundFindUnique = jest.fn();
const mockTxRefundUpdate = jest.fn();
const mockTxRefundFindMany = jest.fn();
const mockTxOrderFindUnique = jest.fn();
const mockTxOrderUpdate = jest.fn();

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        refund: {
          findUnique: (...args: unknown[]) => mockTxRefundFindUnique(...args),
          update: (...args: unknown[]) => mockTxRefundUpdate(...args),
          findMany: (...args: unknown[]) => mockTxRefundFindMany(...args),
          create: jest.fn(),
          findFirst: jest.fn(),
        },
        customerOrder: {
          findUnique: (...args: unknown[]) => mockTxOrderFindUnique(...args),
          update: (...args: unknown[]) => mockTxOrderUpdate(...args),
        },
        returnRequest: { findUnique: jest.fn() },
      };
      return cb(tx);
    }),
  },
}));

const mockRefundRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
};

const service = new RefundService(mockRefundRepo);

function makeRefundRow(overrides: Partial<{
  id: number; status: string; customerOrderId: number; amount: { toString(): string };
}> = {}) {
  return {
    id: 1,
    status: 'Pending',
    customerOrderId: 10,
    amount: { toString: () => '29.99' },
    ...overrides,
  };
}

function makeUpdatedRefund(overrides: Partial<ConstructorParameters<typeof Refund>[0]> = {}) {
  return { id: 1, status: 'Processing', customerOrderId: 10, amount: { toString: () => '29.99' }, processedAt: null, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateStatus — Pending → Processing (Stripe call)', () => {
  it('calls stripe.refunds.create with correct payment_intent and amount', async () => {
    mockTxRefundFindUnique.mockResolvedValue(makeRefundRow({ status: 'Pending' }));
    mockTxOrderFindUnique.mockResolvedValue({ stripePaymentIntentId: 'pi_123', currency: 'EUR' });
    mockStripeRefundCreate.mockResolvedValue({ id: 're_stripe_123' });
    mockTxRefundUpdate.mockResolvedValue(makeUpdatedRefund());

    await service.updateStatus(1, { status: 'Processing' });

    expect(mockStripeRefundCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: 'pi_123',
        amount: 2999,
      }),
      expect.anything()
    );
  });

  it('stores Stripe refund id in paymentProviderReference', async () => {
    mockTxRefundFindUnique.mockResolvedValue(makeRefundRow({ status: 'Pending' }));
    mockTxOrderFindUnique.mockResolvedValue({ stripePaymentIntentId: 'pi_123', currency: 'EUR' });
    mockStripeRefundCreate.mockResolvedValue({ id: 're_abc' });
    mockTxRefundUpdate.mockResolvedValue(makeUpdatedRefund());

    await service.updateStatus(1, { status: 'Processing' });

    expect(mockTxRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentProviderReference: 're_abc' }),
      })
    );
  });

  it('throws RefundStripeError when Stripe fails', async () => {
    mockTxRefundFindUnique.mockResolvedValue(makeRefundRow({ status: 'Pending' }));
    mockTxOrderFindUnique.mockResolvedValue({ stripePaymentIntentId: 'pi_123', currency: 'EUR' });
    mockStripeRefundCreate.mockRejectedValue(new Error('Stripe error'));

    await expect(service.updateStatus(1, { status: 'Processing' })).rejects.toThrow(
      RefundStripeError
    );
  });

  it('uses idempotency key refund:{refundId}', async () => {
    mockTxRefundFindUnique.mockResolvedValue(makeRefundRow({ id: 42, status: 'Pending' }));
    mockTxOrderFindUnique.mockResolvedValue({ stripePaymentIntentId: 'pi_123', currency: 'EUR' });
    mockStripeRefundCreate.mockResolvedValue({ id: 're_x' });
    mockTxRefundUpdate.mockResolvedValue(makeUpdatedRefund());

    await service.updateStatus(42, { status: 'Processing' });

    expect(mockStripeRefundCreate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: 'refund:42' })
    );
  });

  it('throws RefundStripeError if order has no stripePaymentIntentId', async () => {
    mockTxRefundFindUnique.mockResolvedValue(makeRefundRow({ status: 'Pending' }));
    mockTxOrderFindUnique.mockResolvedValue({ stripePaymentIntentId: null, currency: 'EUR' });

    await expect(service.updateStatus(1, { status: 'Processing' })).rejects.toThrow(
      RefundStripeError
    );
    expect(mockStripeRefundCreate).not.toHaveBeenCalled();
  });
});

describe('updateStatus — transitions that do NOT call Stripe', () => {
  it('Pending → Cancelled does NOT call stripe.refunds.create', async () => {
    mockTxRefundFindUnique.mockResolvedValue(makeRefundRow({ status: 'Pending' }));
    mockTxRefundUpdate.mockResolvedValue(makeUpdatedRefund({ status: 'Cancelled' }));
    mockTxRefundFindMany.mockResolvedValue([]);
    mockTxOrderFindUnique.mockResolvedValue({ totalAmount: { toString: () => '29.99' } });
    mockTxOrderUpdate.mockResolvedValue({});

    await service.updateStatus(1, { status: 'Cancelled' });
    expect(mockStripeRefundCreate).not.toHaveBeenCalled();
  });

  it('Processing → Completed does NOT call stripe.refunds.create', async () => {
    mockTxRefundFindUnique.mockResolvedValue(makeRefundRow({ status: 'Processing' }));
    mockTxRefundUpdate.mockResolvedValue(makeUpdatedRefund({ status: 'Completed' }));
    mockTxRefundFindMany.mockResolvedValue([{ amount: { toString: () => '29.99' } }]);
    mockTxOrderFindUnique.mockResolvedValue({ totalAmount: { toString: () => '29.99' } });
    mockTxOrderUpdate.mockResolvedValue({});

    await service.updateStatus(1, { status: 'Completed' });
    expect(mockStripeRefundCreate).not.toHaveBeenCalled();
  });
});

describe('updateStatus — error cases', () => {
  it('throws RefundNotFoundError when refund does not exist', async () => {
    mockTxRefundFindUnique.mockResolvedValue(null);
    await expect(service.updateStatus(99, { status: 'Processing' })).rejects.toThrow(
      RefundNotFoundError
    );
  });

  it('throws RefundTransitionInvalidError for invalid transition', async () => {
    mockTxRefundFindUnique.mockResolvedValue(makeRefundRow({ status: 'Completed' }));
    await expect(service.updateStatus(1, { status: 'Processing' })).rejects.toThrow(
      RefundTransitionInvalidError
    );
  });
});
