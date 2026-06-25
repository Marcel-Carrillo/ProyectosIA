export type ProductStatus = 'Draft' | 'Active' | 'Inactive' | 'Archived';
export type ProductVariantStatus = 'Active' | 'Inactive';
export type StockPolicy = 'TRACK' | 'DONT_TRACK' | 'DENY';
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
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  status: ProductStatus;
  mainImageUrl: string | null;
  categoryId: number | null;
  variants?: ProductVariant[];
  images?: ProductImage[];
  translations?: ProductTranslation[];
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
  mainImageUrl?: string | null;
  categoryId?: number | null;
  translations?: { locale: SupportedLocale; name: string; description?: string | null }[];
}

/** Body for PATCH /api/admin/products/:id. slug is auto-generated; never send it. */
export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  brand?: string | null;
  status?: ProductStatus;
  mainImageUrl?: string | null;
  categoryId?: number | null;
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
