import { Request, Response, NextFunction } from 'express';
import { CustomerOrderService } from '../../application/services/customerOrderService';
import { CustomerOrderRepository } from '../../infrastructure/repositories/customerOrderRepository';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';

function parseIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) {
    throw new ValidationError("Parameter 'id' must be a valid integer");
  }
  return id;
}

const customerOrderService = new CustomerOrderService(new CustomerOrderRepository());

export async function listCustomerOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, status, paymentStatus, fulfillmentStatus, customerId, page, pageSize, sort, order } =
      req.query;
    const result = await customerOrderService.findAll({
      search: search as string | undefined,
      status: status as string | undefined,
      paymentStatus: paymentStatus as string | undefined,
      fulfillmentStatus: fulfillmentStatus as string | undefined,
      customerId: customerId ? parseInt(String(customerId), 10) : undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
      sort: sort as 'createdAt' | 'totalAmount' | 'orderNumber' | undefined,
      order: order === 'asc' ? 'asc' : order === 'desc' ? 'desc' : undefined,
    });
    logger.info('Customer orders listed', { total: result.total, page: result.page });
    res.json({ success: true, data: result, message: 'Customer orders retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerOrderById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const order = await customerOrderService.findById(id);
    res.json({ success: true, data: order, message: 'Customer order retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createCustomerOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await customerOrderService.create(req.body);
    logger.info('Customer order created', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
    });
    res.status(201).json({ success: true, data: order, message: 'Customer order created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateCustomerOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const order = await customerOrderService.updateStatus(id, req.body);
    logger.info('Customer order status updated', {
      orderId: id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
    });
    res.json({ success: true, data: order, message: 'Customer order status updated successfully' });
  } catch (err) {
    next(err);
  }
}
