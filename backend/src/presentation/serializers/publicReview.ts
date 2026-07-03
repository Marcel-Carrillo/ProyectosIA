import { Review } from '../../domain/models/review';

/**
 * Customer-safe Review DTO. Explicit allow-list: never exposes customerId,
 * moderationNote, moderatedByAdminUserId, or status — matches the same
 * allow-list convention used by publicProduct.ts.
 */
export interface PublicReviewDTO {
  id: number;
  productId: number;
  rating: number;
  title: string | null;
  body: string | null;
  authorNameSnapshot: string;
  createdAt?: Date;
}

export function serializePublicReview(review: Review): PublicReviewDTO {
  return {
    id: review.id!,
    productId: review.productId,
    rating: review.rating,
    title: review.title,
    body: review.body,
    authorNameSnapshot: review.authorNameSnapshot,
    createdAt: review.createdAt,
  };
}

/**
 * The caller's own review — same allow-list as PublicReviewDTO plus `status`,
 * since a customer needs to see whether their own review is Pending/Approved/
 * Rejected. Still never exposes moderationNote/moderatedByAdminUserId.
 */
export interface OwnReviewDTO extends PublicReviewDTO {
  status: string;
}

export function serializeOwnReview(review: Review): OwnReviewDTO {
  return {
    ...serializePublicReview(review),
    status: review.status,
  };
}
