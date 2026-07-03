import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { reviewService, extractReviewErrorMessage } from '../../services/reviewService';
import { ReviewEligibility } from '../../types/product';

interface ReviewFormProps {
  productId: number;
}

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

const ReviewForm: React.FC<ReviewFormProps> = ({ productId }) => {
  const { isAuthenticated, isLoading: authLoading } = useCustomerAuth();

  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setEligibilityLoading(false);
      return;
    }
    let cancelled = false;
    setEligibilityLoading(true);
    setEligibilityError(null);
    reviewService
      .getEligibility(productId)
      .then((data) => {
        if (!cancelled) setEligibility(data);
      })
      .catch(() => {
        if (!cancelled) setEligibilityError('Unable to check review eligibility.');
      })
      .finally(() => {
        if (!cancelled) setEligibilityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, isAuthenticated, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setValidationError('Please select a star rating.');
      return;
    }
    setValidationError(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      await reviewService.submitReview({
        productId,
        rating,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(body.trim() ? { body: body.trim() } : {}),
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(extractReviewErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="storefront-review-form storefront-review-form--locked" data-testid="review-form-login-required">
        <p>
          <Link to="/login">Log in</Link> to write a review. Only customers who purchased this product can review it.
        </p>
      </div>
    );
  }

  if (eligibilityLoading) {
    return <p className="storefront-review-form__loading" data-testid="review-form-eligibility-loading">Checking review eligibility...</p>;
  }

  if (eligibilityError) {
    return <p className="storefront-alert" role="alert">{eligibilityError}</p>;
  }

  if (submitted) {
    return (
      <div className="storefront-review-form storefront-review-form--success" data-testid="review-submitted">
        <p>Thanks for your review! It is pending moderation and will appear once approved.</p>
      </div>
    );
  }

  if (eligibility?.reason === 'already_reviewed') {
    return (
      <div className="storefront-review-form storefront-review-form--locked" data-testid="review-already-submitted">
        <p>You have already reviewed this product.</p>
      </div>
    );
  }

  if (!eligibility?.canReview) {
    return (
      <div className="storefront-review-form storefront-review-form--locked" data-testid="review-purchase-required">
        <p>Only customers who purchased this product can write a review.</p>
      </div>
    );
  }

  return (
    <form className="storefront-review-form" onSubmit={handleSubmit} data-testid="review-form">
      <h3 className="storefront-review-form__title">Write a review</h3>

      {submitError && <p className="storefront-alert" role="alert">{submitError}</p>}
      {validationError && <p className="storefront-review-form__validation" role="alert">{validationError}</p>}

      <div className="storefront-review-form__stars" role="radiogroup" aria-label="Rating">
        {STAR_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={rating === v}
            aria-label={`${v} star${v === 1 ? '' : 's'}`}
            className={`storefront-review-form__star${v <= rating ? ' storefront-review-form__star--active' : ''}`}
            onClick={() => setRating(v)}
          >
            ★
          </button>
        ))}
      </div>

      <label className="storefront-field">
        <span className="storefront-field__label">Title (optional)</span>
        <input
          className="storefront-field__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={150}
        />
      </label>

      <label className="storefront-field">
        <span className="storefront-field__label">Review (optional)</span>
        <textarea
          className="storefront-field__input storefront-field__textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={4}
        />
      </label>

      <button type="submit" className="storefront-btn storefront-btn--primary" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit review'}
      </button>
    </form>
  );
};

export default ReviewForm;
