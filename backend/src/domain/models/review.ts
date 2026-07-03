export type ReviewStatus = 'Pending' | 'Approved' | 'Rejected';

export const REVIEW_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  Pending: ['Approved', 'Rejected'],
  Approved: [],
  Rejected: [],
};

export function isValidReviewTransition(from: ReviewStatus, to: ReviewStatus): boolean {
  return REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
}

export class Review {
  id?: number;
  productId: number;
  customerId: number;
  customerOrderItemId: number | null;
  rating: number;
  title: string | null;
  body: string | null;
  authorNameSnapshot: string;
  status: ReviewStatus;
  moderatedByAdminUserId: number | null;
  moderationNote: string | null;
  moderatedAt: Date | null;
  publishedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    productId: number;
    customerId: number;
    customerOrderItemId?: number | null;
    rating: number;
    title?: string | null;
    body?: string | null;
    authorNameSnapshot: string;
    status?: string;
    moderatedByAdminUserId?: number | null;
    moderationNote?: string | null;
    moderatedAt?: Date | null;
    publishedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.productId = data.productId;
    this.customerId = data.customerId;
    this.customerOrderItemId = data.customerOrderItemId ?? null;
    this.rating = data.rating;
    this.title = data.title ?? null;
    this.body = data.body ?? null;
    this.authorNameSnapshot = data.authorNameSnapshot;
    this.status = (data.status as ReviewStatus) ?? 'Pending';
    this.moderatedByAdminUserId = data.moderatedByAdminUserId ?? null;
    this.moderationNote = data.moderationNote ?? null;
    this.moderatedAt = data.moderatedAt ?? null;
    this.publishedAt = data.publishedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
