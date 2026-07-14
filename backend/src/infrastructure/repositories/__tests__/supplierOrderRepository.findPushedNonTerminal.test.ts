import { SupplierOrderRepository } from '../supplierOrderRepository';
import { CJ_TERMINAL_STATUSES } from '../../../domain/models/cjOrderStatus';

const mockFindMany = jest.fn();

jest.mock('../../prismaClient', () => ({
  prisma: {
    supplierOrder: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const dbRow = {
  id: 1,
  supplierOrderNumber: 'SPO-000001',
  customerOrderId: 1,
  supplierId: 1,
  status: 'Requested',
  requestedAt: null,
  confirmedAt: null,
  shippedAt: null,
  deliveredAt: null,
  trackingNumber: null,
  trackingUrl: null,
  internalNotes: null,
  externalProvider: 'CJDropshipping',
  externalOrderId: 'cj-order-1',
  externalOrderStatus: null,
  externalTrackingNumber: null,
  externalTrackingProvider: null,
  sandbox: true,
  pushedAt: new Date('2026-01-01'),
  lastStatusSyncedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  supplier: null,
  customerOrder: null,
  items: [],
};

describe('SupplierOrderRepository - findPushedNonTerminal', () => {
  let repo: SupplierOrderRepository;

  beforeEach(() => {
    repo = new SupplierOrderRepository();
    jest.clearAllMocks();
  });

  it('should_query_for_pushed_orders_excluding_terminal_statuses', async () => {
    mockFindMany.mockResolvedValue([dbRow]);

    const result = await repo.findPushedNonTerminal();

    expect(result).toHaveLength(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          externalOrderId: { not: null },
          OR: [{ externalOrderStatus: null }, { externalOrderStatus: { notIn: [...CJ_TERMINAL_STATUSES] } }],
        },
      })
    );
  });

  it('should_return_empty_array_when_no_candidates', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await repo.findPushedNonTerminal();

    expect(result).toEqual([]);
  });
});
