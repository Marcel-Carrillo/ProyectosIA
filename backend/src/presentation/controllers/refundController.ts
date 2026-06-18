import { Request, Response, NextFunction } from 'express';
import { RefundService } from '../../application/services/refundService';
import { RefundRepository } from '../../infrastructure/repositories/refundRepository';
import { RefundStatus } from '../../domain/models/refund';
import { ValidationError } from '../../application/validator';
import { logger } from '../../infrastructure/logger';

function parseIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'id' must be a valid integer");
  return id;
}

const refundService = new RefundService(new RefundRepository());

export async function listRefunds(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { customerOrderId, status, page, limit } = req.query;
    const result = await refundService.list({
      customerOrderId: customerOrderId ? parseInt(String(customerOrderId), 10) : undefined,
      status: status as RefundStatus | undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });
    logger.info('Refunds listed', { total: result.total, page: result.page });
    res.json({ success: true, data: result, message: 'Refunds retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getRefundById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const refund = await refundService.getById(id);
    res.json({ success: true, data: refund, message: 'Refund retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createRefund(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refund = await refundService.create(req.body as Record<string, unknown>);
    logger.info('Refund created', { refundId: refund.id, customerOrderId: refund.customerOrderId });
    res.status(201).json({ success: true, data: refund, message: 'Refund created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateRefundStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const refund = await refundService.updateStatus(id, req.body as Record<string, unknown>);
    logger.info('Refund status updated', { refundId: refund.id, status: refund.status });
    res.json({ success: true, data: refund, message: 'Refund status updated successfully' });
  } catch (err) {
    next(err);
  }
}
