import { Request, Response, NextFunction } from 'express';
import { SpocketCatalogSyncService } from '../../application/services/spocketCatalogSyncService';
import { SupplierIntegrationRepository } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { SpocketCatalogItemRepository } from '../../infrastructure/repositories/spocketCatalogItemRepository';
import { spocketClient } from '../../infrastructure/external/spocketClient';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';
import { serializeSpocketCatalogItem } from '../serializers/spocketCatalogItemSerializer';

function parseSupplierIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'supplierId' must be a valid integer");
  return id;
}

const spocketCatalogSyncService = new SpocketCatalogSyncService(
  new SupplierIntegrationRepository(),
  new SpocketCatalogItemRepository(),
  spocketClient
);

export async function sync(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const result = await spocketCatalogSyncService.syncCatalog(supplierId);
    logger.info('Spocket catalog sync completed', { supplierId, ...result });
    res.json({ success: true, data: result, message: 'Spocket catalog sync completed' });
  } catch (err) {
    next(err);
  }
}

export async function listCatalog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const { page, pageSize, syncStatus } = req.query;

    if (syncStatus !== undefined && syncStatus !== 'Synced' && syncStatus !== 'Failed') {
      throw new ValidationError("Query param 'syncStatus' must be one of: Synced, Failed");
    }

    const result = await spocketCatalogSyncService.listStagedCatalog(supplierId, {
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
      syncStatus: syncStatus as string | undefined,
    });
    const data = { ...result, items: result.items.map(serializeSpocketCatalogItem) };
    res.json({ success: true, data, message: 'Staged Spocket catalog retrieved successfully' });
  } catch (err) {
    next(err);
  }
}
