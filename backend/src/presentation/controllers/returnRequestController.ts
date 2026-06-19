import { Request, Response, NextFunction } from 'express';
import { ReturnRequestService } from '../../application/services/returnRequestService';
import { ReturnRequestRepository } from '../../infrastructure/repositories/returnRequestRepository';
import { ReturnRequestStatus } from '../../domain/models/returnRequest';
import { ValidationError } from '../../application/validator';
import { logger } from '../../infrastructure/logger';

function parseIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'id' must be a valid integer");
  return id;
}

const returnRequestService = new ReturnRequestService(new ReturnRequestRepository());

export async function listReturnRequests(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { customerOrderId, status, page, limit } = req.query;
    const result = await returnRequestService.list({
      customerOrderId: customerOrderId ? parseInt(String(customerOrderId), 10) : undefined,
      status: status as ReturnRequestStatus | undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });
    logger.info('Return requests listed', { total: result.total, page: result.page });
    res.json({ success: true, data: result, message: 'Return requests retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getReturnRequestById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const rr = await returnRequestService.getById(id);
    res.json({ success: true, data: rr, message: 'Return request retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createReturnRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rr = await returnRequestService.create(req.body as Record<string, unknown>);
    logger.info('Return request created', {
      returnRequestId: rr.id,
      customerOrderId: rr.customerOrderId,
    });
    res.status(201).json({ success: true, data: rr, message: 'Return request created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateReturnRequestStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const rr = await returnRequestService.updateStatus(id, req.body as Record<string, unknown>);
    logger.info('Return request status updated', { returnRequestId: rr.id, status: rr.status });
    res.json({ success: true, data: rr, message: 'Return request status updated successfully' });
  } catch (err) {
    next(err);
  }
}
