import { Response, NextFunction } from 'express';
import { CustomerAuthRequest } from '../../middleware/requireCustomerAuth';
import { ReviewService } from '../../application/services/reviewService';
import { ReviewRepository } from '../../infrastructure/repositories/reviewRepository';
import { CustomerRepository } from '../../infrastructure/repositories/customerRepository';
import { ValidationError } from '../../application/validator';
import { serializeOwnReview } from '../serializers/publicReview';

const reviewService = new ReviewService(new ReviewRepository(), new CustomerRepository());

export async function getReviewEligibility(req: CustomerAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseInt(req.params['productId'] as string, 10);
    if (Number.isNaN(productId)) {
      throw new ValidationError("Parameter 'productId' must be a valid integer");
    }
    const eligibility = await reviewService.checkEligibility(req.customer!.customerId, productId);
    res.json({ success: true, data: eligibility, message: 'Review eligibility retrieved' });
  } catch (err) {
    next(err);
  }
}

export async function submitReview(req: CustomerAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const review = await reviewService.submitReview(req.customer!.customerId, req.body as Record<string, unknown>);
    res.status(201).json({ success: true, data: serializeOwnReview(review), message: 'Review submitted for moderation' });
  } catch (err) {
    next(err);
  }
}

export async function listOwnReviews(req: CustomerAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = req.query;
    const result = await reviewService.listOwnReviews(
      req.customer!.customerId,
      page ? parseInt(String(page), 10) : undefined,
      limit ? parseInt(String(limit), 10) : undefined,
    );
    res.json({
      success: true,
      data: { items: result.items.map(serializeOwnReview), total: result.total, page: result.page, pageSize: result.limit },
      message: 'Your reviews retrieved',
    });
  } catch (err) {
    next(err);
  }
}
