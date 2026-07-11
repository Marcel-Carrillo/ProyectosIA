import axios, { AxiosError } from 'axios';
import { getCustomerAccessToken } from './customerAuthService';
import {
  ReviewListResponse,
  ReviewListResult,
  ReviewEligibility,
  ReviewEligibilityResponse,
  SubmitReviewInput,
  SubmitReviewResponse,
  OwnReview,
  OwnReviewListResponse,
} from '../types/product';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const PUBLIC_PRODUCTS_BASE = `${API_BASE_URL}/api/public/products`;
const ACCOUNT_BASE = `${API_BASE_URL}/api/public/account`;

function authHeaders() {
  const token = getCustomerAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function mapReviewError(code: string): string {
  switch (code) {
    case 'REVIEW_PURCHASE_NOT_VERIFIED':
      return 'You can only review products you have purchased.';
    case 'REVIEW_ALREADY_EXISTS':
      return 'You have already reviewed this product.';
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
        { params: params ? { page: params.page, limit: params.pageSize } : undefined }
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
  submitReview: async (input: SubmitReviewInput): Promise<OwnReview> => {
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
