const mockFindPushedNonTerminal = jest.fn();
const mockSyncOne = jest.fn();
const mockAlertCreate = jest.fn();

jest.mock('../../infrastructure/repositories/supplierOrderRepository', () => ({
  SupplierOrderRepository: jest.fn().mockImplementation(() => ({
    findPushedNonTerminal: mockFindPushedNonTerminal,
  })),
}));
jest.mock('../../application/services/cjOrderStatusSyncService', () => ({
  CjOrderStatusSyncOrchestrator: jest.fn().mockImplementation(() => ({ syncOne: mockSyncOne })),
}));
jest.mock('../../application/services/cjOrderPushService', () => ({
  CjOrderPushService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../application/services/shipmentService', () => ({
  ShipmentService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../infrastructure/repositories/supplierIntegrationRepository', () => ({
  SupplierIntegrationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../infrastructure/repositories/cjCatalogItemRepository', () => ({
  CjCatalogItemRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../infrastructure/repositories/shipmentRepository', () => ({
  ShipmentRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../infrastructure/repositories/automationSettingsRepository', () => ({
  AutomationSettingsRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../infrastructure/repositories/automationAlertRepository', () => ({
  AutomationAlertRepository: jest.fn().mockImplementation(() => ({ create: mockAlertCreate })),
}));
jest.mock('../../infrastructure/external/cjClient', () => ({ cjClient: {} }));
jest.mock('../../infrastructure/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { handler } from '../cjOrderStatusSyncHandler';
import { SupplierOrder } from '../../domain/models/supplierOrder';

function makeSupplierOrder(id: number) {
  return new SupplierOrder({ id, supplierOrderNumber: `SPO-${id}`, customerOrderId: id, supplierId: 1 });
}

describe('cjOrderStatusSyncHandler', () => {
  const originalEnv = process.env['FULFILLMENT_AUTOMATION_ENABLED'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env['FULFILLMENT_AUTOMATION_ENABLED'];
    else process.env['FULFILLMENT_AUTOMATION_ENABLED'] = originalEnv;
  });

  it('should_no_op_without_querying_the_database_when_automation_is_disabled', async () => {
    delete process.env['FULFILLMENT_AUTOMATION_ENABLED'];

    const result = await handler();

    expect(result).toEqual({ enabled: false, processed: 0, updated: 0, skipped: 0, failed: 0 });
    expect(mockFindPushedNonTerminal).not.toHaveBeenCalled();
  });

  it('should_process_all_candidates_and_count_updated_vs_skipped', async () => {
    process.env['FULFILLMENT_AUTOMATION_ENABLED'] = 'true';
    mockFindPushedNonTerminal.mockResolvedValue([makeSupplierOrder(1), makeSupplierOrder(2)]);
    mockSyncOne.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await handler();

    expect(result).toEqual({ enabled: true, processed: 2, updated: 1, skipped: 1, failed: 0 });
  });

  it('should_continue_processing_remaining_candidates_when_one_throws_and_record_an_alert', async () => {
    process.env['FULFILLMENT_AUTOMATION_ENABLED'] = 'true';
    mockFindPushedNonTerminal.mockResolvedValue([makeSupplierOrder(1), makeSupplierOrder(2)]);
    mockSyncOne.mockRejectedValueOnce(new Error('CJ API down')).mockResolvedValueOnce(true);

    const result = await handler();

    expect(result).toEqual({ enabled: true, processed: 2, updated: 1, skipped: 0, failed: 1 });
    expect(mockAlertCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CjStatusSyncFailed', supplierOrderId: 1 })
    );
  });

  it('should_swallow_an_alert_write_failure_without_aborting_the_run', async () => {
    process.env['FULFILLMENT_AUTOMATION_ENABLED'] = 'true';
    mockFindPushedNonTerminal.mockResolvedValue([makeSupplierOrder(1)]);
    mockSyncOne.mockRejectedValue(new Error('CJ API down'));
    mockAlertCreate.mockRejectedValue(new Error('DB write failed'));

    await expect(handler()).resolves.toEqual({ enabled: true, processed: 1, updated: 0, skipped: 0, failed: 1 });
  });
});
