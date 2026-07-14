import { Request, Response, NextFunction } from 'express';
import { CjOrderPushService } from '../../application/services/cjOrderPushService';
import { CjOrderStatusSyncOrchestrator } from '../../application/services/cjOrderStatusSyncService';
import { ShipmentService } from '../../application/services/shipmentService';
import { SupplierOrderRepository, SupplierOrderNotFoundError } from '../../infrastructure/repositories/supplierOrderRepository';
import { SupplierIntegrationRepository } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { CjCatalogItemRepository } from '../../infrastructure/repositories/cjCatalogItemRepository';
import { AutomationSettingsRepository } from '../../infrastructure/repositories/automationSettingsRepository';
import { ShipmentRepository } from '../../infrastructure/repositories/shipmentRepository';
import { AutomationAlertRepository } from '../../infrastructure/repositories/automationAlertRepository';
import { cjClient } from '../../infrastructure/external/cjClient';
import { logger } from '../../infrastructure/logger';
import { ValidationError, validateCjOrderPushData } from '../../application/validator';

// Mounted at /api/admin/supplier-orders/:id/cj/* — the parent
// supplierOrderRoutes.ts router already uses `:id` as its param name (not
// `:supplierOrderId`), so this controller reads `req.params['id']` to match
// the actual mount point, not the spec's literal path wording.
function parseSupplierOrderIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'supplierOrderId' must be a valid integer");
  return id;
}

const supplierOrderRepo = new SupplierOrderRepository();
const cjOrderPushService = new CjOrderPushService(
  supplierOrderRepo,
  new SupplierIntegrationRepository(),
  new CjCatalogItemRepository(),
  cjClient,
  new AutomationSettingsRepository()
);
// Same orchestrator used by the scheduled cjOrderStatusSync job — reused
// here so a sandbox-advance click reflects in the Shipment/admin/store
// immediately instead of waiting for the next hourly run.
const cjOrderStatusSyncOrchestrator = new CjOrderStatusSyncOrchestrator(
  cjOrderPushService,
  new ShipmentRepository(),
  new ShipmentService(new ShipmentRepository()),
  new AutomationAlertRepository()
);

export async function freightQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierOrderId = parseSupplierOrderIdParam(req.params['id'] as string);
    const options = await cjOrderPushService.quoteFreight(supplierOrderId);
    res.json({ success: true, data: options, message: 'CJ Dropshipping freight quote retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function push(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierOrderId = parseSupplierOrderIdParam(req.params['id'] as string);
    const { logisticName } = validateCjOrderPushData(req.body);
    const order = await cjOrderPushService.pushOrder(supplierOrderId, { logisticName });
    logger.info('Supplier order pushed to CJ Dropshipping', { supplierOrderId, externalOrderId: order.externalOrderId });
    res.status(201).json({ success: true, data: order, message: 'Supplier order pushed to CJ Dropshipping successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierOrderId = parseSupplierOrderIdParam(req.params['id'] as string);
    const order = await cjOrderPushService.getOrderStatus(supplierOrderId);
    res.json({ success: true, data: order, message: 'CJ Dropshipping order status retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

// QA-only: sandbox orders never receive real warehouse activity, so this
// drives CJ's own sandbox-testing endpoints (simulate payment, advance
// shipping status) and immediately re-syncs, so the Shipment/admin/store
// reflect the result without waiting for the hourly job. 422s with
// CJ_SANDBOX_ONLY for a real (non-sandbox) order — see CjOrderPushService.
export async function simulateSandboxAdvance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierOrderId = parseSupplierOrderIdParam(req.params['id'] as string);
    await cjOrderPushService.simulateSandboxAdvance(supplierOrderId);

    const order = await supplierOrderRepo.findById(supplierOrderId);
    if (!order) throw new SupplierOrderNotFoundError();
    await cjOrderStatusSyncOrchestrator.syncOne(order);

    const updated = await supplierOrderRepo.findById(supplierOrderId);
    res.json({ success: true, data: updated, message: 'CJ Dropshipping sandbox order advanced' });
  } catch (err) {
    next(err);
  }
}
