# Frontend Implementation Plan — product-customer-reviews (tasks.md §7-9)

Planning only. No files were edited while producing this plan. All line numbers below
reference the actual current content of files on `feature/product-customer-reviews`
(branched from `develop`, which does **not** include the `product-gtin-identifier`
commit — `ProductPage.tsx`'s `productJsonLd` does not yet have `gtin`/`hasMerchantReturnPolicy`
beyond what is quoted below; verify line numbers again before editing since other
agents/sections may land first).

## Conventions confirmed by reading the actual current source (not assumed)

- **PDP hardcodes English strings, does not use `t()`.** `ProductPage.tsx` imports
  `useTranslation` only for `i18n.language` (line 24, refetch trigger) — every visible
  string in the file (`"Add to cart"`, `"Shipping"`, `"Free from €100"`, `"Product not found"`,
  etc.) is a hardcoded English literal. `ProductCard.tsx` is the same. This is different
  from `/account/*` pages (`AccountWishlistPage.tsx`, `LoginPage.tsx`), which use
  `useTranslation('account'|'auth')` + JSON locale files. **`ProductReviews.tsx` and
  `ReviewForm.tsx` must follow the PDP's own convention (hardcoded English strings, no
  `t()`, no new locale-file entries)** — confirmed by explicit instruction to check this,
  and by direct inspection of `ProductPage.tsx`/`ProductCard.tsx`.
- **Service layer**: two shapes coexist. Object-literal (`export const xService = {...}`,
  used by `productService.ts`, `adminProductService.ts`, `returnRequestService.ts`) and
  standalone-functions (`wishlistService.ts`, `customerAuthService.ts`). Authenticated
  customer-facing services (`wishlistService.ts`) fetch the bearer token per-call via
  `getCustomerAccessToken()` from `customerAuthService.ts` — **no axios instance/interceptor
  is used for auth**, just a plain `authHeaders()` helper called at each request site.
  `reviewService.ts` below mirrors `adminProductService.ts`'s object-literal + error-mapping
  style (for discoverability/testability) but reuses `wishlistService.ts`'s
  `getCustomerAccessToken()`-based `authHeaders()` for the two account-scoped calls.
- **Error envelope**: `{ success: false, error: { code: string, message: string } }`
  (see `AdminApiError`/`AuthApiError` in `types/product.ts`/`types/auth.ts`). Every
  existing service has a `mapXError(code)` + `extractXErrorMessage(error)` pair
  (`adminProductService.mapProductError`/`extractErrorMessage`,
  `returnRequestService.mapReturnRequestError`). `reviewService.ts` follows the same pair.
- **JSON-LD escaping**: `Seo.tsx` (`frontend/src/components/storefront/Seo.tsx` lines 49-55)
  does `JSON.stringify(block).replace(/</g, '\\u003c')` inside a `<script type="application/ld+json">`.
  This is the **only** escaping mechanism in the codebase for JSON-LD (confirmed via
  `Seo.test.tsx` lines 39-45, which already asserts `</script>` cannot break out). Review
  `title`/`body` must be passed into `productJsonLd` as plain strings with **no extra
  escaping/sanitization added in `ProductPage.tsx`** — `Seo` handles it exactly like it
  already handles `product.name`/`product.description`.
- **Pagination**: `frontend/src/components/Pagination.tsx` (shared, i18n-driven, `common`
  namespace) is re-exported at `frontend/src/components/storefront/Pagination.tsx`. Reuse
  it in `ProductReviews.tsx` rather than building new pagination controls.
- **Presentational vs. fetching split**: `ProductPage.tsx` fetches `Product` itself and
  passes plain data down to `ProductGallery`/`VariantSelector` (no fetching inside those).
  `ProductReviews.tsx` follows the same pattern (see "Design decision" below) —
  `ReviewForm.tsx` is the exception because its data (auth state + eligibility) has an
  independent lifecycle from the product fetch.
- **No star-rating / review UI exists anywhere in the codebase today** (admin or
  storefront) — confirmed via grep. Built from scratch; only reuses existing generic
  classes (`storefront-alert`, `storefront-empty`, `storefront-btn`, `storefront-field`,
  `storefront-field__input`, `storefront-field__textarea` — the last two are **combined**
  on one element per `ContentPage.tsx:111`: `className="storefront-field__input storefront-field__textarea"`).

## Design decision (not spelled out in tasks.md — flagging explicitly)

**`ProductPage.tsx` owns the approved-reviews list fetch, not `ProductReviews.tsx`.**

