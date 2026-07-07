import { Request, Response, NextFunction } from 'express';
import { CjCatalogItem } from '../../../domain/models/cjCatalogItem';

const mockSyncCatalog = jest.fn();
const mockListStagedCatalog = jest.fn();

jest.mock('../../../application/services/cjCatalogSyncService', () => ({
  CjCatalogSyncService: jest.fn().mockImplementation(() => ({
    syncCatalog: mockSyncCatalog,
    listStagedCatalog: mockListStagedCatalog,
  })),
}));

jest.mock('../../../infrastructure/repositories/supplierIntegrationRepository', () => ({
  SupplierIntegrationRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../infrastructure/repositories/cjCatalogItemRepository', () => ({
  CjCatalogItemRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../infrastructure/external/cjClient', () => ({
  cjClient: {},
}));

import { sync, listCatalog } from '../cjCatalogSyncController';

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('cjCatalogSyncController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('sync', () => {
    it('should_return_200_with_sync_summary', async () => {
      const syncedAt = new Date();
      mockSyncCatalog.mockResolvedValue({ itemsUpserted: 3, itemsFailed: 1, syncedAt });
      const req = { params: { supplierId: '10' } } as unknown as Request;
      const res = mockRes();

      await sync(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { itemsUpserted: 3, itemsFailed: 1, syncedAt } })
      );
    });

    it('should_call_next_when_service_throws_connection_not_ready', async () => {
      const err = Object.assign(new Error('not ready'), { code: 'CJ_CONNECTION_NOT_READY', status: 422 });
      mockSyncCatalog.mockRejectedValue(err);
      const req = { params: { supplierId: '10' } } as unknown as Request;

      await sync(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });

    it('should_call_next_when_service_throws_api_unavailable', async () => {
      const err = Object.assign(new Error('unavailable'), { code: 'CJ_API_UNAVAILABLE', status: 502 });
      mockSyncCatalog.mockRejectedValue(err);
      const req = { params: { supplierId: '10' } } as unknown as Request;

      await sync(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  describe('listCatalog', () => {
    it('should_return_200_with_paginated_envelope', async () => {
      mockListStagedCatalog.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
      const req = { params: { supplierId: '10' }, query: {} } as unknown as Request;
      const res = mockRes();

      await listCatalog(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: { items: [], total: 0, page: 1, pageSize: 20 } })
      );
    });

    it('should_never_leak_supplierIntegrationId_or_rawPayload_in_serialized_items', async () => {
      const item = new CjCatalogItem({
        id: 1,
        supplierIntegrationId: 5,
        externalRef: 'ext-1',
        title: 'Dress',
        supplierCost: '9.99',
        stockQuantity: 3,
        rawPayload: { secretUpstreamField: 'should-not-leak' },
        syncStatus: 'Synced',
      });
      mockListStagedCatalog.mockResolvedValue({ items: [item], total: 1, page: 1, pageSize: 20 });
      const req = { params: { supplierId: '10' }, query: {} } as unknown as Request;
      const res = mockRes();

      await listCatalog(req, res, mockNext);

      const payload = JSON.stringify((res.json as jest.Mock).mock.calls[0][0]);
      expect(payload).not.toMatch(/supplierIntegrationId|rawPayload|secretUpstreamField|pid|vid|categoryId/);
      expect(payload).toMatch(/ext-1/);
    });

    it('should_call_next_with_validation_error_for_invalid_syncStatus_without_calling_service', async () => {
      const req = { params: { supplierId: '10' }, query: { syncStatus: 'Bogus' } } as unknown as Request;

      await listCatalog(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
      expect(mockListStagedCatalog).not.toHaveBeenCalled();
    });
  });
});
