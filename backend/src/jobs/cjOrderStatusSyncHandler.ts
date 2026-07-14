import { CjOrderPushService } from '../application/services/cjOrderPushService';
import { CjOrderStatusSyncOrchestrator } from '../application/services/cjOrderStatusSyncService';
import { ShipmentService } from '../application/services/shipmentService';
import { SupplierOrderRepository } from '../infrastructure/repositories/supplierOrderRepository';
import { SupplierIntegrationRepository } from '../infrastructure/repositories/supplierIntegrationRepository';
import { CjCatalogItemRepository } from '../infrastructure/repositories/cjCatalogItemRepository';
import { ShipmentRepository } from '../infrastructure/repositories/shipmentRepository';
import { AutomationSettingsRepository } from '../infrastructure/repositories/automationSettingsRepository';
import { AutomationAlertRepository } from '../infrastructure/repositories/automationAlertRepository';
import { cjClient } from '../infrastructure/external/cjClient';
import { logger } from '../infrastructure/logger';

// Manually wired, matching this codebase's existing pattern of each entry
// point (HTTP controller or, here, a scheduled job) constructing its own
// service graph once at module load time.
const supplierOrderRepo = new SupplierOrderRepository();
const orchestrator = new CjOrderStatusSyncOrchestrator(
  new CjOrderPushService(
    supplierOrderRepo,
    new SupplierIntegrationRepository(),
    new CjCatalogItemRepository(),
    cjClient,
    new AutomationSettingsRepository()
  ),
  new ShipmentRepository(),
  new ShipmentService(new ShipmentRepository()),
  new AutomationAlertRepository()
);

export interface CjOrderStatusSyncRunResult {
  enabled: boolean;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
}

// No HTTP surface — invoked only by the EventBridge `schedule` event in
// serverless.yml, or manually via `serverless invoke local -f cjOrderStatusSync`.
export async function handler(_event?: unknown): Promise<CjOrderStatusSyncRunResult> {
  if (process.env['FULFILLMENT_AUTOMATION_ENABLED'] !== 'true') {
    logger.info('cjOrderStatusSync job skipped: FULFILLMENT_AUTOMATION_ENABLED is not true', {});
    return { enabled: false, processed: 0, updated: 0, skipped: 0, failed: 0 };
  }

  const candidates = await supplierOrderRepo.findPushedNonTerminal();
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of candidates) {
    try {
      const changed = await orchestrator.syncOne(order);
      if (changed) updated++;
      else skipped++;
    } catch (err) {
      failed++;
      logger.error('cjOrderStatusSync: sync failed for supplier order', {
        supplierOrderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
      // Best-effort alert; do not let a broken alert write abort the loop.
      try {
        await new AutomationAlertRepository().create({
          type: 'CjStatusSyncFailed',
          customerOrderId: order.customerOrderId,
          supplierOrderId: order.id,
          message: err instanceof Error ? err.message : 'Unknown status-sync failure',
        });
      } catch {
        /* logged above; swallow */
      }
    }
  }

  logger.info('cjOrderStatusSync job finished', { processed: candidates.length, updated, skipped, failed });
  return { enabled: true, processed: candidates.length, updated, skipped, failed };
}
