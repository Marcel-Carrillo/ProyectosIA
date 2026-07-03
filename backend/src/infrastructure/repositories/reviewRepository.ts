import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { Review } from '../../domain/models/review';
import {
  IReviewRepository,
  ReviewListFilters,
  ReviewListResult,
  ReviewCreateData,
  ReviewStatusUpdateData,
  ReviewPurchaseCheck,
  ReviewSummary,
} from '../../domain/repositories/reviewRepository';

export class ReviewNotFoundError extends Error {
  readonly code = 'REVIEW_NOT_FOUND' as const;
  readonly status = 404;
  constructor() {
    super('Review not found');
    this.name = 'ReviewNotFoundError';
    Object.setPrototypeOf(this, ReviewNotFoundError.prototype);
  }
}

export class ReviewAlreadyExistsError extends Error {
  readonly code = 'REVIEW_ALREADY_EXISTS' as const;
  readonly status = 409;
  constructor() {
    super('You have already submitted a review for this product');
    this.name = 'ReviewAlreadyExistsError';
    Object.setPrototypeOf(this, ReviewAlreadyExistsError.prototype);
  }
}

export class ReviewPurchaseNotVerifiedError extends Error {
  readonly code = 'REVIEW_PURCHASE_NOT_VERIFIED' as const;
  readonly status = 403;
  constructor() {
    super('A verified purchase of this product is required to submit a review');
    this.name = 'ReviewPurchaseNotVerifiedError';
    Object.setPrototypeOf(this, ReviewPurchaseNotVerifiedError.prototype);
  }
}

export class ReviewTransitionInvalidError extends Error {
  readonly code = 'REVIEW_TRANSITION_INVALID' as const;
  readonly status = 409;
  constructor(message = 'Invalid review status transition') {
    super(message);
    this.name = 'ReviewTransitionInvalidError';
    Object.setPrototypeOf(this, ReviewTransitionInvalidError.prototype);
  }
}

const reviewSelect = {
  id: true,
  productId: true,
  customerId: true,
  customerOrderItemId: true,
  rating: true,
  title: true,
  body: true,
  authorNameSnapshot: true,
  status: true,
  moderatedByAdminUserId: true,
  moderationNote: true,
  moderatedAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

function mapReview(row: ReviewRow): Review {
  return new Review({ ...row });
}

export class ReviewRepository implements IReviewRepository {
  async create(data: ReviewCreateData): Promise<Review> {
    try {
      const row = await prisma.review.create({
        data: {
          productId: data.productId,
          customerId: data.customerId,
          customerOrderItemId: data.customerOrderItemId,
          rating: data.rating,
          title: data.title ?? null,
          body: data.body ?? null,
          authorNameSnapshot: data.authorNameSnapshot,
          status: 'Pending',
        },
        select: reviewSelect,
      });
      return mapReview(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ReviewAlreadyExistsError();
      }
      throw err;
    }
  }

  async findById(id: number): Promise<Review | null> {
    const row = await prisma.review.findUnique({ where: { id }, select: reviewSelect });
    return row ? mapReview(row) : null;
  }

  async findApprovedByProductId(productId: number, page = 1, limit = 10): Promise<ReviewListResult> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const boundedPage = Math.max(page, 1);
    const skip = (boundedPage - 1) * boundedLimit;

    const where: Prisma.ReviewWhereInput = { productId, status: 'Approved' };
    const [rows, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: boundedLimit,
        select: reviewSelect,
      }),
      prisma.review.count({ where }),
    ]);
    return { items: rows.map(mapReview), total, page: boundedPage, limit: boundedLimit };
  }

  async findByCustomerId(customerId: number, page = 1, limit = 20): Promise<ReviewListResult> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const boundedPage = Math.max(page, 1);
    const skip = (boundedPage - 1) * boundedLimit;

    const where: Prisma.ReviewWhereInput = { customerId };
    const [rows, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: boundedLimit,
        select: reviewSelect,
      }),
      prisma.review.count({ where }),
    ]);
    return { items: rows.map(mapReview), total, page: boundedPage, limit: boundedLimit };
  }

  async findPendingQueue(filters: ReviewListFilters): Promise<ReviewListResult> {
    const page = filters.page && filters.page >= 1 ? filters.page : 1;
    const limit = filters.limit && filters.limit >= 1 ? Math.min(filters.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {};
    if (filters.status) where.status = filters.status;

    const [rows, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        select: reviewSelect,
      }),
      prisma.review.count({ where }),
    ]);
    return { items: rows.map(mapReview), total, page, limit };
  }

  async updateStatus(id: number, data: ReviewStatusUpdateData): Promise<Review> {
    try {
      const now = new Date();
      const row = await prisma.review.update({
        where: { id },
        data: {
          status: data.status,
          moderatedByAdminUserId: data.moderatedByAdminUserId,
          moderationNote: data.moderationNote ?? null,
          moderatedAt: now,
          ...(data.status === 'Approved' && { publishedAt: now }),
        },
        select: reviewSelect,
      });
      return mapReview(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ReviewNotFoundError();
      }
      throw err;
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await prisma.review.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ReviewNotFoundError();
      }
      throw err;
    }
  }

  async hasVerifiedPurchase(customerId: number, productId: number): Promise<ReviewPurchaseCheck> {
    const item = await prisma.customerOrderItem.findFirst({
      where: {
        productVariant: { productId },
        customerOrder: { customerId, paymentStatus: 'Paid' },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return { verified: !!item, customerOrderItemId: item?.id ?? null };
  }

  async hasExistingReview(customerId: number, productId: number): Promise<boolean> {
    const existing = await prisma.review.findUnique({
      where: { customerId_productId: { customerId, productId } },
      select: { id: true },
    });
    return !!existing;
  }

  async getApprovedSummary(productId: number): Promise<ReviewSummary> {
    const [aggregate, groups] = await Promise.all([
      prisma.review.aggregate({
        where: { productId, status: 'Approved' },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.review.groupBy({
        by: ['rating'],
        where: { productId, status: 'Approved' },
        orderBy: { rating: 'asc' },
        _count: { rating: true },
      }),
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const g of groups) {
      if (g.rating >= 1 && g.rating <= 5) {
        distribution[g.rating as 1 | 2 | 3 | 4 | 5] = g._count.rating;
      }
    }

    return {
      reviewCount: aggregate._count._all,
      averageRating: aggregate._count._all > 0 ? aggregate._avg.rating : null,
      distribution,
    };
  }
}
