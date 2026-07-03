import { Request, Response, NextFunction } from 'express';
import { ReviewService } from '../../application/services/reviewService';
import { ReviewRepository } from '../../infrastructure/repositories/reviewRepository';
import { CustomerRepository } from '../../infrastructure/repositories/customerRepository';
import { ValidationError } from '../../application/validator';
import { logger } from '../../infrastructure/logger';
import { serializePublicReview } from '../serializers/publicReview';

function parseOptionalQueryInt(value: unknown, paramName: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    throw new ValidationError(`Query parameter '${paramName}' must be a valid integer`);
  }
  return parsed;
}

const reviewService = new ReviewService(new ReviewRepository(), new CustomerRepository());

export async function getProductReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseOptionalQueryInt(req.params['id'], 'id');
    if (productId === undefined) {
      throw new ValidationError("Parameter 'id' must be a valid integer");
    }
    const { page, limit } = req.query;

    const [list, summary] = await Promise.all([
      reviewService.listApprovedForProduct(
        productId,
        parseOptionalQueryInt(page, 'page'),
        parseOptionalQueryInt(limit, 'limit'),
      ),
      reviewService.getSummaryForProduct(productId),
    ]);

    logger.info('Public product reviews listed', { productId, total: list.total });
    res.json({
      success: true,
      data: {
        items: list.items.map(serializePublicReview),
        total: list.total,
        page: list.page,
        pageSize: list.limit,
        summary: { averageRating: summary.averageRating, reviewCount: summary.reviewCount },
        distribution: summary.distribution,
      },
      message: 'Reviews retrieved successfully',
    });
  } catch (err) {
    next(err);
  }
}
