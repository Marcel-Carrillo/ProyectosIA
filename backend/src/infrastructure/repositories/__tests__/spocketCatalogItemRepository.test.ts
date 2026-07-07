import { SpocketCatalogItemRepository } from '../spocketCatalogItemRepository';

const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockUpsert = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../prismaClient', () => ({
  prisma: {
    spocketCatalogItem: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const dbRow = {
  id: 1,
  supplierIntegrationId: 5,
  externalRef: 'ext-1',
  title: 'Test Product',
  size: null,
  color: null,
  supplierCost: { toString: () => '9.99' },
  stockQuantity: 10,
  rawPayload: {},
  syncStatus: 'Synced',
  syncError: null,
  lastSyncedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('SpocketCatalogItemRepository', () => {
  let repo: SpocketCatalogItemRepository;

  beforeEach(() => {
    repo = new SpocketCatalogItemRepository();
    jest.clearAllMocks();
  });

  describe('upsertMany', () => {
    it('should_upsert_one_row_per_item_within_a_transaction', async () => {
      mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
        await callback({ spocketCatalogItem: { upsert: mockUpsert } });
      });
      mockUpsert.mockResolvedValue(dbRow);

      const items = [
        {
          externalRef: 'ext-1',
          title: 'Test Product',
          supplierCost: '9.99',
          stockQuantity: 10,
          rawPayload: {},
          syncStatus: 'Synced' as const,
          lastSyncedAt: new Date('2026-01-01'),
        },
        {
          externalRef: 'ext-2',
          title: 'Test Product 2',
          supplierCost: '5.00',
          stockQuantity: 3,
          rawPayload: {},
          syncStatus: 'Failed' as const,
          syncError: 'bad data',
          lastSyncedAt: new Date('2026-01-01'),
        },
      ];

      const result = await repo.upsertMany(5, items);

      expect(result).toEqual({ upserted: 2 });
      expect(mockUpsert).toHaveBeenCalledTimes(2);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            supplierIntegrationId_externalRef: { supplierIntegrationId: 5, externalRef: 'ext-1' },
          },
        })
      );
    });
  });

  describe('findBySupplierIntegrationId', () => {
    it('should_apply_default_pagination', async () => {
      mockTransaction.mockResolvedValue([[dbRow], 1]);

      const result = await repo.findBySupplierIntegrationId(5);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.total).toBe(1);
      expect(result.items[0].externalRef).toBe('ext-1');
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { supplierIntegrationId: 5 },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should_filter_by_syncStatus_when_provided', async () => {
      mockTransaction.mockResolvedValue([[], 0]);

      await repo.findBySupplierIntegrationId(5, { syncStatus: 'Failed' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { supplierIntegrationId: 5, syncStatus: 'Failed' },
        })
      );
    });
  });
});
