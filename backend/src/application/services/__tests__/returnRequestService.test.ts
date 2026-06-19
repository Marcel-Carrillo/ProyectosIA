import { ReturnRequestService } from '../returnRequestService';
import {
  ReturnRequestNotFoundError,
  ReturnRequestOrderCancelledError,
  ReturnRequestItemMismatchError,
  ReturnRequestTransitionInvalidError,
} from '../../../infrastructure/repositories/returnRequestRepository';
import {
  CustomerOrderNotFoundError,
  CustomerOrderItemNotFoundError,
} from '../../../infrastructure/repositories/customerOrderRepository';
import { ReturnRequest } from '../../../domain/models/returnRequest';

const mockCustomerOrderFindUnique = jest.fn();
const mockCustomerOrderItemFindUnique = jest.fn();
const mockReturnRequestCreate = jest.fn();
const mockReturnRequestFindUnique = jest.fn();
const mockReturnRequestUpdate = jest.fn();

const mockTransaction = jest.fn(async (cb: (tx: unknown) => unknown) =>
  cb({
    customerOrder: { findUnique: (a: unknown) => mockCustomerOrderFindUnique(a) },
    customerOrderItem: { findUnique: (a: unknown) => mockCustomerOrderItemFindUnique(a) },
    returnRequest: {
      create: (a: unknown) => mockReturnRequestCreate(a),
      findUnique: (a: unknown) => mockReturnRequestFindUnique(a),
      update: (a: unknown) => mockReturnRequestUpdate(a),
    },
  })
);

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: (cb: any) => mockTransaction(cb as (tx: unknown) => unknown),
  },
}));

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
};

function makeRRRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    customerOrderId: 10,
    customerOrderItemId: 20,
    reason: 'Damaged item',
    status: 'Requested',
    requestedAt: new Date(),
    approvedAt: null,
    rejectedAt: null,
    receivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRR(overrides: Record<string, unknown> = {}): ReturnRequest {
  return new ReturnRequest(makeRRRow(overrides) as ConstructorParameters<typeof ReturnRequest>[0]);
}

