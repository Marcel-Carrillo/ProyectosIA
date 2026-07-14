import { FulfillmentAutomationService } from '../fulfillmentAutomationService';
import { SupplierOrderService } from '../supplierOrderService';
import { CjOrderPushService } from '../cjOrderPushService';
import { ISupplierIntegrationRepository } from '../../../domain/repositories/supplierIntegrationRepository';
import { IAutomationAlertRepository } from '../../../domain/repositories/automationAlertRepository';
import { SupplierIntegration } from '../../../domain/models/supplierIntegration';
import { SupplierOrder } from '../../../domain/models/supplierOrder';
import { CjOrderAlreadyPushedError } from '../../validator';

jest.mock('../../../infrastructure/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function makeSupplierOrder(overrides: Partial<ConstructorParameters<typeof SupplierOrder>[0]> = {}) {
  return new SupplierOrder({
    id: 1,
    supplierOrderNumber: 'SPO-000001',
    customerOrderId: 1,
    supplierId: 1,
    ...overrides,
  });
}

describe('FulfillmentAutomationService', () => {
  let supplierOrderService: jest.Mocked<Pick<SupplierOrderService, 'generateFromCustomerOrder'>>;
  let integrationRepo: jest.Mocked<ISupplierIntegrationRepository>;
  let cjOrderPushService: jest.Mocked<Pick<CjOrderPushService, 'pushOrder'>>;
  let alertRepo: jest.Mocked<IAutomationAlertRepository>;
  let service: FulfillmentAutomationService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['FULFILLMENT_AUTOMATION_ENABLED'];

    supplierOrderService = { generateFromCustomerOrder: jest.fn() };
    integrationRepo = {
      findBySupplierId: jest.fn(),
      upsert: jest.fn(),
      updateStatus: jest.fn(),
      updateLastSyncedAt: jest.fn(),
      updateCatalogSyncCursor: jest.fn(),
    };
    cjOrderPushService = { pushOrder: jest.fn() };
    alertRepo = { create: jest.fn(), findAll: jest.fn() };

    service = new FulfillmentAutomationService(
      supplierOrderService as unknown as SupplierOrderService,
      integrationRepo,
      cjOrderPushService as unknown as CjOrderPushService,
      alertRepo
    );
  });

  describe('isEnabled', () => {
    it('should_be_false_by_default', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('should_be_true_when_env_var_is_the_literal_string_true', () => {
      process.env['FULFILLMENT_AUTOMATION_ENABLED'] = 'true';
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('runForPaidOrder', () => {
    it('should_do_nothing_when_disabled', async () => {
      await service.runForPaidOrder(1);
      expect(supplierOrderService.generateFromCustomerOrder).not.toHaveBeenCalled();
    });

    it('should_generate_and_push_when_enabled', async () => {
      process.env['FULFILLMENT_AUTOMATION_ENABLED'] = 'true';
      const order = makeSupplierOrder();
      supplierOrderService.generateFromCustomerOrder.mockResolvedValue({ orders: [order], created: true });
      integrationRepo.findBySupplierId.mockResolvedValue(
        new SupplierIntegration({ id: 1, supplierId: 1, status: 'Connected', provider: 'CJDropshipping' })
      );
      cjOrderPushService.pushOrder.mockResolvedValue(order);

      await service.runForPaidOrder(1);

      expect(supplierOrderService.generateFromCustomerOrder).toHaveBeenCalledWith(1);
      expect(cjOrderPushService.pushOrder).toHaveBeenCalledWith(1, {});
      expect(alertRepo.create).not.toHaveBeenCalled();
    });

    it('should_skip_push_for_a_supplier_order_that_already_has_an_externalOrderId', async () => {
      process.env['FULFILLMENT_AUTOMATION_ENABLED'] = 'true';
      const order = makeSupplierOrder({ externalOrderId: 'cj-order-1' });
      supplierOrderService.generateFromCustomerOrder.mockResolvedValue({ orders: [order], created: false });

      await service.runForPaidOrder(1);

      expect(integrationRepo.findBySupplierId).not.toHaveBeenCalled();
      expect(cjOrderPushService.pushOrder).not.toHaveBeenCalled();
    });

    it('should_skip_push_for_a_supplier_with_no_connected_CJ_integration', async () => {
      process.env['FULFILLMENT_AUTOMATION_ENABLED'] = 'true';
      const order = makeSupplierOrder();
      supplierOrderService.generateFromCustomerOrder.mockResolvedValue({ orders: [order], created: true });
      integrationRepo.findBySupplierId.mockResolvedValue(null);

      await service.runForPaidOrder(1);

      expect(cjOrderPushService.pushOrder).not.toHaveBeenCalled();
      expect(alertRepo.create).not.toHaveBeenCalled();
    });

    it('should_treat_CjOrderAlreadyPushedError_as_an_idempotent_no_op_not_an_alert', async () => {
      process.env['FULFILLMENT_AUTOMATION_ENABLED'] = 'true';
      const order = makeSupplierOrder();
      supplierOrderService.generateFromCustomerOrder.mockResolvedValue({ orders: [order], created: true });
      integrationRepo.findBySupplierId.mockResolvedValue(
        new SupplierIntegration({ id: 1, supplierId: 1, status: 'Connected', provider: 'CJDropshipping' })
      );
      cjOrderPushService.pushOrder.mockRejectedValue(new CjOrderAlreadyPushedError());

      await service.runForPaidOrder(1);

      expect(alertRepo.create).not.toHaveBeenCalled();
    });

    it('should_record_an_alert_when_generation_fails_and_not_attempt_any_push', async () => {
      process.env['FULFILLMENT_AUTOMATION_ENABLED'] = 'true';
      supplierOrderService.generateFromCustomerOrder.mockRejectedValue(new Error('generation failed'));

      await service.runForPaidOrder(1);

      expect(cjOrderPushService.pushOrder).not.toHaveBeenCalled();
      expect(alertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SupplierOrderGenerationFailed', customerOrderId: 1 })
      );
    });

    it('should_record_an_alert_when_the_CJ_push_fails_for_a_reason_other_than_already_pushed', async () => {
      process.env['FULFILLMENT_AUTOMATION_ENABLED'] = 'true';
      const order = makeSupplierOrder();
      supplierOrderService.generateFromCustomerOrder.mockResolvedValue({ orders: [order], created: true });
      integrationRepo.findBySupplierId.mockResolvedValue(
        new SupplierIntegration({ id: 1, supplierId: 1, status: 'Connected', provider: 'CJDropshipping' })
      );
      cjOrderPushService.pushOrder.mockRejectedValue(new Error('CJ API unavailable'));

      await service.runForPaidOrder(1);

      expect(alertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CjPushFailed', customerOrderId: 1, supplierOrderId: 1 })
      );
    });

    it('should_never_throw_even_when_the_alert_write_itself_fails', async () => {
      process.env['FULFILLMENT_AUTOMATION_ENABLED'] = 'true';
      supplierOrderService.generateFromCustomerOrder.mockRejectedValue(new Error('generation failed'));
      alertRepo.create.mockRejectedValue(new Error('DB write failed'));

      await expect(service.runForPaidOrder(1)).resolves.not.toThrow();
    });

    it('should_never_include_cost_or_secret_looking_values_in_the_recorded_alert_message', async () => {
      process.env['FULFILLMENT_AUTOMATION_ENABLED'] = 'true';
      supplierOrderService.generateFromCustomerOrder.mockRejectedValue(new Error('plain failure reason'));

      await service.runForPaidOrder(1);

      const message = alertRepo.create.mock.calls[0]?.[0]?.message ?? '';
      expect(message).not.toMatch(/sk_|cj_|\d+\.\d{2}/);
    });
  });
});
