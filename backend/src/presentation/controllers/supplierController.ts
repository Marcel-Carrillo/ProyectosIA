import { Request, Response, NextFunction } from 'express';
import { SupplierService } from '../../application/services/supplierService';
import { SupplierRepository } from '../../infrastructure/repositories/supplierRepository';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';

// Validates the `:id` path param and throws ValidationError (-> 400) for non-numeric values.
function parseIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) {
    throw new ValidationError("Parameter 'id' must be a valid integer");
  }
  return id;
}

const supplierService = new SupplierService(new SupplierRepository());

export async function listSuppliers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, status, page, pageSize } = req.query;
    const result = await supplierService.findAll({
      search: search as string | undefined,
      status: status as string | undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
    });
    logger.info('Suppliers listed', { total: result.total, page: result.page });
    res.json({ success: true, data: result, message: 'Suppliers retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getSupplierById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const supplier = await supplierService.findById(id);
    res.json({ success: true, data: supplier, message: 'Supplier retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createSupplier(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const supplier = await supplierService.create(req.body);
    logger.info('Supplier created', { supplierId: supplier.id, name: supplier.name });
    res.status(201).json({ success: true, data: supplier, message: 'Supplier created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateSupplier(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const supplier = await supplierService.update(id, req.body);
    logger.info('Supplier updated', { supplierId: id });
    res.json({ success: true, data: supplier, message: 'Supplier updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteSupplier(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    // Soft-delete: returns 200 with the updated supplier (status=Inactive), not 204.
    const supplier = await supplierService.softDelete(id);
    logger.info('Supplier soft-deleted', { supplierId: id });
    res.json({ success: true, data: supplier, message: 'Supplier deactivated successfully' });
  } catch (err) {
    next(err);
  }
}
