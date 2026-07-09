import { SupplierAutoProvisionService, SupplierAutoProvisionRunResult } from '../application/services/supplierAutoProvisionService';
import { SupplierService } from '../application/services/supplierService';
import { SupplierRepository } from '../infrastructure/repositories/supplierRepository';
import { CjConnectionService } from '../application/services/cjConnectionService';
import { SupplierIntegrationRepository } from '../infrastructure/repositories/supplierIntegrationRepository';
import { cjClient } from '../infrastructure/external/cjClient';
import { providerRegistry } from '../application/providers/providerRegistry';
import { logger } from '../infrastructure/logger';

// Manually wired, exactly like every existing CJ admin controller
// (presentation/controllers/cjConnectionController.ts,
// cjCatalogSyncController.ts, cjCatalogPromotionController.ts) — this
// codebase has no composition root, so each entry point (HTTP controller or,
// here, a scheduled job) constructs its own service graph once at module
// load time.
const supplierAutoProvisionService = new SupplierAutoProvisionService(
  new SupplierService(new SupplierRepository()),
  new CjConnectionService(new SupplierIntegrationRepository(), cjClient),
  providerRegistry
);

// No HTTP surface (design.md D9) — invoked only by the EventBridge `schedule`
// event configured in serverless.yml, or manually via
// `serverless invoke local -f supplierAutoProvision` for testing.
export async function handler(_event?: unknown): Promise<SupplierAutoProvisionRunResult> {
  const result = await supplierAutoProvisionService.run();
  logger.info('supplierAutoProvision job finished', { enabled: result.enabled, providerCount: result.providers.length });
  return result;
}
