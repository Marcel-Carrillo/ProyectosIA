import { Request, Response, NextFunction } from 'express';
import { ReviewService } from '../../application/services/reviewService';
import { ReviewRepository } from '../../infrastructure/repositories/reviewRepository';
import { CustomerRepository } from '../../infrastructure/repositories/customerRepository';
import { ReviewStatus } from '../../domain/models/review';
import { ValidationError } from '../../application/validator';
import { AdminAuthRequest } from '../../middleware/requireAdminAuth';
import { logger } from '../../infrastructure/logger';

function parseIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new ValidationError("Parameter 'id' must be a valid integer");
  return id;
}

const reviewService = new ReviewService(new ReviewRepository(), new CustomerRepository());

export async function listReviewsAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, page, limit } = req.query;
    const result = await reviewService.listModerationQueue({
      status: status as ReviewStatus | undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });
    logger.info('Admin reviews listed', { total: result.total, status });
    res.json({ success: true, data: result, message: 'Reviews retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateReviewStatus(req: AdminAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const review = await reviewService.moderateReview(id, req.admin!.id, req.body as Record<string, unknown>);
    logger.info('Review status updated', { reviewId: review.id, status: review.status, adminId: req.admin!.id });
    res.json({ success: true, data: review, message: 'Review status updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    await reviewService.deleteReview(id);
    logger.info('Review deleted', { reviewId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
