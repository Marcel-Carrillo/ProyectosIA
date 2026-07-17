import { Request, Response, NextFunction } from 'express';
import { CjCatalogPromotionService } from '../../application/services/cjCatalogPromotionService';
import { CjCategoryBackfillService } from '../../application/services/cjCategoryBackfillService';
import { CjCatalogItemRepository } from '../../infrastructure/repositories/cjCatalogItemRepository';
import { CategoryRepository } from '../../infrastructure/repositories/categoryRepository';
import { ProductRepository } from '../../infrastructure/repositories/productRepository';
import { ProductVariantRepository } from '../../infrastructure/repositories/productVariantRepository';
import { ProductTranslationRepository } from '../../infrastructure/repositories/productTranslationRepository';
import { ProductService } from '../../application/services/productService';
import { SupplierIntegrationRepository } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { AutomationSettingsRepository } from '../../infrastructure/repositories/automationSettingsRepository';
import { cjClient } from '../../infrastructure/external/cjClient';
import { ValidationError, validateCjPromotionData } from '../../application/validator';

function parseSupplierIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'supplierId' must be a valid integer");
  return id;
}

function parseCjCatalogItemIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'cjCatalogItemId' must be a valid integer");
  return id;
}

const productVariantRepository = new ProductVariantRepository();
const cjCatalogPromotionService = new CjCatalogPromotionService(
  new CjCatalogItemRepository(),
  new CategoryRepository(),
  new ProductService(new ProductRepository(), productVariantRepository, new ProductTranslationRepository()),
  productVariantRepository,
  new SupplierIntegrationRepository(),
  new AutomationSettingsRepository(),
  cjClient
);
const cjCategoryBackfillService = new CjCategoryBackfillService(
  new ProductRepository(),
  productVariantRepository,
  new CategoryRepository(),
  new CjCatalogItemRepository(),
  new SupplierIntegrationRepository(),
  cjClient
);

export async function promote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const input = validateCjPromotionData(req.body as Record<string, unknown>);
    const result = await cjCatalogPromotionService.promote(supplierId, input);
    const statusCode = result.createdAny ? 201 : 200;
    res.status(statusCode).json({ success: true, data: result, message: 'CJ catalog items promoted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function activate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const cjCatalogItemId = parseCjCatalogItemIdParam(req.params['cjCatalogItemId'] as string);
    const result = await cjCatalogPromotionService.activate(supplierId, cjCatalogItemId);
    res.json({ success: true, data: result, message: 'CJ catalog item activated' });
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const cjCatalogItemId = parseCjCatalogItemIdParam(req.params['cjCatalogItemId'] as string);
    const result = await cjCatalogPromotionService.deactivate(supplierId, cjCatalogItemId);
    res.json({ success: true, data: result, message: 'CJ catalog item deactivated' });
  } catch (err) {
    next(err);
  }
}

export async function recategorize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    // Optional per-call batch size (see cjCategoryBackfillService.ts's
    // DEFAULT_BATCH_LIMIT comment — the underlying operation is deliberately
    // bounded per call to stay inside the `app` Lambda's timeout; call again
    // while `hasMore` is true to work through a large backlog).
    const rawLimit = req.query['limit'];
    const limit = typeof rawLimit === 'string' && rawLimit.trim() !== '' ? Number(rawLimit) : undefined;
    const result = await cjCategoryBackfillService.recategorize(supplierId, limit);
    res.json({ success: true, data: result, message: 'CJ category backfill batch completed' });
  } catch (err) {
    next(err);
  }
}

export async function freightEstimate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const cjCatalogItemId = parseCjCatalogItemIdParam(req.params['cjCatalogItemId'] as string);
    const destinationCountry = typeof req.query['destinationCountry'] === 'string' ? req.query['destinationCountry'] : undefined;
    const result = await cjCatalogPromotionService.estimateFreight(supplierId, cjCatalogItemId, destinationCountry);
    res.json({ success: true, data: result, message: 'CJ catalog item freight estimate retrieved' });
  } catch (err) {
    next(err);
  }
}
