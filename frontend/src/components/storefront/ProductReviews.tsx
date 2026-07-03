import React from 'react';
import Pagination from '../Pagination';
import { Review, ReviewSummary, RatingDistribution } from '../../types/product';

interface ProductReviewsProps {
  summary: ReviewSummary;
  distribution: RatingDistribution | null;
  reviews: Review[];
  isLoading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

function StarsDisplay({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="storefront-reviews__stars" role="img" aria-label={`Rating: ${rating} out of 5`}>
      {STAR_VALUES.map((v) => (
        <span
          key={v}
          aria-hidden="true"
          className={v <= rounded ? 'storefront-star storefront-star--filled' : 'storefront-star'}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const ProductReviews: React.FC<ProductReviewsProps> = ({
  summary,
  distribution,
  reviews,
  isLoading,
  error,
  page,
  totalPages,
  onPageChange,
}) => {
  return (
    <section className="storefront-reviews" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="storefront-reviews__title">Customer reviews</h2>

      {error && (
        <p className="storefront-alert" role="alert">{error}</p>
      )}

      {!error && isLoading && (
        <p className="storefront-reviews__loading" data-testid="reviews-loading">Loading reviews...</p>
      )}

      {!error && !isLoading && summary.reviewCount === 0 && (
        <div className="storefront-empty" data-testid="reviews-empty-state">
          <p className="storefront-empty__title">No reviews yet</p>
          <p>Be the first to review this product.</p>
        </div>
      )}

      {!error && !isLoading && summary.reviewCount > 0 && (
        <>
          <div className="storefront-reviews__summary">
            <div className="storefront-reviews__average">
              <span className="storefront-reviews__average-value">{summary.averageRating!.toFixed(1)}</span>
              <StarsDisplay rating={summary.averageRating!} />
              <span className="storefront-reviews__count">
                ({summary.reviewCount} review{summary.reviewCount === 1 ? '' : 's'})
              </span>
            </div>

            {distribution && (
              <ul className="storefront-reviews__distribution">
                {([5, 4, 3, 2, 1] as const).map((star) => {
                  const count = distribution[star];
                  const pct = summary.reviewCount > 0 ? Math.round((count / summary.reviewCount) * 100) : 0;
                  return (
                    <li key={star} className="storefront-reviews__distribution-row">
                      <span>{star} star</span>
                      <span className="storefront-reviews__bar" aria-hidden="true">
                        <span className="storefront-reviews__bar-fill" style={{ width: `${pct}%` }} />
                      </span>
                      <span>{count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <ul className="storefront-reviews__list">
            {reviews.map((review) => (
              <li key={review.id} className="storefront-review">
                <div className="storefront-review__header">
                  <StarsDisplay rating={review.rating} />
                  <span className="storefront-review__author">{review.authorNameSnapshot}</span>
                  <span className="storefront-review__date">{formatReviewDate(review.createdAt)}</span>
                </div>
                {review.title && <p className="storefront-review__title">{review.title}</p>}
                {review.body && <p className="storefront-review__body">{review.body}</p>}
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
          )}
        </>
      )}
    </section>
  );
};

export default ProductReviews;
