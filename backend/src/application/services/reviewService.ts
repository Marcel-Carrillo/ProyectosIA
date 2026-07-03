import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prismaClient';
import { Review, ReviewStatus, isValidReviewTransition } from '../../domain/models/review';
import {
  IReviewRepository,
  ReviewListFilters,
  ReviewListResult,
  ReviewSummary,
} from '../../domain/repositories/reviewRepository';
import { ICustomerRepository } from '../../domain/repositories/customerRepository';
import {
  ReviewNotFoundError,
  ReviewPurchaseNotVerifiedError,
  ReviewTransitionInvalidError,
} from '../../infrastructure/repositories/reviewRepository';
import { CustomerNotFoundError } from '../../infrastructure/repositories/customerRepository';
import { validateReviewData, validateReviewStatusUpdate } from '../validator';

function buildAuthorNameSnapshot(firstName: string, lastName: string): string {
  const initial = lastName.trim().charAt(0).toUpperCase();
  return initial ? `${firstName.trim()} ${initial}.` : firstName.trim();
}

export interface ReviewEligibility {
  canReview: boolean;
  reason: 'eligible' | 'not_purchased' | 'already_reviewed';
}

export class ReviewService {
  constructor(
    private readonly reviewRepository: IReviewRepository,
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async checkEligibility(customerId: number, productId: number): Promise<ReviewEligibility> {
    const alreadyReviewed = await this.reviewRepository.hasExistingReview(customerId, productId);
    if (alreadyReviewed) return { canReview: false, reason: 'already_reviewed' };

    const purchase = await this.reviewRepository.hasVerifiedPurchase(customerId, productId);
    if (!purchase.verified) return { canReview: false, reason: 'not_purchased' };

    return { canReview: true, reason: 'eligible' };
  }

  async submitReview(customerId: number, input: Record<string, unknown>): Promise<Review> {
    validateReviewData(input);

    const productId = input['productId'] as number;
    const rating = input['rating'] as number;
    const title = (input['title'] as string | null | undefined) ?? null;
    const body = (input['body'] as string | null | undefined) ?? null;

    const purchase = await this.reviewRepository.hasVerifiedPurchase(customerId, productId);
    if (!purchase.verified) throw new ReviewPurchaseNotVerifiedError();

    const customer = await this.customerRepository.findById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    const authorNameSnapshot = buildAuthorNameSnapshot(customer.firstName, customer.lastName);

    // Uniqueness is enforced by the DB constraint inside repo.create() (P2002 -> ReviewAlreadyExistsError).
    return this.reviewRepository.create({
      productId,
      customerId,
      customerOrderItemId: purchase.customerOrderItemId,
      rating,
      title,
      body,
      authorNameSnapshot,
    });
  }

  async listOwnReviews(customerId: number, page?: number, limit?: number): Promise<ReviewListResult> {
    return this.reviewRepository.findByCustomerId(customerId, page, limit);
  }

  async listApprovedForProduct(productId: number, page?: number, limit?: number): Promise<ReviewListResult> {
    return this.reviewRepository.findApprovedByProductId(productId, page, limit);
  }

  async getSummaryForProduct(productId: number): Promise<ReviewSummary> {
    return this.reviewRepository.getApprovedSummary(productId);
  }

  async listModerationQueue(filters: ReviewListFilters): Promise<ReviewListResult> {
    return this.reviewRepository.findPendingQueue(filters);
  }

  async getById(id: number): Promise<Review> {
    const review = await this.reviewRepository.findById(id);
    if (!review) throw new ReviewNotFoundError();
    return review;
  }

  async moderateReview(
    id: number,
    adminUserId: number,
    input: Record<string, unknown>
  ): Promise<Review> {
    validateReviewStatusUpdate(input);
    const newStatus = input['status'] as ReviewStatus;
    const moderationNote = (input['moderationNote'] as string | null | undefined) ?? null;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.review.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!existing) throw new ReviewNotFoundError();

      if (!isValidReviewTransition(existing.status as ReviewStatus, newStatus)) {
        throw new ReviewTransitionInvalidError(
          `Cannot transition review from ${existing.status} to ${newStatus}`
        );
      }

      const now = new Date();
      const updated = await tx.review.update({
        where: { id },
        data: {
          status: newStatus,
          moderatedByAdminUserId: adminUserId,
          moderationNote,
          moderatedAt: now,
          ...(newStatus === 'Approved' && { publishedAt: now }),
        },
      });

      return new Review({ ...updated });
    });
  }

  async deleteReview(id: number): Promise<void> {
    await this.reviewRepository.delete(id);
  }
}
