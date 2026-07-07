import { Request, Response, NextFunction } from 'express';
import { CjConnectionService } from '../../application/services/cjConnectionService';
import { SupplierIntegrationRepository } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { cjClient } from '../../infrastructure/external/cjClient';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';

function parseSupplierIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'supplierId' must be a valid integer");
  return id;
}

const cjConnectionService = new CjConnectionService(new SupplierIntegrationRepository(), cjClient);

export async function configure(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const { integration, created } = await cjConnectionService.configureConnection(supplierId, req.body);
    logger.info('CJ Dropshipping connection configured', { supplierId, created });
    res.status(created ? 201 : 200).json({
      success: true,
      data: integration,
      message: created
        ? 'CJ Dropshipping connection created successfully'
        : 'CJ Dropshipping connection updated successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const integration = await cjConnectionService.getConnection(supplierId);
    res.json({ success: true, data: integration, message: 'CJ Dropshipping connection retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function verify(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const result = await cjConnectionService.verifyConnection(supplierId);
    res.json({ success: true, data: result, message: 'CJ Dropshipping connection verification completed' });
  } catch (err) {
    next(err);
  }
}
