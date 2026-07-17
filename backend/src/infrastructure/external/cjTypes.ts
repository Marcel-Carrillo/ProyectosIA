export interface CjAuthData {
  accessToken: string;
  accessTokenExpiryDate: string; // ISO-ish date string from CJ — parse with `new Date(...)`
  refreshToken: string;
  refreshTokenExpiryDate: string;
}

export interface CjPointsInfo {
  total: number;
  usedToday: number;
  remaining: number;
}

// Generic envelope every CJ response shares — success/failure is read from
// `success`/`result` (both present and always equal in live testing), NEVER
// from HTTP status: CJ returns HTTP 200 even for logical errors.
export interface CjEnvelope<T> {
  code: number;
  result: boolean;
  success: boolean;
  message?: string; // never surfaced verbatim to logs/clients — see CjApiError
  data: T;
  pointsInfo?: CjPointsInfo;
}

// Confirmed against live CJ Dropshipping /product/getCategory payloads
// (production, 2026-07-17) and published docs. The tree has 3 levels; live
// responses expose `categoryFirstId` / `categorySecondId` in addition to the
// leaf `categoryId`. Product listing `categoryId` usually targets a leaf but
// can also reference a mid-level id on some catalog entries.
export interface CjCategoryLeafDto {
  categoryId: string;
  categoryName: string;
}

export interface CjCategorySecondLevelDto {
  categorySecondId?: string;
  categorySecondName: string;
  categorySecondList?: CjCategoryLeafDto[];
}

export interface CjCategoryDto {
  categoryFirstId?: string;
  categoryFirstName: string;
  categoryFirstList?: CjCategorySecondLevelDto[];
}

export interface CjProductDto {
  id: string; // CJ's `pid`
  nameEn: string;
  sku: string;
  sellPrice: number;
  categoryId: string;
  warehouseInventoryNum?: number;
  bigImage?: string;
}

export interface CjVariantDto {
  vid: string;
  pid: string;
  variantSku: string;
  variantKey?: string; // Hyphen-joined option values, e.g. "Black-XXL" — primary size/color source
  variantNameEn?: string; // Secondary signal when variantKey is absent or incomplete
  variantProperty?: string; // Fallback-only JSON-encoded array of { key, value } attribute pairs
  variantWeight?: number;
  variantSellPrice: number;
  inventoryNum?: number;
  variantImage?: string;
}

export interface CjListV2Response {
  pageSize: number;
  pageNumber: number;
  totalRecords: number;
  totalPages: number;
  content: Array<{ productList: CjProductDto[] }>;
}

export interface CjFreightOption {
  logisticName: string;
  logisticAging: string; // e.g. "4-8" (days)
  logisticPrice: number;
  totalPostageFee: number;
}

export interface CjFreightCalculateParams {
  startCountryCode: string;
  endCountryCode: string;
  products: Array<{ vid: string; quantity: number }>;
}

export interface CjOrderCreateParams {
  orderNumber: string;
  logisticName: string;
  fromCountryCode?: string;
  isSandbox: 1;
  products: Array<{ vid: string; quantity: number }>;
  shippingCustomerName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingAddress2?: string;
  shippingCity: string;
  shippingProvince: string;
  shippingZip: string;
  shippingCountry: string;
  shippingCountryCode: string;
  shopLogisticsType?: number;
  iossType?: number;
  iossNumber?: string;
}

export interface CjOrderCreateResult {
  orderId: string;
}

export interface CjOrderDetail {
  orderId: string;
  orderStatus: string;
  trackNumber?: string | null;
  logisticName?: string | null;
}

export interface CjVerifyResult {
  healthy: boolean;
}

// Port consumed by application services — implemented by CjApiClient. Kept
// separate from the concrete client so services can be unit-tested with a
// hand-written fake instead of mocking HTTP.
export interface ICjClient {
  verifyConnection(): Promise<CjVerifyResult>;
  fetchCategories(): Promise<CjCategoryDto[]>;
  fetchCatalog(page: number, pageSize?: number): Promise<CjListV2Response>;
  fetchVariants(pid: string): Promise<CjVariantDto[]>;
  calculateFreight(params: CjFreightCalculateParams): Promise<CjFreightOption[]>;
  createOrder(params: Omit<CjOrderCreateParams, 'isSandbox'>): Promise<CjOrderCreateResult>;
  getOrderDetail(externalOrderId: string): Promise<CjOrderDetail>;
  // QA-only: drives a sandbox order (isSandbox: 1) through CJ's own
  // sandbox-testing endpoints (simulate payment, then step the shipping
  // status forward) so a test order's lifecycle can be exercised without a
  // real warehouse. Best-effort — see cjClient.ts for why individual steps
  // never throw on a CJ logical failure.
  simulateSandboxAdvance(externalOrderId: string): Promise<void>;
}
