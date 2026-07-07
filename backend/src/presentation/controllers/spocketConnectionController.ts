import { Request, Response, NextFunction } from 'express';
import { SpocketConnectionService } from '../../application/services/spocketConnectionService';
import { SupplierIntegrationRepository } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { spocketClient } from '../../infrastructure/external/spocketClient';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';

function parseSupplierIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'supplierId' must be a valid integer");
  return id;
}

const spocketConnectionService = new SpocketConnectionService(
  new SupplierIntegrationRepository(),
  spocketClient
);

export async function configure(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const { integration, created } = await spocketConnectionService.configureConnection(
      supplierId,
      req.body
    );
    logger.info('Spocket connection configured', { supplierId, created });
    res.status(created ? 201 : 200).json({
      success: true,
      data: integration,
      message: created ? 'Spocket connection created successfully' : 'Spocket connection updated successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const integration = await spocketConnectionService.getConnection(supplierId);
    res.json({ success: true, data: integration, message: 'Spocket connection retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function verify(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplierId = parseSupplierIdParam(req.params['supplierId'] as string);
    const result = await spocketConnectionService.verifyConnection(supplierId);
    res.json({ success: true, data: result, message: 'Spocket connection verification completed' });
  } catch (err) {
    next(err);
  }
}
