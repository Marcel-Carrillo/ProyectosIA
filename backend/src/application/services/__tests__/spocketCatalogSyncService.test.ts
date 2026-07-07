import { SpocketCatalogSyncService } from '../spocketCatalogSyncService';
import { SupplierIntegration } from '../../../domain/models/supplierIntegration';
import { ISupplierIntegrationRepository } from '../../../domain/repositories/supplierIntegrationRepository';
import { ISpocketCatalogItemRepository } from '../../../domain/repositories/spocketCatalogItemRepository';
import { ISpocketClient } from '../../../infrastructure/external/spocketTypes';
import { SupplierIntegrationNotFoundError } from '../../../infrastructure/repositories/supplierIntegrationRepository';
import { SpocketConnectionNotReadyError, SpocketApiUnavailableError } from '../../validator';

function makeIntegration(status: 'Disconnected' | 'Connected' | 'Error' = 'Connected') {
  return new SupplierIntegration({ id: 1, supplierId: 10, status });
}

describe('SpocketCatalogSyncService', () => {
  let integrationRepo: jest.Mocked<ISupplierIntegrationRepository>;
  let catalogRepo: jest.Mocked<ISpocketCatalogItemRepository>;
  let spocketClient: jest.Mocked<ISpocketClient>;
  let service: SpocketCatalogSyncService;

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
    };
    spocketClient = {
      verifyConnection: jest.fn(),
      fetchCatalog: jest.fn(),
    };
    service = new SpocketCatalogSyncService(integrationRepo, catalogRepo, spocketClient);
  });

  describe('syncCatalog', () => {
    it('should_upsert_all_well_formed_items_and_report_zero_failures', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      spocketClient.fetchCatalog.mockResolvedValue({
        products: [
          {
            externalRef: 'p1',
            title: 'Dress',
            variants: [{ externalRef: 'v1', cost: 10, stockQuantity: 5 }],
          },
        ],
        nextPageToken: null,
      });
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
      spocketClient.fetchCatalog.mockResolvedValue({
        products: [
          { externalRef: 'p1', title: 'Dress', variants: [{ externalRef: 'v1', cost: 10, stockQuantity: 5 }] },
        ],
        nextPageToken: null,
      });
      catalogRepo.upsertMany.mockResolvedValue({ upserted: 1 });

      await service.syncCatalog(10);
      await service.syncCatalog(10);

      expect(catalogRepo.upsertMany).toHaveBeenCalledTimes(2);
    });

    it('should_mark_a_malformed_item_as_failed_without_aborting_the_rest', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      spocketClient.fetchCatalog.mockResolvedValue({
        products: [
          {
            externalRef: 'p1',
            title: 'Dress',
            variants: [
              { externalRef: 'v1', cost: 10, stockQuantity: 5 },
              { externalRef: '', cost: -1, stockQuantity: 5 },
            ],
          },
        ],
        nextPageToken: null,
      });
      catalogRepo.upsertMany.mockResolvedValue({ upserted: 2 });

      const result = await service.syncCatalog(10);

      expect(result.itemsFailed).toBe(1);
      expect(result.itemsUpserted).toBe(1);
      expect(catalogRepo.upsertMany).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([expect.objectContaining({ syncStatus: 'Failed' })])
      );
    });

    it('should_reject_when_connection_is_not_connected_without_calling_upstream', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration('Disconnected'));

      await expect(service.syncCatalog(10)).rejects.toBeInstanceOf(SpocketConnectionNotReadyError);
      expect(spocketClient.fetchCatalog).not.toHaveBeenCalled();
    });

    it('should_abort_and_leave_staged_records_unchanged_on_total_upstream_outage', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      spocketClient.fetchCatalog.mockRejectedValue(new Error('upstream down'));

      await expect(service.syncCatalog(10)).rejects.toBeInstanceOf(SpocketApiUnavailableError);
      expect(catalogRepo.upsertMany).not.toHaveBeenCalled();
    });

    it('should_throw_when_supplier_has_no_spocket_connection', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(null);

      await expect(service.syncCatalog(999)).rejects.toBeInstanceOf(SupplierIntegrationNotFoundError);
    });
  });

  describe('listStagedCatalog', () => {
    it('should_clamp_pageSize_to_the_maximum_and_forward_syncStatus_filter', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      catalogRepo.findBySupplierIntegrationId.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 100,
      });

      await service.listStagedCatalog(10, { pageSize: 500, syncStatus: 'Failed' });

      expect(catalogRepo.findBySupplierIntegrationId).toHaveBeenCalledWith(1, {
        pageSize: 100,
        syncStatus: 'Failed',
      });
    });

    it('should_throw_when_supplier_has_no_spocket_connection', async () => {
      integrationRepo.findBySupplierId.mockResolvedValue(null);

      await expect(service.listStagedCatalog(999, {})).rejects.toBeInstanceOf(
        SupplierIntegrationNotFoundError
      );
    });
  });
});
