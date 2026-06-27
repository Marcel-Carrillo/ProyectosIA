export const PRINTFUL_API_BASE_URL = 'https://api.printful.com';

// ── List endpoint: GET /sync/products ──────────────────────────────────────

export interface SyncProductListItem {
  id: number;
  external_id: string;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url: string | null;
  is_ignored: boolean;
}

export interface PrintfulPaging {
  total: number;
  offset: number;
  limit: number;
}

export interface SyncProductListResponse {
  code: number;
  result: SyncProductListItem[];
  paging: PrintfulPaging;
}

// ── Detail endpoint: GET /sync/products/{id} ─────────────────────────────

export interface VariantOption {
  id: string; // Printful uses uppercase id: "SIZE", "COLOR" — NOT "type"
  value: string;
}

export interface SyncVariant {
  id: number;
  external_id: string;
  sync_product_id: number;
  name: string;
  synced: boolean;
  variant_id: number;
  retail_price: string; // Printful returns prices as strings, e.g. "15.00"
  currency: string;
  is_ignored: boolean;
  options: VariantOption[];
  files: { type: string; preview_url: string | null }[];
  product: { type: string }; // product template type used for category derivation
}

export interface SyncProductDetail {
  id: number;
  external_id: string;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url: string | null;
  is_ignored: boolean;
}

export interface SyncProductDetailResponse {
  code: number;
  result: {
    sync_product: SyncProductDetail;
    sync_variants: SyncVariant[];
  };
}
