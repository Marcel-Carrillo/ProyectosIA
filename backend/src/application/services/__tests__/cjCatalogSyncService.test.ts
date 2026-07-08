import { CjCatalogSyncService } from '../cjCatalogSyncService';
import { SupplierIntegration } from '../../../domain/models/supplierIntegration';
import { ISupplierIntegrationRepository } from '../../../domain/repositories/supplierIntegrationRepository';
import { ICjCatalogItemRepository } from '../../../domain/repositories/cjCatalogItemRepository';
import { ICjClient } from '../../../infrastructure/external/cjTypes';
import { SupplierIntegrationNotFoundError } from '../../../infrastructure/repositories/supplierIntegrationRepository';
import { CjConnectionNotReadyError, CjApiUnavailableError } from '../../validator';

function makeIntegration(status: 'Disconnected' | 'Connected' | 'Error' = 'Connected') {
  return new SupplierIntegration({ id: 1, supplierId: 10, status });
}

function makeMockCjClient(): jest.Mocked<ICjClient> {
  return {
    verifyConnection: jest.fn(),
    fetchCategories: jest.fn(),
    fetchCatalog: jest.fn(),
    fetchVariants: jest.fn(),
    calculateFreight: jest.fn(),
    createOrder: jest.fn(),
    getOrderDetail: jest.fn(),
  };
}

function makeProduct(overrides: {
  id: string;
  nameEn: string;
  sku?: string;
  categoryId?: string;
  sellPrice?: number;
  warehouseInventoryNum?: number;
}) {
  return {
    sku: 'SKU-DEFAULT',
    categoryId: 'cat1',
    sellPrice: 10,
    ...overrides,
  };
}

function singlePageListV2(products: Array<Parameters<typeof makeProduct>[0]>) {
  return {
    pageSize: 100,
    pageNumber: 1,
    totalRecords: products.length,
    totalPages: 1,
    content: [{ productList: products.map(makeProduct) }],
  };
}

