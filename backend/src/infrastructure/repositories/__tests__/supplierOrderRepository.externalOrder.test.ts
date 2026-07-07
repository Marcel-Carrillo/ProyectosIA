import { SupplierOrderRepository } from '../supplierOrderRepository';

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../prismaClient', () => ({
  prisma: {
    supplierOrder: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

const dbRow = {
  id: 1,
  supplierOrderNumber: 'SPO-000001',
  customerOrderId: 1,
  supplierId: 1,
  status: 'Draft',
  requestedAt: null,
  confirmedAt: null,
  shippedAt: null,
  deliveredAt: null,
  trackingNumber: null,
  trackingUrl: null,
  internalNotes: null,
  externalProvider: null,
  externalOrderId: null,
  externalOrderStatus: null,
  externalTrackingNumber: null,
  externalTrackingProvider: null,
  sandbox: true,
  pushedAt: null,
  lastStatusSyncedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  supplier: null,
  customerOrder: null,
  items: [],
};

describe('SupplierOrderRepository - external order fields', () => {
  let repo: SupplierOrderRepository;

  beforeEach(() => {
    repo = new SupplierOrderRepository();
    jest.clearAllMocks();
  });

  describe('findByExternalOrderId', () => {
    it('should_return_order_when_found', async () => {
      mockFindUnique.mockResolvedValue({ ...dbRow, externalOrderId: 'cj-order-1' });

      const result = await repo.findByExternalOrderId('cj-order-1');

      expect(result?.externalOrderId).toBe('cj-order-1');
      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { externalOrderId: 'cj-order-1' } })
      );
    });

    it('should_return_null_when_not_found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repo.findByExternalOrderId('missing');

      expect(result).toBeNull();
    });
  });

  describe('updateExternalOrder', () => {
    it('should_persist_provider_orderId_sandbox_and_pushedAt', async () => {
      const pushedAt = new Date('2026-02-01');
      mockUpdate.mockResolvedValue({
        ...dbRow,
        externalProvider: 'CJDropshipping',
        externalOrderId: 'cj-order-1',
        sandbox: true,
        pushedAt,
      });

      const result = await repo.updateExternalOrder(1, {
        externalProvider: 'CJDropshipping',
        externalOrderId: 'cj-order-1',
        sandbox: true,
        pushedAt,
      });

      expect(result.externalOrderId).toBe('cj-order-1');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { externalProvider: 'CJDropshipping', externalOrderId: 'cj-order-1', sandbox: true, pushedAt },
        })
      );
    });
  });

  describe('updateExternalOrderStatus', () => {
    it('should_persist_status_and_tracking_fields', async () => {
      const syncedAt = new Date('2026-03-01');
      mockUpdate.mockResolvedValue({
        ...dbRow,
        externalOrderStatus: 'PROCESSING',
        externalTrackingNumber: 'TRACK1',
        externalTrackingProvider: 'CJPacket Ordinary',
        lastStatusSyncedAt: syncedAt,
      });

      const result = await repo.updateExternalOrderStatus(1, {
        externalOrderStatus: 'PROCESSING',
        externalTrackingNumber: 'TRACK1',
        externalTrackingProvider: 'CJPacket Ordinary',
        lastStatusSyncedAt: syncedAt,
      });

      expect(result.externalOrderStatus).toBe('PROCESSING');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            externalOrderStatus: 'PROCESSING',
            externalTrackingNumber: 'TRACK1',
            externalTrackingProvider: 'CJPacket Ordinary',
            lastStatusSyncedAt: syncedAt,
          }),
        })
      );
    });
  });
});
