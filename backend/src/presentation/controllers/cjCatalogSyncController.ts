import { Request, Response, NextFunction } from 'express';
import { CjCatalogSyncService } from '../../application/services/cjCatalogSyncService';
import { SupplierIntegrationRepository } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { CjCatalogItemRepository } from '../../infrastructure/repositories/cjCatalogItemRepository';
import { cjClient } from '../../infrastructure/external/cjClient';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';
import { serializeCjCatalogItem } from '../serializers/cjCatalogItemSerializer';

function parseSupplierIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'supplierId' must be a valid integer");
  return id;
}

const cjCatalogSyncService = new CjCatalogSyncService(
  new SupplierIntegrationRepository(),
  new CjCatalogItemRepository(),
  cjClient
);

export async function sync(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const result = await cjCatalogSyncService.syncCatalog(supplierId);
    logger.info('CJ Dropshipping catalog sync completed', { supplierId, ...result });
    res.json({ success: true, data: result, message: 'CJ Dropshipping catalog sync completed' });
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

    const result = await cjCatalogSyncService.listStagedCatalog(supplierId, {
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
      syncStatus: syncStatus as string | undefined,
    });
    const data = { ...result, items: result.items.map(serializeCjCatalogItem) };
    res.json({ success: true, data, message: 'Staged CJ Dropshipping catalog retrieved successfully' });
  } catch (err) {
    next(err);
  }
}
