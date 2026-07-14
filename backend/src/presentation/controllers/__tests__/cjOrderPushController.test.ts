import { Request, Response, NextFunction } from 'express';
import { SupplierOrder } from '../../../domain/models/supplierOrder';

const mockQuoteFreight = jest.fn();
const mockPushOrder = jest.fn();
const mockGetOrderStatus = jest.fn();
const mockSimulateSandboxAdvance = jest.fn();
const mockSupplierOrderRepoFindById = jest.fn();
const mockSyncOne = jest.fn();

jest.mock('../../../application/services/cjOrderPushService', () => ({
  CjOrderPushService: jest.fn().mockImplementation(() => ({
    quoteFreight: mockQuoteFreight,
    pushOrder: mockPushOrder,
    getOrderStatus: mockGetOrderStatus,
    simulateSandboxAdvance: mockSimulateSandboxAdvance,
  })),
}));

jest.mock('../../../application/services/cjOrderStatusSyncService', () => ({
  CjOrderStatusSyncOrchestrator: jest.fn().mockImplementation(() => ({
    syncOne: mockSyncOne,
  })),
}));

jest.mock('../../../application/services/shipmentService', () => ({
  ShipmentService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../infrastructure/repositories/shipmentRepository', () => ({
  ShipmentRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../infrastructure/repositories/automationAlertRepository', () => ({
  AutomationAlertRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../infrastructure/repositories/supplierOrderRepository', () => ({
  SupplierOrderRepository: jest.fn().mockImplementation(() => ({
    findById: mockSupplierOrderRepoFindById,
  })),
  SupplierOrderNotFoundError: class SupplierOrderNotFoundError extends Error {},
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

import { freightQuote, push, getOrderStatus, simulateSandboxAdvance } from '../cjOrderPushController';

const makeOrder = () => new SupplierOrder({ id: 1, supplierOrderNumber: 'SPO-000001', customerOrderId: 1, supplierId: 1 });

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('cjOrderPushController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('freightQuote', () => {
    it('should_read_the_id_param_not_supplierOrderId_and_return_options', async () => {
      const options = [{ logisticName: 'CJPacket Ordinary', logisticAging: '4-8', logisticPrice: 8.95, totalPostageFee: 7.31 }];
      mockQuoteFreight.mockResolvedValue(options);
      const req = { params: { id: '1' } } as unknown as Request;
      const res = mockRes();

      await freightQuote(req, res, mockNext);

      expect(mockQuoteFreight).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: options }));
    });

    it('should_call_next_with_validation_error_for_non_numeric_id', async () => {
      const req = { params: { id: 'abc' } } as unknown as Request;

      await freightQuote(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
      expect(mockQuoteFreight).not.toHaveBeenCalled();
    });
  });

  describe('push', () => {
    it('should_return_201_on_a_well_formed_push_request', async () => {
      mockPushOrder.mockResolvedValue(makeOrder());
      const req = { params: { id: '1' }, body: { logisticName: 'CJPacket Ordinary' } } as unknown as Request;
      const res = mockRes();

      await push(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockPushOrder).toHaveBeenCalledWith(1, { logisticName: 'CJPacket Ordinary' });
    });

    it('should_call_next_with_validation_error_when_isSandbox_is_present_in_body', async () => {
      const req = { params: { id: '1' }, body: { logisticName: 'X', isSandbox: 1 } } as unknown as Request;

      await push(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
      expect(mockPushOrder).not.toHaveBeenCalled();
    });

    it('should_call_service_with_no_logisticName_when_omitted_to_trigger_auto_selection', async () => {
      const req = { params: { id: '1' }, body: {} } as unknown as Request;

      await push(req, mockRes(), mockNext);

      expect(mockPushOrder).toHaveBeenCalledWith(1, { logisticName: undefined });
    });

    it('should_call_next_on_service_error', async () => {
      const err = Object.assign(new Error('already pushed'), { code: 'CJ_ORDER_ALREADY_PUSHED', status: 409 });
      mockPushOrder.mockRejectedValue(err);
      const req = { params: { id: '1' }, body: { logisticName: 'X' } } as unknown as Request;

      await push(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  describe('getOrderStatus', () => {
    it('should_return_200_with_order_status', async () => {
      mockGetOrderStatus.mockResolvedValue(makeOrder());
      const req = { params: { id: '1' } } as unknown as Request;
      const res = mockRes();

      await getOrderStatus(req, res, mockNext);

      expect(mockGetOrderStatus).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should_call_next_on_service_error', async () => {
      const err = Object.assign(new Error('not pushed'), { code: 'CJ_ORDER_NOT_PUSHED', status: 422 });
      mockGetOrderStatus.mockRejectedValue(err);
      const req = { params: { id: '1' } } as unknown as Request;

      await getOrderStatus(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  describe('simulateSandboxAdvance', () => {
    it('should_advance_then_sync_then_return_the_refreshed_order', async () => {
      mockSimulateSandboxAdvance.mockResolvedValue(undefined);
      const refreshed = makeOrder();
      mockSupplierOrderRepoFindById.mockResolvedValue(refreshed);
      mockSyncOne.mockResolvedValue(true);
      const req = { params: { id: '1' } } as unknown as Request;
      const res = mockRes();

      await simulateSandboxAdvance(req, res, mockNext);

      expect(mockSimulateSandboxAdvance).toHaveBeenCalledWith(1);
      expect(mockSyncOne).toHaveBeenCalledWith(refreshed);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: refreshed }));
    });

    it('should_call_next_when_the_service_rejects_a_real_non_sandbox_order', async () => {
      const err = Object.assign(new Error('sandbox only'), { code: 'CJ_SANDBOX_ONLY', status: 422 });
      mockSimulateSandboxAdvance.mockRejectedValue(err);
      const req = { params: { id: '1' } } as unknown as Request;

      await simulateSandboxAdvance(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
      expect(mockSyncOne).not.toHaveBeenCalled();
    });

    it('should_call_next_with_validation_error_for_non_numeric_id', async () => {
      const req = { params: { id: 'abc' } } as unknown as Request;

      await simulateSandboxAdvance(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
      expect(mockSimulateSandboxAdvance).not.toHaveBeenCalled();
    });
  });
});
