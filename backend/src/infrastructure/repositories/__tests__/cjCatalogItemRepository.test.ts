import { CjCatalogItemRepository } from '../cjCatalogItemRepository';

const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockUpsert = jest.fn();
const mockFindUnique = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../prismaClient', () => ({
  prisma: {
    cjCatalogItem: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const dbRow = {
  id: 1,
  supplierIntegrationId: 5,
  externalRef: 'ext-1',
  pid: 'pid-1',
  vid: 'ext-1',
  sku: 'SKU-1',
  categoryId: 'cat-1',
  title: 'Test Product',
  size: null,
  color: null,
  supplierCost: { toString: () => '9.99' },
  sellPrice: { toString: () => '19.99' },
  stockQuantity: 10,
  warehouseInventoryNum: 5,
  rawPayload: {},
  syncStatus: 'Synced',
  syncError: null,
  lastSyncedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('CjCatalogItemRepository', () => {
  let repo: CjCatalogItemRepository;

  beforeEach(() => {
    repo = new CjCatalogItemRepository();
    jest.clearAllMocks();
  });

  describe('upsertMany', () => {
    it('should_upsert_one_row_per_item_within_a_transaction_with_cj_specific_fields', async () => {
      mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
        await callback({ cjCatalogItem: { upsert: mockUpsert } });
      });
      mockUpsert.mockResolvedValue(dbRow);

      const items = [
        {
          externalRef: 'ext-1',
          pid: 'pid-1',
          vid: 'ext-1',
          sku: 'SKU-1',
          categoryId: 'cat-1',
          title: 'Test Product',
          supplierCost: '9.99',
          sellPrice: '19.99',
          stockQuantity: 10,
          warehouseInventoryNum: 5,
          rawPayload: {},
          syncStatus: 'Synced' as const,
          lastSyncedAt: new Date('2026-01-01'),
        },
      ];

      const result = await repo.upsertMany(5, items);

      expect(result).toEqual({ upserted: 1 });
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { supplierIntegrationId_externalRef: { supplierIntegrationId: 5, externalRef: 'ext-1' } },
          update: expect.objectContaining({ pid: 'pid-1', vid: 'ext-1', sku: 'SKU-1', categoryId: 'cat-1' }),
          create: expect.objectContaining({ supplierIntegrationId: 5, externalRef: 'ext-1', pid: 'pid-1' }),
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
      expect(result.items[0].externalRef).toBe('ext-1');
      expect(result.items[0].sellPrice).toBe('19.99');
    });

    it('should_filter_by_syncStatus_when_provided', async () => {
      mockTransaction.mockResolvedValue([[], 0]);

      await repo.findBySupplierIntegrationId(5, { syncStatus: 'Failed' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { supplierIntegrationId: 5, syncStatus: 'Failed' } })
      );
    });
  });

  describe('findByExternalRef', () => {
    it('should_return_item_when_found', async () => {
      mockFindUnique.mockResolvedValue(dbRow);

      const result = await repo.findByExternalRef(5, 'ext-1');

      expect(result?.externalRef).toBe('ext-1');
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { supplierIntegrationId_externalRef: { supplierIntegrationId: 5, externalRef: 'ext-1' } },
      });
    });

    it('should_return_null_when_not_found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repo.findByExternalRef(5, 'missing');

      expect(result).toBeNull();
    });
  });
});