describe('ReturnRequestService', () => {
  let service: ReturnRequestService;

  beforeEach(() => {
    service = new ReturnRequestService(mockRepo as never);
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        customerOrder: { findUnique: (a: unknown) => mockCustomerOrderFindUnique(a) },
        customerOrderItem: { findUnique: (a: unknown) => mockCustomerOrderItemFindUnique(a) },
        returnRequest: {
          create: (a: unknown) => mockReturnRequestCreate(a),
          findUnique: (a: unknown) => mockReturnRequestFindUnique(a),
          update: (a: unknown) => mockReturnRequestUpdate(a),
        },
      })
    );
  });

  describe('list', () => {
    it('delegates to repository', async () => {
      const result = { items: [], total: 0, page: 1, pageSize: 20 };
      mockRepo.findAll.mockResolvedValue(result);
      const r = await service.list({});
      expect(mockRepo.findAll).toHaveBeenCalled();
      expect(r).toBe(result);
    });
  });

  describe('getById', () => {
    it('returns return request when found', async () => {
      const rr = makeRR();
      mockRepo.findById.mockResolvedValue(rr);
      const result = await service.getById(1);
      expect(result).toBe(rr);
    });

    it('throws ReturnRequestNotFoundError when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.getById(999)).rejects.toBeInstanceOf(ReturnRequestNotFoundError);
    });
  });

  describe('create', () => {
    const validInput = { customerOrderId: 10, customerOrderItemId: 20, reason: 'Damaged item' };

    it('throws validation error for missing required fields', async () => {
      await expect(service.create({})).rejects.toThrow();
    });

    it('throws CustomerOrderNotFoundError when order does not exist', async () => {
      mockCustomerOrderFindUnique.mockResolvedValue(null);
      await expect(service.create(validInput)).rejects.toBeInstanceOf(CustomerOrderNotFoundError);
    });

    it('throws ReturnRequestOrderCancelledError when order is Cancelled', async () => {
      mockCustomerOrderFindUnique.mockResolvedValue({ id: 10, status: 'Cancelled' });
      await expect(service.create(validInput)).rejects.toBeInstanceOf(ReturnRequestOrderCancelledError);
    });

    it('throws CustomerOrderItemNotFoundError when item does not exist', async () => {
      mockCustomerOrderFindUnique.mockResolvedValue({ id: 10, status: 'Pending' });
      mockCustomerOrderItemFindUnique.mockResolvedValue(null);
      await expect(service.create(validInput)).rejects.toBeInstanceOf(CustomerOrderItemNotFoundError);
    });

    it('throws ReturnRequestItemMismatchError when item belongs to a different order', async () => {
      mockCustomerOrderFindUnique.mockResolvedValue({ id: 10, status: 'Pending' });
      mockCustomerOrderItemFindUnique.mockResolvedValue({ id: 20, customerOrderId: 99 });
      await expect(service.create(validInput)).rejects.toBeInstanceOf(ReturnRequestItemMismatchError);
    });

    it('creates return request with Requested status and requestedAt timestamp', async () => {
      mockCustomerOrderFindUnique.mockResolvedValue({ id: 10, status: 'Pending' });
      mockCustomerOrderItemFindUnique.mockResolvedValue({ id: 20, customerOrderId: 10 });
      mockReturnRequestCreate.mockResolvedValue(makeRRRow());

      const result = await service.create(validInput);
      expect(result.status).toBe('Requested');
      expect(mockReturnRequestCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Requested', requestedAt: expect.any(Date) }),
        })
      );
    });
  });

  describe('updateStatus', () => {
    it('throws ReturnRequestNotFoundError when record does not exist', async () => {
      mockReturnRequestFindUnique.mockResolvedValue(null);
      await expect(service.updateStatus(999, { status: 'Approved' })).rejects.toBeInstanceOf(
        ReturnRequestNotFoundError
      );
    });

    it('throws ReturnRequestTransitionInvalidError for invalid transition', async () => {
      mockReturnRequestFindUnique.mockResolvedValue({ id: 1, status: 'Requested' });
      await expect(service.updateStatus(1, { status: 'Received' })).rejects.toBeInstanceOf(
        ReturnRequestTransitionInvalidError
      );
    });

    it('transitions Requested → Approved and sets approvedAt', async () => {
      mockReturnRequestFindUnique.mockResolvedValue({ id: 1, status: 'Requested' });
      mockReturnRequestUpdate.mockResolvedValue(makeRRRow({ status: 'Approved', approvedAt: new Date() }));

      const result = await service.updateStatus(1, { status: 'Approved' });
      expect(result.status).toBe('Approved');
      expect(mockReturnRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Approved', approvedAt: expect.any(Date) }),
        })
      );
    });

    it('transitions Requested → Rejected and sets rejectedAt', async () => {
      mockReturnRequestFindUnique.mockResolvedValue({ id: 1, status: 'Requested' });
      mockReturnRequestUpdate.mockResolvedValue(makeRRRow({ status: 'Rejected', rejectedAt: new Date() }));

      await service.updateStatus(1, { status: 'Rejected' });
      expect(mockReturnRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Rejected', rejectedAt: expect.any(Date) }),
        })
      );
    });

    it('transitions Requested → Cancelled (no timestamp)', async () => {
      mockReturnRequestFindUnique.mockResolvedValue({ id: 1, status: 'Requested' });
      mockReturnRequestUpdate.mockResolvedValue(makeRRRow({ status: 'Cancelled' }));

      await service.updateStatus(1, { status: 'Cancelled' });
      const callData = mockReturnRequestUpdate.mock.calls[0][0].data;
      expect(callData.approvedAt).toBeUndefined();
      expect(callData.rejectedAt).toBeUndefined();
      expect(callData.receivedAt).toBeUndefined();
    });

    it('transitions Approved → Received and sets receivedAt', async () => {
      mockReturnRequestFindUnique.mockResolvedValue({ id: 1, status: 'Approved' });
      mockReturnRequestUpdate.mockResolvedValue(makeRRRow({ status: 'Received', receivedAt: new Date() }));

      await service.updateStatus(1, { status: 'Received' });
      expect(mockReturnRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Received', receivedAt: expect.any(Date) }),
        })
      );
    });

    it('rejects transition from terminal state Rejected', async () => {
      mockReturnRequestFindUnique.mockResolvedValue({ id: 1, status: 'Rejected' });
      await expect(service.updateStatus(1, { status: 'Approved' })).rejects.toBeInstanceOf(
        ReturnRequestTransitionInvalidError
      );
    });

    it('rejects transition from terminal state Refunded', async () => {
      mockReturnRequestFindUnique.mockResolvedValue({ id: 1, status: 'Refunded' });
      await expect(service.updateStatus(1, { status: 'Cancelled' })).rejects.toBeInstanceOf(
        ReturnRequestTransitionInvalidError
      );
    });

    it('rejects transition from terminal state Cancelled', async () => {
      mockReturnRequestFindUnique.mockResolvedValue({ id: 1, status: 'Cancelled' });
      await expect(service.updateStatus(1, { status: 'Approved' })).rejects.toBeInstanceOf(
        ReturnRequestTransitionInvalidError
      );
    });
  });
});
