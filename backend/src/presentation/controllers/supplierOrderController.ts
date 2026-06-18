import { Request, Response, NextFunction } from 'express';
import { SupplierOrderService } from '../../application/services/supplierOrderService';
import { SupplierOrderRepository } from '../../infrastructure/repositories/supplierOrderRepository';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';

function parseIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) {
    throw new ValidationError("Parameter 'id' must be a valid integer");
  }
  return id;
}

const supplierOrderService = new SupplierOrderService(new SupplierOrderRepository());

export async function listSupplierOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, status, customerOrderId, supplierId, page, pageSize, sort, order } = req.query;
    const result = await supplierOrderService.findAll({
      search: search as string | undefined,
      status: status as string | undefined,
      customerOrderId: customerOrderId ? parseInt(String(customerOrderId), 10) : undefined,
      supplierId: supplierId ? parseInt(String(supplierId), 10) : undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
      sort: sort as 'createdAt' | 'supplierOrderNumber' | undefined,
      order: order === 'asc' ? 'asc' : order === 'desc' ? 'desc' : undefined,
    });
    logger.info('Supplier orders listed', { total: result.total, page: result.page });
    res.json({ success: true, data: result, message: 'Supplier orders retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getSupplierOrderById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const order = await supplierOrderService.findById(id);
    res.json({ success: true, data: order, message: 'Supplier order retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createSupplierOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await supplierOrderService.create(req.body);
    logger.info('Supplier order created', {
      supplierOrderId: order.id,
      supplierOrderNumber: order.supplierOrderNumber,
      customerOrderId: order.customerOrderId,
    });
    res.status(201).json({ success: true, data: order, message: 'Supplier order created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateSupplierOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const order = await supplierOrderService.updateStatus(id, req.body);
    logger.info('Supplier order status updated', {
      supplierOrderId: id,
      status: order.status,
    });
    res.json({ success: true, data: order, message: 'Supplier order status updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function generateSupplierOrdersFromCustomerOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const result = await supplierOrderService.generateFromCustomerOrder(id);
    logger.info('Supplier orders generated from customer order', {
      customerOrderId: id,
      count: result.orders.length,
      created: result.created,
    });
    const statusCode = result.created ? 201 : 200;
    const message = result.created
      ? 'Supplier orders created successfully'
      : 'Supplier orders already exist';
    res.status(statusCode).json({
      success: true,
      data: result.orders,
      message,
    });
  } catch (err) {
    next(err);
  }
}
