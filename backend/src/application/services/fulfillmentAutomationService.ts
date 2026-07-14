import { SupplierOrderService } from './supplierOrderService';
import { CjOrderPushService } from './cjOrderPushService';
import { ISupplierIntegrationRepository } from '../../domain/repositories/supplierIntegrationRepository';
import { IAutomationAlertRepository } from '../../domain/repositories/automationAlertRepository';
import { CjOrderAlreadyPushedError } from '../validator';
import { SupplierOrderRepository } from '../../infrastructure/repositories/supplierOrderRepository';
import { SupplierIntegrationRepository } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { CjCatalogItemRepository } from '../../infrastructure/repositories/cjCatalogItemRepository';
import { AutomationSettingsRepository } from '../../infrastructure/repositories/automationSettingsRepository';
import { AutomationAlertRepository } from '../../infrastructure/repositories/automationAlertRepository';
import { cjClient } from '../../infrastructure/external/cjClient';
import { logger } from '../../infrastructure/logger';

// Orchestrates the automatic customer-order-paid -> supplier-order ->
// CJ-push chain (fulfillment-automation spec). Feature-flagged; every
// failure is caught and recorded as an alert rather than thrown, per the
// spec's "a failure here must never roll back or block the payment/order
// Paid status" requirement — the caller (paymentService) awaits this but
// must never see it throw.
export class FulfillmentAutomationService {
  constructor(
    private readonly supplierOrderService: SupplierOrderService,
    private readonly integrationRepo: ISupplierIntegrationRepository,
    private readonly cjOrderPushService: CjOrderPushService,
    private readonly alertRepo: IAutomationAlertRepository
  ) {}

  isEnabled(): boolean {
    // Pure env-var kill-switch, mirroring the existing
    // SUPPLIER_AUTO_PROVISION_ENABLED pattern — not a settings-table column.
    return process.env['FULFILLMENT_AUTOMATION_ENABLED'] === 'true';
  }

  async runForPaidOrder(customerOrderId: number): Promise<void> {
    if (!this.isEnabled()) return;

    let orders;
    try {
      const result = await this.supplierOrderService.generateFromCustomerOrder(customerOrderId);
      orders = result.orders;
    } catch (err) {
      await this.recordAlert('SupplierOrderGenerationFailed', customerOrderId, undefined, err);
      return;
    }

    for (const order of orders) {
      if (order.externalOrderId) continue; // already pushed — idempotent no-op
      if (order.id === undefined) continue;

      const integration = await this.integrationRepo.findBySupplierId(order.supplierId);
      // Not every SupplierOrder is CJ-fulfilled — only attempt an automatic
      // push when this supplier has a Connected CJDropshipping integration.
      // Non-CJ suppliers are left for manual/other fulfillment, unchanged.
      if (!integration || integration.status !== 'Connected' || integration.provider !== 'CJDropshipping') {
        continue;
      }

      try {
        await this.cjOrderPushService.pushOrder(order.id, {});
      } catch (err) {
        if (err instanceof CjOrderAlreadyPushedError) continue; // idempotent no-op on webhook retry
        await this.recordAlert('CjPushFailed', customerOrderId, order.id, err);
      }
    }
  }

  private async recordAlert(
    type: string,
    customerOrderId: number | undefined,
    supplierOrderId: number | undefined,
    err: unknown
  ): Promise<void> {
    const message = err instanceof Error ? err.message : 'Unknown automation failure';
    logger.error('Fulfillment automation step failed', { type, customerOrderId, supplierOrderId, error: message });
    try {
      await this.alertRepo.create({ type, customerOrderId, supplierOrderId, message });
    } catch (alertErr) {
      logger.error('Failed to record automation alert', {
        error: alertErr instanceof Error ? alertErr.message : String(alertErr),
      });
    }
  }
}

export const fulfillmentAutomationService = new FulfillmentAutomationService(
  new SupplierOrderService(new SupplierOrderRepository()),
  new SupplierIntegrationRepository(),
  new CjOrderPushService(
    new SupplierOrderRepository(),
    new SupplierIntegrationRepository(),
    new CjCatalogItemRepository(),
    cjClient,
    new AutomationSettingsRepository()
  ),
  new AutomationAlertRepository()
);