`GET /api/public/products/:id` only embeds the compact `reviewSummary` (per
`design.md`'s explicit decision), not the full review array. But task 9.1 requires the
JSON-LD `review` array to be "built from the approved reviews available on the page" —
i.e. `ProductPage.tsx` needs the actual review objects, not just the count/average. Two
options: (a) `ProductReviews.tsx` fetches its own list internally (duplicate-fetch risk,
and `ProductPage.tsx` would have no access to that data for JSON-LD), or (b)
`ProductPage.tsx` fetches the approved list once via `reviewService.listApprovedForProduct`
and passes it down as props to a purely presentational `ProductReviews.tsx`, reusing the
exact same array for both the visible list and the JSON-LD `review` block. **Chosen: (b)**
— it's the only option that guarantees the JSON-LD never disagrees with what's rendered on
the page (the spec's own concern), and it matches the existing `ProductGallery`/`VariantSelector`
precedent of "`ProductPage` fetches, children render". `product.reviewSummary` (from the
product fetch, available at first paint) is still used as the source of truth for
`averageRating`/`reviewCount` everywhere (summary card AND `aggregateRating`), so the
average/count never flicker while the paginated list loads.

**Safety refinement to task 9.1's literal wording**: task 9.1 says gate JSON-LD purely on
`product.reviewSummary.reviewCount >= 1`. This plan additionally gates on
`!reviewsLoading && !reviewsError` (i.e., only emit `aggregateRating`/`review` once the
review-list fetch has actually resolved). Rationale: if the list fetch is still pending or
failed, emitting `aggregateRating` (from `reviewSummary`, already available) together with
an empty `review: []` array would technically satisfy "omit when reviewCount === 0" but
would produce a mismatched/incomplete `review` array while `reviewCount >= 1` — a real
"could still ... carry unwanted markup" style risk the design doc explicitly warns about
for a different reason. Waiting for the list fetch avoids ever emitting a review count that
doesn't match the review array. This delays JSON-LD by one extra (parallel, fast) network
call after product load — acceptable since this is a CSR app (JSON-LD is written after
mount either way, there's no SSR deadline to protect).

---

## 7. Frontend: Types and Service

### 7.1 — `frontend/src/types/product.ts`

Insert a new "Reviews" section **after** the `ProductImage` interface (which currently
ends at line 40) and **before** the `Product` interface (which currently starts at line 42):

```ts
// ─── Reviews ─────────────────────────────────────────────────────────────

export type ReviewStatus = 'Pending' | 'Approved' | 'Rejected';

/** Compact summary embedded directly in GET /api/public/products/:id (Approved-only). */
export interface ReviewSummary {
  averageRating: number | null;
  reviewCount: number;
}

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

/**
 * A single Approved review as returned by public read endpoints. Never includes the
 * reviewer's email or customerId — identity is exposed only as `authorNameSnapshot`.
 */
export interface Review {
  id: number;
  productId: number;
  rating: number;
  title: string | null;
  body: string | null;
  authorNameSnapshot: string;
  createdAt: string;
}

export interface ReviewListResult {
  items: Review[];
  total: number;
  page: number;
  pageSize: number;
  summary: ReviewSummary;
  distribution: RatingDistribution;
}

export interface ReviewListResponse {
  success: boolean;
  data: ReviewListResult;
  message: string;
}

/** GET /api/public/account/products/:productId/review-eligibility (customer auth required). */
export interface ReviewEligibility {
  canReview: boolean;
  alreadyReviewed: boolean;
  hasPurchased: boolean;
}

export interface ReviewEligibilityResponse {
  success: boolean;
  data: ReviewEligibility;
  message: string;
}

/** Body for POST /api/public/account/reviews. */
export interface SubmitReviewInput {
  productId: number;
  rating: number;
  title?: string;
  body?: string;
}

export interface SubmitReviewResponse {
  success: boolean;
  data: Review & { status: ReviewStatus };
  message: string;
}

/** The caller's own review — includes `status` since Pending/Rejected reviews are only visible to their author. */
export interface OwnReview extends Review {
  status: ReviewStatus;
}

export interface OwnReviewListResponse {
  success: boolean;
  data: { items: OwnReview[] };
  message: string;
}
```

Then extend the existing `Product` interface (lines 42-56) by inserting one optional
field right after `translations?: ProductTranslation[];` (line 53) and before `createdAt: string;` (line 54):

```ts
  translations?: ProductTranslation[];
  reviewSummary?: ReviewSummary;
  createdAt: string;
```

No other existing type in `product.ts` needs to change. `reviewSummary` is optional
(`?`) because it is a new, additive field — existing tests/mocks that construct a
`Product` without it (e.g. `ProductPage.test.tsx`'s current `mockGetById` fixture, which
has no `reviewSummary` key) remain valid without modification.

### 7.2 — `frontend/src/services/reviewService.ts` (new file)

```ts
import axios, { AxiosError } from 'axios';
import { getCustomerAccessToken } from './customerAuthService';
import {
  Review,
  ReviewStatus,
  ReviewListResponse,
  ReviewListResult,
  ReviewEligibility,
  ReviewEligibilityResponse,
  SubmitReviewInput,
  SubmitReviewResponse,
  OwnReview,
  OwnReviewListResponse,
} from '../types/product';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const PUBLIC_PRODUCTS_BASE = `${API_BASE_URL}/api/public/products`;
const ACCOUNT_BASE = `${API_BASE_URL}/api/public/account`;

function authHeaders() {
  const token = getCustomerAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Error-code → UI-message mapping ─────────────────────────────────────────
// NOTE (flag for reconciliation with backend plan): these codes are this plan's best
// guess at reviewService.ts's error codes, following the naming convention already used
// by PRODUCT_REQUIRES_ACTIVE_VARIANT / RETURN_REQUEST_TRANSITION_INVALID etc. Confirm the
// exact codes against the backend implementation plan / reviewController before wiring.
export function mapReviewError(code: string): string {
  switch (code) {
    case 'REVIEW_NOT_VERIFIED_BUYER':
      return 'You can only review products you have purchased.';
    case 'REVIEW_ALREADY_EXISTS':
      return 'You have already reviewed this product.';
    case 'REVIEW_VALIDATION_ERROR':
    case 'VALIDATION_ERROR':
      return 'Please check your rating and review text and try again.';
    case 'PRODUCT_NOT_FOUND':
      return 'Product not found.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export function extractReviewErrorMessage(error: unknown): string {
  const code = (error as AxiosError<{ error?: { code?: string } }>).response?.data?.error?.code;
  return mapReviewError(code ?? '');
}

export const reviewService = {
  /** GET /api/public/products/:id/reviews — paginated Approved-only list + summary + distribution. No auth. */
  listApprovedForProduct: async (
    productId: number,
    params?: { page?: number; pageSize?: number }
  ): Promise<ReviewListResult> => {
    try {
      const response = await axios.get<ReviewListResponse>(
        `${PUBLIC_PRODUCTS_BASE}/${productId}/reviews`,
        { params }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching product reviews:', error);
      throw error;
    }
  },

  /** GET /api/public/account/products/:productId/review-eligibility — requires customer auth. */
  getEligibility: async (productId: number): Promise<ReviewEligibility> => {
    try {
      const response = await axios.get<ReviewEligibilityResponse>(
        `${ACCOUNT_BASE}/products/${productId}/review-eligibility`,
        { headers: authHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching review eligibility:', error);
      throw error;
    }
  },

  /** POST /api/public/account/reviews — requires customer auth. Created review always comes back Pending. */
  submitReview: async (input: SubmitReviewInput): Promise<Review & { status: ReviewStatus }> => {
    try {
      const response = await axios.post<SubmitReviewResponse>(
        `${ACCOUNT_BASE}/reviews`,
        input,
        { headers: authHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error submitting review:', error);
      throw error;
    }
  },

  /** GET /api/public/account/reviews — requires customer auth; the caller's own reviews, any status. */
  listOwnReviews: async (): Promise<OwnReview[]> => {
    try {
      const response = await axios.get<OwnReviewListResponse>(`${ACCOUNT_BASE}/reviews`, {
        headers: authHeaders(),
      });
      return response.data.data.items;
    } catch (error) {
      console.error('Error fetching own reviews:', error);
      throw error;
    }
  },
};
```

Notes:
- Deliberately **not** using `productService.ts`'s `publicProductAxios` instance (which
  attaches `Accept-Language`) for `listApprovedForProduct` — review content is
  user-submitted plain text, never translated, so there is nothing for the backend to
  localize; adding the header would be a no-op but implies false localization support.
  Flag this choice for reconciliation if the backend plan turns out to localize anything
  (e.g. a "N reviews" pluralization) — none is described in `design.md`/`spec.md`.
- `listOwnReviews` is unused by `ProductReviews.tsx`/`ReviewForm.tsx` in this plan (no
  "my reviews" account page is listed in tasks §7-9) but is required by task 7.2's
  explicit wording ("list own reviews"). It is wired for future use (e.g. an
  `/account/reviews` page) — out of scope here, flagged in Gaps below.

---

## 8. Frontend: Storefront Reviews UI

### 8.1 — `frontend/src/components/storefront/ProductReviews.tsx` (new file)

Purely presentational — receives already-fetched data from `ProductPage.tsx` (see Design
decision above). Reuses `frontend/src/components/Pagination.tsx`.

```tsx
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
```

### 8.2 — `frontend/src/components/storefront/ReviewForm.tsx` (new file)

Self-contained: reads auth state via `useCustomerAuth()`, fetches its own eligibility
(independent lifecycle from the product fetch — a customer can log in/out without a page
reload), and submits via `reviewService.submitReview`.

```tsx
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

  if (eligibility?.alreadyReviewed) {
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
```

### 8.3 — Wiring into `frontend/src/pages/storefront/ProductPage.tsx`

**Imports** — add after the existing `useCart` import (current line 11):

```tsx
import { useCart } from '../../contexts/CartContext';
import ProductReviews from '../../components/storefront/ProductReviews';
import ReviewForm from '../../components/storefront/ReviewForm';
import { reviewService } from '../../services/reviewService';
import { Review, RatingDistribution } from '../../types/product';
```

**New state** — add after the existing `const { links: categoryLinks } = useStorefrontCategories();` (current line 31):

```tsx
  const { links: categoryLinks } = useStorefrontCategories();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsDistribution, setReviewsDistribution] = useState<RatingDistribution | null>(null);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const REVIEWS_PAGE_SIZE = 5;
```

**New effect** — add immediately after the existing product-fetch `useEffect` (currently
lines 33-56, ending with `}, [id, i18n.language]);`):

```tsx
  useEffect(() => {
    if (!id) return;
    setReviewsLoading(true);
    setReviewsError(null);

    reviewService
      .listApprovedForProduct(Number(id), { page: reviewsPage, pageSize: REVIEWS_PAGE_SIZE })
      .then((result) => {
        setReviews(result.items);
        setReviewsDistribution(result.distribution);
        setReviewsTotalPages(Math.max(1, Math.ceil(result.total / result.pageSize)));
      })
      .catch(() => setReviewsError('Unable to load reviews. Please try again later.'))
      .finally(() => setReviewsLoading(false));
  }, [id, reviewsPage]);
```

Reset `reviewsPage` to 1 whenever the product id changes — add a one-liner inside the
existing product-fetch effect's body (it already resets `notFound`/`error` per id
change), right after `setError(null);` (current line 37):

```tsx
    setIsLoading(true);
    setNotFound(false);
    setError(null);
    setReviewsPage(1);
```

**JSX wiring** — add a new section after the closing `</div>` of `storefront-pdp-grid`
(current line 272) and before the closing `</div>` of `storefront-container` (current
line 273):

```tsx
        </div>

        <div className="storefront-pdp-reviews">
          <ProductReviews
            summary={product.reviewSummary ?? { averageRating: null, reviewCount: 0 }}
            distribution={reviewsDistribution}
            reviews={reviews}
            isLoading={reviewsLoading}
            error={reviewsError}
            page={reviewsPage}
            totalPages={reviewsTotalPages}
            onPageChange={setReviewsPage}
          />
          <ReviewForm productId={product.id} />
        </div>
      </div>
```

(`ProductReviews` first — read existing reviews — then `ReviewForm` below it as the
"write a review" CTA, matching common PDP layout convention.)

### 8.4 — New test files

**`frontend/src/components/storefront/ProductReviews.test.tsx`** (co-located, matching
`VariantSelector.test.tsx`/`Pagination.test.tsx`/`ProductCard.test.tsx` convention —
**not** under a `__tests__/` subfolder, since that subfolder convention is only used
under `pages/storefront/`). Use `renderWithI18n` since `Pagination` pulls the `common`
namespace via `useTranslation`. Cases:

1. `renders empty state when reviewCount is 0` — `summary={{averageRating:null,reviewCount:0}}`,
   `reviews=[]`, `distribution=null` → `await screen.findByTestId('reviews-empty-state')`.
2. `renders average rating, distribution and review list when reviews exist` — 2 reviews,
   `summary={{averageRating:4.5,reviewCount:2}}`, `distribution={5:1,4:1,3:0,2:0,1:0}` →
   assert `screen.findByText('4.5')`, both `authorNameSnapshot`s and `body`s render,
   `aria-label="Rating: 4.5 out of 5"` present.
3. `renders loading state` — `isLoading=true` → `await screen.findByTestId('reviews-loading')`,
   and assert summary/list are NOT rendered even if `summary.reviewCount > 0` is also passed
   (loading takes precedence).
4. `renders error alert and suppresses list/empty state` — `error="Unable to load reviews..."` →
   `await screen.findByRole('alert')`.
5. `renders pagination and calls onPageChange when totalPages > 1` — `page={1} totalPages={3}`
   → `fireEvent.click(await screen.findByLabelText('Next page'))` (i18n `common.pagination.next`
   key, matches `Pagination.test.tsx`'s own assertions) → `expect(onPageChange).toHaveBeenCalledWith(2)`.
6. `does not render pagination when totalPages is 1` — assert `screen.queryByLabelText('Next page')`
   is null.

**`frontend/src/components/storefront/ReviewForm.test.tsx`** (co-located). Mock
`../../contexts/CustomerAuthContext` and `../../services/reviewService` per-test via
`jest.mock` + a mutable mock implementation (mirroring `ProductPage.test.tsx`'s
`jest.mock('../../../services/productService', ...)` pattern one level shallower). Cases:

1. `prompts login when not authenticated` — mock `useCustomerAuth` →
   `{ isAuthenticated: false, isLoading: false }` → `await screen.findByTestId('review-form-login-required')`,
   assert a `Link` to `/login` is present.
2. `shows loading while eligibility is being fetched` — `isAuthenticated: true, isLoading: false`,
   `reviewService.getEligibility` returns a pending (never-resolving in this test) promise →
   `await screen.findByTestId('review-form-eligibility-loading')`.
3. `shows already-reviewed state` — `getEligibility` resolves `{canReview:false, alreadyReviewed:true, hasPurchased:true}`
   → `await screen.findByTestId('review-already-submitted')`.
4. `shows purchase-required state` — resolves `{canReview:false, alreadyReviewed:false, hasPurchased:false}`
   → `await screen.findByTestId('review-purchase-required')`.
5. `renders the form when eligible` — resolves `{canReview:true, alreadyReviewed:false, hasPurchased:true}`
   → `await screen.findByTestId('review-form')`, all 5 star buttons present
   (`screen.getAllByRole('button', { name: /star/i })`), title/body inputs present.
6. `blocks submit with a validation error when no star is selected` — eligible state,
   `fireEvent.click(await screen.findByRole('button', { name: 'Submit review' }))` without
   selecting a star → assert `reviewService.submitReview` was NOT called, and a
   `role="alert"` validation message renders (`await screen.findByRole('alert')`, text
   "Please select a star rating.").
7. `submits successfully and shows the pending-moderation confirmation` — eligible state,
   click a star button (`fireEvent.click(await screen.findByLabelText('4 stars'))`), fill
   title/body via `fireEvent.change`, click submit, mock `submitReview` resolves →
   `await screen.findByTestId('review-submitted')`; assert `submitReview` was called with
   `{ productId, rating: 4, title: '...', body: '...' }`.
8. `shows a mapped error message when submission fails` — eligible state, select a star,
   mock `submitReview` rejects with an Axios-shaped error
   (`{ response: { data: { error: { code: 'REVIEW_ALREADY_EXISTS' } } } }`), click submit →
   `await screen.findByRole('alert')` with text `'You have already reviewed this product.'`
   (from `mapReviewError`), and assert the form is still visible (not replaced by the
   success state).

Every async element-presence assertion above uses `findBy*`/`findAllBy*`
(never `waitFor(() => expect(getBy...))`), per the CI `frontend-quality` ESLint rule
(`testing-library/prefer-find-by`, `docs/frontend-standards.md` §ESLint Configuration).
Run `npx eslint src --ext .ts,.tsx` in `frontend/` before considering either test file
complete.

---

## 9. Frontend: Structured Data Emission

### 9.1 — Extend `productJsonLd` in `ProductPage.tsx`

Current `productJsonLd` object literal is lines 116-169, ending:

```tsx
          },
        }
      : {}),
  };
```

Add a new conditional block **inside the same object literal**, after the
`structuredDataVariant ? {...} : {}` spread (i.e. right before the closing `};` on the
line currently reading `};` at line 169), following the file's existing
`...(condition ? {...} : {})` conditional-spread convention:

```tsx
            },
          },
        }
      : {}),
    ...(!reviewsLoading && !reviewsError && product.reviewSummary && product.reviewSummary.reviewCount >= 1
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.reviewSummary.averageRating,
            reviewCount: product.reviewSummary.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
          review: reviews.map((r) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: r.authorNameSnapshot },
            reviewRating: {
              '@type': 'Rating',
              ratingValue: r.rating,
              bestRating: 5,
              worstRating: 1,
            },
            ...(r.body ? { reviewBody: r.body } : {}),
            datePublished: r.createdAt,
          })),
        }
      : {}),
  };
```

(See "Design decision" above for why this plan adds `!reviewsLoading && !reviewsError`
on top of task 9.1's literal `reviewCount >= 1` gate.)

### 9.2 — Confirm escaping reuse (no new code — verification note for the implementer)

`reviews[].body`/`.title` flow into `productJsonLd.review[].reviewBody` and
`reviews[].authorNameSnapshot` into `.review[].author.name` as **plain strings, untouched**.
`productJsonLd` is passed into `<Seo jsonLd={[productJsonLd, breadcrumbJsonLd]} />` exactly
as today (line 197, unchanged) — `Seo.tsx` performs `JSON.stringify(...).replace(/</g, '\\u003c')`
on the whole block, so a review body containing `</script>` or `<` is escaped exactly the
same way `product.description` already is today. **Do not add any `.replace()`,
`DOMPurify`, or HTML-stripping logic in `ProductPage.tsx` or `ProductReviews.tsx` — none
is needed and it would be a second, redundant escaping mechanism the design doc explicitly
warns against introducing.**

### 9.3 — Extend `frontend/src/pages/storefront/__tests__/ProductPage.test.tsx`

Add two new mocks alongside the existing `mockGetById`/`mockCategoryGetAll` (current
lines 6-28):

```tsx
const mockListApprovedForProduct = jest.fn();

jest.mock('../../../services/reviewService', () => ({
  reviewService: {
    listApprovedForProduct: (...args: unknown[]) => mockListApprovedForProduct(...args),
  },
}));

jest.mock('../../../contexts/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({ isAuthenticated: false, isLoading: false }),
}));
```

(`CustomerAuthContext` must be mocked because `ReviewForm` — now rendered inside
`ProductPage` — calls `useCustomerAuth()`, which throws outside a provider. Mocking it as
logged-out keeps `ReviewForm` in its simplest state — the "log in to review" prompt — and
avoids it making any network calls in these tests, which are only testing JSON-LD.)

Update the existing `beforeEach` (current lines 31-48) to also default
`mockListApprovedForProduct` to an empty, zero-review resolution, and update the
`mockGetById` product fixture to include `reviewSummary: { averageRating: null, reviewCount: 0 }`
(matching what a real "no reviews yet" product now returns, since `reviewSummary` is
present-but-empty on every product going forward, not undefined):

```tsx
  beforeEach(() => {
    jest.clearAllMocks();
    mockCategoryGetAll.mockResolvedValue([]);
    mockListApprovedForProduct.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 5,
      summary: { averageRating: null, reviewCount: 0 },
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
    mockGetById.mockResolvedValue({
      data: {
        id: 1,
        name: 'Dress',
        slug: 'dress',
        description: 'A dress',
        brand: null,
        status: 'Active',
        mainImageUrl: null,
        categoryId: null,
        reviewSummary: { averageRating: null, reviewCount: 0 },
        createdAt: '',
        updatedAt: '',
      },
    });
  });
```

Add a new `describe` block below the existing `'ProductPage language refetch'` block:

```tsx
describe('ProductPage structured data — reviews', () => {
  const baseProduct = {
    id: 1,
    name: 'Dress',
    slug: 'dress',
    description: 'A dress',
    brand: null,
    status: 'Active',
    mainImageUrl: null,
    categoryId: null,
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCategoryGetAll.mockResolvedValue([]);
  });

  it('omits aggregateRating and review when reviewCount is 0', async () => {
    mockGetById.mockResolvedValue({
      data: { ...baseProduct, reviewSummary: { averageRating: null, reviewCount: 0 } },
    });
    mockListApprovedForProduct.mockResolvedValue({
      items: [], total: 0, page: 1, pageSize: 5,
      summary: { averageRating: null, reviewCount: 0 },
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });

    renderWithI18n(<ProductPage />);

    await waitFor(() => {
      const script = document.querySelectorAll('script[type="application/ld+json"]')[0];
      expect(script).toBeInTheDocument();
      const parsed = JSON.parse(script!.textContent ?? '{}');
      expect(parsed.aggregateRating).toBeUndefined();
      expect(parsed.review).toBeUndefined();
    });
  });

  it('includes aggregateRating and review when reviewCount >= 1', async () => {
    mockGetById.mockResolvedValue({
      data: { ...baseProduct, reviewSummary: { averageRating: 4.5, reviewCount: 2 } },
    });
    mockListApprovedForProduct.mockResolvedValue({
      items: [
        { id: 1, productId: 1, rating: 5, title: 'Great', body: 'Loved it', authorNameSnapshot: 'María C.', createdAt: '2026-05-01T00:00:00Z' },
        { id: 2, productId: 1, rating: 4, title: null, body: null, authorNameSnapshot: 'Ana G.', createdAt: '2026-05-02T00:00:00Z' },
      ],
      total: 2, page: 1, pageSize: 5,
      summary: { averageRating: 4.5, reviewCount: 2 },
      distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    });

    renderWithI18n(<ProductPage />);

    await waitFor(() => {
      const script = document.querySelectorAll('script[type="application/ld+json"]')[0];
      const parsed = JSON.parse(script!.textContent ?? '{}');
      expect(parsed.aggregateRating).toEqual({
        '@type': 'AggregateRating', ratingValue: 4.5, reviewCount: 2, bestRating: 5, worstRating: 1,
      });
      expect(parsed.review).toHaveLength(2);
      expect(parsed.review[0]).toEqual({
        '@type': 'Review',
        author: { '@type': 'Person', name: 'María C.' },
        reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5, worstRating: 1 },
        reviewBody: 'Loved it',
        datePublished: '2026-05-01T00:00:00Z',
      });
      // second review has no body — reviewBody key must be entirely absent, not null/''
      expect(parsed.review[1].reviewBody).toBeUndefined();
    });
  });

  it('renders a review body containing "</script>" and "<" safely in the JSON-LD output', async () => {
    const dangerousBody = 'Nice <b>fabric</b> but not as described</script><script>alert(1)</script>';
    mockGetById.mockResolvedValue({
      data: { ...baseProduct, reviewSummary: { averageRating: 3, reviewCount: 1 } },
    });
    mockListApprovedForProduct.mockResolvedValue({
      items: [
        { id: 1, productId: 1, rating: 3, title: null, body: dangerousBody, authorNameSnapshot: 'Test User', createdAt: '2026-05-01T00:00:00Z' },
      ],
      total: 1, page: 1, pageSize: 5,
      summary: { averageRating: 3, reviewCount: 1 },
      distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0 },
    });

    renderWithI18n(<ProductPage />);

    await waitFor(() => {
      const script = document.querySelectorAll('script[type="application/ld+json"]')[0];
      // the raw serialized script text must never contain a literal "</script>" sequence
      expect(script!.textContent).not.toContain('</script>');
      // but JSON.parse must recover the exact original body (proves it's u003c-escaping,
      // not HTML-stripping or double-escaping)
      const parsed = JSON.parse(script!.textContent ?? '{}');
      expect(parsed.review[0].reviewBody).toBe(dangerousBody);
    });
  });
});
```

### 9.4 — Run the `ProductPage` test suite

`cd frontend && npx jest src/pages/storefront/__tests__/ProductPage.test.tsx` (plus the
two new component test files), then `npx eslint src --ext .ts,.tsx`, then the full
`npm test -- --watchAll=false` per tasks.md §11.4 (handled by the parent implementation
session, not this planning agent).

---

## Recommended CSS additions (not explicitly in tasks.md §7-9, but required for the new classNames above to render as intended)

Append to `frontend/src/styles/storefront.css` (reuses existing tokens from
`frontend/src/styles/tokens.css` — `--color-*`, `--spacing-*`, `--font-*` — no new
colors introduced, per the frontend-developer agent rule "colors should be the ones
defined in src/index.css"; tokens actually live in `styles/tokens.css`, imported via
`index.css`, so referencing the existing `var(--color-*)` custom properties satisfies
that rule):

```css
/* Product reviews (PDP) */
.storefront-pdp-reviews {
  margin-top: var(--spacing-16);
  padding-top: var(--spacing-8);
  border-top: 1px solid var(--color-light);
  display: grid;
  gap: var(--spacing-8);
}

.storefront-reviews__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--spacing-4);
}

.storefront-star { color: var(--color-light); }
.storefront-star--filled { color: var(--color-near-black); }

.storefront-reviews__average { display: flex; align-items: baseline; gap: var(--spacing-2); }
.storefront-reviews__average-value { font-size: var(--font-size-2xl); font-weight: var(--font-weight-semibold); }
.storefront-reviews__count { color: var(--color-mid); font-size: var(--font-size-sm); }

.storefront-reviews__distribution { list-style: none; margin: var(--spacing-4) 0 0; padding: 0; display: grid; gap: var(--spacing-1); }
.storefront-reviews__distribution-row { display: grid; grid-template-columns: 4rem 1fr 2rem; align-items: center; gap: var(--spacing-2); font-size: var(--font-size-xs); color: var(--color-mid); }
.storefront-reviews__bar { display: block; height: 6px; background: var(--color-light); border-radius: var(--radius-sm); overflow: hidden; }
.storefront-reviews__bar-fill { display: block; height: 100%; background: var(--color-near-black); }

.storefront-reviews__list { list-style: none; margin: var(--spacing-6) 0 0; padding: 0; display: grid; gap: var(--spacing-6); }
.storefront-review__header { display: flex; align-items: center; gap: var(--spacing-3); }
.storefront-review__author { font-weight: var(--font-weight-medium); }
.storefront-review__date { color: var(--color-mid); font-size: var(--font-size-xs); }
.storefront-review__title { font-weight: var(--font-weight-medium); margin: var(--spacing-2) 0 0; }
.storefront-review__body { color: var(--color-mid); margin: var(--spacing-1) 0 0; }

.storefront-review-form { display: grid; gap: var(--spacing-4); max-width: 32rem; }
.storefront-review-form--locked,
.storefront-review-form--success { color: var(--color-mid); }
.storefront-review-form__stars { display: flex; gap: var(--spacing-1); }
.storefront-review-form__star { background: none; border: none; cursor: pointer; font-size: var(--font-size-xl); color: var(--color-light); padding: 0; }
.storefront-review-form__star--active { color: var(--color-near-black); }
.storefront-review-form__validation { color: var(--color-error); font-size: var(--font-size-xs); margin: 0; }
```

This is a suggestion for whoever implements the components (or a follow-up styling pass)
— flagged as a gap below since it is not a numbered task-list item.

---

## Gaps / assumptions that need reconciling before or during implementation

1. **Backend response shapes are assumed, not confirmed.** No `backend.md` plan exists
   yet under `.claude/doc/product-customer-reviews/` at the time this plan was written.
   `ReviewEligibility { canReview, alreadyReviewed, hasPurchased }`,
   `ReviewListResult { items, total, page, pageSize, summary, distribution }`, and the
   error codes in `reviewService.ts`'s `mapReviewError` are this plan's best guess based
   on `design.md`/`spec.md`'s prose and this codebase's existing conventions (e.g.
   `ProductListResult`'s `items/total/page/pageSize` shape). **Before implementing,
   diff these against the backend plan/actual controller code** and adjust
   `frontend/src/types/product.ts` + `reviewService.ts` accordingly — the component
   files (`ProductReviews.tsx`/`ReviewForm.tsx`) are written against the *types*, so a
   shape mismatch is a one-file fix if caught early.
2. **`Review.createdAt` vs `publishedAt` for JSON-LD `datePublished`.** The Prisma model
   (task 1.1) has both `createdAt` (submission time) and `publishedAt` (moderation-approval
   time). This plan uses `createdAt` on the public `Review` type/JSON-LD, since
   `publishedAt`/`moderatedAt`/`moderatedByAdminUserId` read as admin-only audit fields
   that likely aren't in the public serializer at all. If the backend instead exposes
   `publishedAt` publicly (arguably more correct for `datePublished`, since that's when it
   actually became visible), rename the field in `types/product.ts`'s `Review` interface
   and in the two `r.createdAt` usages in `ProductPage.tsx`/`ProductReviews.tsx`.
3. **No admin moderation UI is in scope for tasks §7-9** (confirmed by re-reading
   tasks.md — the admin review routes are backend-only, §6.4; no admin frontend task is
   listed anywhere in the file). This means after this feature ships, there is **no way
   for an admin to approve/reject reviews except direct API calls** (`curl`, per tasks
   §12.5) until a follow-up change adds an admin UI. Confirm this is intentional for this
   change's scope (it reads as intentional — `design.md`'s Non-Goals list doesn't
   mention it either way, but nothing in tasks.md builds it) — flagging so it isn't
   silently forgotten.
4. **`reviewService.listOwnReviews` is defined but unused** by any component in this
   plan (task 7.2 requires it; no task in §8-9 consumes it — there's no "my reviews"
   account page in scope). It's wired and ready for a future `/account/reviews` page.
5. **Rounding for the average-rating star display**: `StarsDisplay` in `ProductReviews.tsx`
   does `Math.round(rating)` for whole-star fill (no half-stars) — e.g. 4.5 rounds to 5
   filled stars while the numeric `"4.5"` is shown alongside it. This is a deliberate
   simplicity choice (no half-star glyph/CSS) but is a visible product decision worth a
   quick confirmation from whoever reviews the UI.
