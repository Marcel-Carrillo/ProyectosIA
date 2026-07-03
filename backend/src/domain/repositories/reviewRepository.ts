import { Review, ReviewStatus } from '../models/review';

export interface ReviewListFilters {
  status?: ReviewStatus;
  page?: number;
  limit?: number;
}

export interface ReviewListResult {
  items: Review[];
  total: number;
  page: number;
  limit: number;
}

export interface ReviewCreateData {
  productId: number;
  customerId: number;
  customerOrderItemId: number | null;
  rating: number;
  title?: string | null;
  body?: string | null;
  authorNameSnapshot: string;
}

export interface ReviewStatusUpdateData {
  status: ReviewStatus;
  moderatedByAdminUserId: number;
  moderationNote?: string | null;
}

export interface ReviewPurchaseCheck {
  verified: boolean;
  customerOrderItemId: number | null;
}

export interface ReviewRatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ReviewSummary {
  averageRating: number | null;
  reviewCount: number;
  distribution: ReviewRatingDistribution;
}

export interface IReviewRepository {
  create(data: ReviewCreateData): Promise<Review>;
  findById(id: number): Promise<Review | null>;
  findApprovedByProductId(productId: number, page?: number, limit?: number): Promise<ReviewListResult>;
  findByCustomerId(customerId: number, page?: number, limit?: number): Promise<ReviewListResult>;
  findPendingQueue(filters: ReviewListFilters): Promise<ReviewListResult>;
  updateStatus(id: number, data: ReviewStatusUpdateData): Promise<Review>;
  delete(id: number): Promise<void>;
  hasVerifiedPurchase(customerId: number, productId: number): Promise<ReviewPurchaseCheck>;
  hasExistingReview(customerId: number, productId: number): Promise<boolean>;
  getApprovedSummary(productId: number): Promise<ReviewSummary>;
}
