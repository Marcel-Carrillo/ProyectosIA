export type ProductStatus = 'Draft' | 'Active' | 'Inactive' | 'Archived';
export type ProductVariantStatus = 'Active' | 'Inactive';
export type StockPolicy = 'SupplierManaged' | 'InternalStock' | 'Hybrid';
export type TranslationSource = 'manual' | 'import' | 'machine';
export type SupportedLocale = 'en' | 'es';

export interface ProductTranslation {
  id: number;
  productId: number;
  locale: SupportedLocale;
  name: string;
  description: string | null;
  source: TranslationSource;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: number;
  productId: number;
  sku: string;
  size: string | null;
  color: string | null;
  publicPrice: number;
  compareAtPrice: number | null;
  stockPolicy: StockPolicy;
  status: ProductVariantStatus;
  // Synced from the linked CjCatalogItem during catalog sync/promotion; 0
  // when unmapped. Never client-settable — write payloads must not include it.
  stockQuantity: number;
  // Supplier sourcing data returned only by /api/admin variant endpoints.
  // Read-only in the admin UI: write payloads must never include these fields.
  supplierId?: number | null;
  supplierReference?: string | null;
  supplierCost?: number | null;
  supplierName?: string | null;
  // Admin-only margin breakdown (shipping-margin-guardrail) — never sent by
  // the client, only ever read from admin variant responses.
  shippingCostEstimate?: number | null;
  netMargin?: number | null;
  shippingEstimateMissing?: boolean;
  marginWarning?: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: number;
  productId: number;
  url: string;
  altText: string | null;
  sortOrder: number;
  color: string | null;
  createdAt: string;
}

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
 * reviewer's customerId, moderationNote, or moderatedByAdminUserId — identity is
 * exposed only as `authorNameSnapshot`.
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
  reason: 'eligible' | 'not_purchased' | 'already_reviewed';
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

/** The caller's own review — includes `status` since Pending/Rejected reviews are only visible to their author. */
export interface OwnReview extends Review {
  status: ReviewStatus;
}

export interface SubmitReviewResponse {
  success: boolean;
  data: OwnReview;
  message: string;
}

export interface OwnReviewListResult {
  items: OwnReview[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OwnReviewListResponse {
  success: boolean;
  data: OwnReviewListResult;
  message: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  gtin: string | null;
  status: ProductStatus;
  mainImageUrl: string | null;
  categoryId: number | null;
  variants?: ProductVariant[];
  images?: ProductImage[];
  translations?: ProductTranslation[];
  reviewSummary?: ReviewSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResult {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductListResponse {
  success: boolean;
  data: ProductListResult;
  message: string;
}

export interface ProductResponse {
  success: boolean;
  data: Product;
  message: string;
}

export interface ProductQueryParams {
  status?: ProductStatus;
  categoryId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}

// ─── Write-payload types (admin only) ───────────────────────────────────────

/**
 * Body for POST /api/admin/products. The backend auto-generates the slug from
 * name — do NOT send a slug field. Supplier fields are out of scope.
 */
export interface CreateProductInput {
  name: string;
  description?: string | null;
  brand?: string | null;
  gtin?: string | null;
  mainImageUrl?: string | null;
  categoryId?: number | null;
  translations?: { locale: SupportedLocale; name: string; description?: string | null }[];
}

/** Body for PATCH /api/admin/products/:id. slug is auto-generated; never send it. */
export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  brand?: string | null;
  gtin?: string | null;
  status?: ProductStatus;
  mainImageUrl?: string | null;
  categoryId?: number | null;
  translations?: { locale: SupportedLocale; name: string; description?: string | null }[];
}

/** Body for POST /api/admin/products/:id/variants. Never include supplier fields. */
export interface CreateVariantInput {
  sku: string;
  size?: string | null;
  color?: string | null;
  publicPrice: number;
  compareAtPrice?: number | null;
  stockPolicy: StockPolicy;
  status?: ProductVariantStatus;
}

/** Body for PATCH /api/admin/products/:id/variants/:variantId. Never include supplier fields. */
export interface UpdateVariantInput {
  sku?: string;
  size?: string | null;
  color?: string | null;
  publicPrice?: number;
  compareAtPrice?: number | null;
  stockPolicy?: StockPolicy;
  status?: ProductVariantStatus;
}

/** Body for PUT /api/admin/products/:id/translations/:locale */
export interface UpsertTranslationInput {
  name: string;
  description?: string | null;
  source?: TranslationSource;
}

export interface TranslationResponse {
  success: boolean;
  data: ProductTranslation;
  message: string;
}

export interface TranslationListResponse {
  success: boolean;
  data: ProductTranslation[];
  message: string;
}

/** Body for POST /api/admin/products/:id/images */
export interface CreateImageInput {
  url: string;
  altText?: string | null;
  sortOrder?: number;
}

/** Body for PATCH /api/admin/products/:id/images/:imageId */
export interface UpdateImageInput {
  url?: string;
  altText?: string | null;
  sortOrder?: number;
}

// ─── Admin API error envelope ───────────────────────────────────────────────

/** Error response shape from the backend globalErrorHandler. */
export interface AdminApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// ─── Variant / image response envelopes (admin) ─────────────────────────────

export interface VariantListResponse {
  success: boolean;
  data: ProductVariant[];
  message: string;
}

export interface VariantResponse {
  success: boolean;
  data: ProductVariant;
  message: string;
}

export interface ImageListResponse {
  success: boolean;
  data: ProductImage[];
  message: string;
}

export interface ImageResponse {
  success: boolean;
  data: ProductImage;
  message: string;
}