describe('CjCatalogSyncService', () => {
  let integrationRepo: jest.Mocked<ISupplierIntegrationRepository>;
  let catalogRepo: jest.Mocked<ICjCatalogItemRepository>;
  let cjClient: jest.Mocked<ICjClient>;
  let service: CjCatalogSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    integrationRepo = {
      findBySupplierId: jest.fn(),
      upsert: jest.fn(),
      updateStatus: jest.fn(),
      updateLastSyncedAt: jest.fn(),
    };
    catalogRepo = {
      upsertMany: jest.fn(),
      findBySupplierIntegrationId: jest.fn(),
      findByExternalRef: jest.fn(),
      findById: jest.fn(),
      findManyByIds: jest.fn(),
    };
    cjClient = makeMockCjClient();
    service = new CjCatalogSyncService(integrationRepo, catalogRepo, cjClient);
  });

  describe('syncCatalog', () => {
    it('should_upsert_all_well_formed_items_and_report_zero_failures', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      cjClient.fetchCatalog.mockResolvedValue(
        singlePageListV2([{ id: 'p1', nameEn: 'Dress', categoryId: 'cat1', sellPrice: 20 }])
      );
      cjClient.fetchVariants.mockResolvedValue([
        { vid: 'v1', pid: 'p1', variantSku: 'SKU-1', variantSellPrice: 10, inventoryNum: 5 },
      ]);
      catalogRepo.upsertMany.mockResolvedValue({ upserted: 1 });

      const result = await service.syncCatalog(10);

      expect(result).toEqual({ itemsUpserted: 1, itemsFailed: 0, syncedAt: expect.any(Date) });
      expect(catalogRepo.upsertMany).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([expect.objectContaining({ externalRef: 'v1', syncStatus: 'Synced' })])
      );
      expect(integrationRepo.updateLastSyncedAt).toHaveBeenCalledWith(1, expect.any(Date));
    });

    it('should_call_upsertMany_again_on_a_second_run_idempotently', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      cjClient.fetchCatalog.mockResolvedValue(singlePageListV2([{ id: 'p1', nameEn: 'Dress' }]));
      cjClient.fetchVariants.mockResolvedValue([{ vid: 'v1', pid: 'p1', variantSku: 'SKU-1', variantSellPrice: 10 }]);
      catalogRepo.upsertMany.mockResolvedValue({ upserted: 1 });

      await service.syncCatalog(10);
      await service.syncCatalog(10);

      expect(catalogRepo.upsertMany).toHaveBeenCalledTimes(2);
    });

    it('should_mark_a_malformed_item_as_failed_without_aborting_the_rest', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      cjClient.fetchCatalog.mockResolvedValue(singlePageListV2([{ id: 'p1', nameEn: 'Dress' }]));
      cjClient.fetchVariants.mockResolvedValue([
        { vid: 'v1', pid: 'p1', variantSku: 'SKU-1', variantSellPrice: 10 },
        { vid: '', pid: 'p1', variantSku: 'SKU-2', variantSellPrice: -1 },
      ]);
      catalogRepo.upsertMany.mockResolvedValue({ upserted: 2 });

      const result = await service.syncCatalog(10);

      expect(result.itemsFailed).toBe(1);
      expect(result.itemsUpserted).toBe(1);
      expect(catalogRepo.upsertMany).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([expect.objectContaining({ syncStatus: 'Failed' })])
      );
    });

    it('should_mark_the_whole_product_as_failed_when_fetchVariants_fails_without_aborting_the_sync', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      cjClient.fetchCatalog.mockResolvedValue(singlePageListV2([{ id: 'p1', nameEn: 'Dress' }]));
      cjClient.fetchVariants.mockRejectedValue(new Error('variant fetch failed'));
      catalogRepo.upsertMany.mockResolvedValue({ upserted: 1 });

      const result = await service.syncCatalog(10);

      expect(result.itemsFailed).toBe(1);
      expect(catalogRepo.upsertMany).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([expect.objectContaining({ syncStatus: 'Failed', pid: 'p1' })])
      );
    });

    it('should_paginate_across_multiple_pages_using_page_numbers', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      cjClient.fetchCatalog
        .mockResolvedValueOnce({
          pageSize: 1,
          pageNumber: 1,
          totalRecords: 2,
          totalPages: 2,
          content: [{ productList: [makeProduct({ id: 'p1', nameEn: 'Dress' })] }],
        })
        .mockResolvedValueOnce({
          pageSize: 1,
          pageNumber: 2,
          totalRecords: 2,
          totalPages: 2,
          content: [{ productList: [makeProduct({ id: 'p2', nameEn: 'Skirt' })] }],
        });
      cjClient.fetchVariants.mockResolvedValue([{ vid: 'v1', pid: 'p1', variantSku: 'SKU-1', variantSellPrice: 10 }]);
      catalogRepo.upsertMany.mockResolvedValue({ upserted: 2 });

      await service.syncCatalog(10);

      expect(cjClient.fetchCatalog).toHaveBeenCalledTimes(2);
      expect(cjClient.fetchCatalog).toHaveBeenNthCalledWith(1, 1, expect.any(Number));
      expect(cjClient.fetchCatalog).toHaveBeenNthCalledWith(2, 2, expect.any(Number));
    });

    it('should_reject_when_connection_is_not_connected_without_calling_upstream', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration('Disconnected'));

      await expect(service.syncCatalog(10)).rejects.toBeInstanceOf(CjConnectionNotReadyError);
      expect(cjClient.fetchCatalog).not.toHaveBeenCalled();
    });

    it('should_abort_and_leave_staged_records_unchanged_on_total_upstream_outage', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      cjClient.fetchCatalog.mockRejectedValue(new Error('upstream down'));

      await expect(service.syncCatalog(10)).rejects.toBeInstanceOf(CjApiUnavailableError);
      expect(catalogRepo.upsertMany).not.toHaveBeenCalled();
    });

    it('should_throw_when_supplier_has_no_cj_connection', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(null);

      await expect(service.syncCatalog(999)).rejects.toBeInstanceOf(SupplierIntegrationNotFoundError);
    });

    it('should_coerce_a_string_sellPrice_instead_of_failing_the_item', async () => {
      // Regression: the real CJ API has been observed returning `sellPrice`
      // as a numeric string on some catalog entries despite the documented
      // `number` type — a naive `.toFixed()` call previously failed every
      // single item in a live sync.
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      cjClient.fetchCatalog.mockResolvedValue(
        singlePageListV2([{ id: 'p1', nameEn: 'Dress', sellPrice: '19.99' as unknown as number }])
      );
      cjClient.fetchVariants.mockResolvedValue([
        { vid: 'v1', pid: 'p1', variantSku: 'SKU-1', variantSellPrice: 10 },
      ]);
      catalogRepo.upsertMany.mockResolvedValue({ upserted: 1 });

      const result = await service.syncCatalog(10);

      expect(result.itemsFailed).toBe(0);
      expect(catalogRepo.upsertMany).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([expect.objectContaining({ syncStatus: 'Synced', sellPrice: '19.99' })])
      );
    });
  });

  describe('listStagedCatalog', () => {
    it('should_clamp_pageSize_to_the_maximum_and_forward_syncStatus_filter', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      catalogRepo.findBySupplierIntegrationId.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });

      await service.listStagedCatalog(10, { pageSize: 500, syncStatus: 'Failed' });

      expect(catalogRepo.findBySupplierIntegrationId).toHaveBeenCalledWith(1, { pageSize: 100, syncStatus: 'Failed' });
    });

    it('should_throw_when_supplier_has_no_cj_connection', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(null);

      await expect(service.listStagedCatalog(999, {})).rejects.toBeInstanceOf(SupplierIntegrationNotFoundError);
    });
  });
});
