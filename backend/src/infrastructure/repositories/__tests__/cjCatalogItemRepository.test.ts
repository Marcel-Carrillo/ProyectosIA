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
      expect(result.items[0]?.item.externalRef).toBe('ext-1');
      expect(result.items[0]?.item.sellPrice).toBe('19.99');
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

  describe('findBySupplierIntegrationId - promotionState derivation', () => {
    it('should_derive_NotPromoted_when_no_linked_variant', async () => {
      mockTransaction.mockResolvedValue([[{ ...dbRow, promotedVariant: null }], 1]);

      const result = await repo.findBySupplierIntegrationId(5);

      expect(result.items[0].promotionState).toBe('NotPromoted');
      expect(result.items[0].productId).toBeNull();
      expect(result.items[0].productVariantId).toBeNull();
    });

    it('should_derive_Active_when_linked_variant_AND_parent_product_are_both_Active', async () => {
      mockTransaction.mockResolvedValue([
        [{ ...dbRow, promotedVariant: { id: 9, productId: 4, status: 'Active', product: { status: 'Active' } } }],
        1,
      ]);

      const result = await repo.findBySupplierIntegrationId(5);

      expect(result.items[0].promotionState).toBe('Active');
      expect(result.items[0].productId).toBe(4);
      expect(result.items[0].productVariantId).toBe(9);
    });

    it('should_derive_Inactive_when_linked_variant_status_is_not_Active', async () => {
      mockTransaction.mockResolvedValue([
        [{ ...dbRow, promotedVariant: { id: 9, productId: 4, status: 'Inactive', product: { status: 'Active' } } }],
        1,
      ]);

      const result = await repo.findBySupplierIntegrationId(5);

      expect(result.items[0].promotionState).toBe('Inactive');
      expect(result.items[0].productId).toBe(4);
      expect(result.items[0].productVariantId).toBe(9);
    });

    it('should_derive_Inactive_when_variant_is_Active_but_parent_product_is_still_Draft', async () => {
      // Regression: a newly-promoted product defaults to Draft (visible
      // nowhere publicly) even though its variant is created Active — must
      // not be misreported as Active.
      mockTransaction.mockResolvedValue([
        [{ ...dbRow, promotedVariant: { id: 9, productId: 4, status: 'Active', product: { status: 'Draft' } } }],
        1,
      ]);

      const result = await repo.findBySupplierIntegrationId(5);

      expect(result.items[0].promotionState).toBe('Inactive');
    });

    it('should_apply_promotionState_where_clause_for_NotPromoted_filter', async () => {
      mockTransaction.mockResolvedValue([[], 0]);

      await repo.findBySupplierIntegrationId(5, { promotionState: 'NotPromoted' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { supplierIntegrationId: 5, promotedVariant: null } })
      );
    });

    it('should_apply_promotionState_where_clause_for_Active_filter', async () => {
      mockTransaction.mockResolvedValue([[], 0]);

      await repo.findBySupplierIntegrationId(5, { promotionState: 'Active' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { supplierIntegrationId: 5, promotedVariant: { is: { status: 'Active', product: { status: 'Active' } } } },
        })
      );
    });

    it('should_apply_promotionState_where_clause_for_Inactive_filter', async () => {
      mockTransaction.mockResolvedValue([[], 0]);

      await repo.findBySupplierIntegrationId(5, { promotionState: 'Inactive' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            supplierIntegrationId: 5,
            promotedVariant: { is: { OR: [{ status: { not: 'Active' } }, { product: { status: { not: 'Active' } } }] } },
          },
        })
      );
    });
  });

  describe('findById', () => {
    it('should_return_item_when_found', async () => {
      mockFindUnique.mockResolvedValue(dbRow);

      const result = await repo.findById(1);

      expect(result?.id).toBe(1);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should_return_null_when_not_found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repo.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findManyByIds', () => {
    it('should_return_matching_items', async () => {
      mockFindMany.mockResolvedValue([dbRow]);

      const result = await repo.findManyByIds([1]);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(1);
      expect(mockFindMany).toHaveBeenCalledWith({ where: { id: { in: [1] } } });
    });

    it('should_return_empty_array_without_querying_when_ids_is_empty', async () => {
      const result = await repo.findManyByIds([]);

      expect(result).toEqual([]);
      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });
});
