import {
  ICjClient,
  CjEnvelope,
  CjAuthData,
  CjVerifyResult,
  CjCategoryDto,
  CjListV2Response,
  CjVariantDto,
  CjFreightOption,
  CjFreightCalculateParams,
  CjOrderCreateParams,
  CjOrderCreateResult,
  CjOrderDetail,
} from './cjTypes';
import { logger } from '../logger';

const CJ_API_BASE_URL = process.env.CJ_API_BASE_URL ?? 'https://developers.cjdropshipping.com/api2.0/v1';
const CJDROPSHIPPING_API_KEY = process.env.CJDROPSHIPPING_API_KEY ?? 'cj_test_placeholder';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
// CJ's documented lifetime (15 days) conflicts with a live-observed value
// (~180 days) — never hardcode a lifetime; always refresh based on the
// response's own accessTokenExpiryDate, with a safety margin.
const TOKEN_REFRESH_SAFETY_MARGIN_MS = 24 * 60 * 60 * 1000;
const AUTH_MIN_INTERVAL_MS = 1_000; // CJ's documented 1 req/s auth rate limit

export class CjApiError extends Error {
  readonly code = 'CJ_API_ERROR' as const;
  readonly status: number;

  // message is built only from statusCode + a fixed vocabulary string, never
  // from raw response body text (body.message) — upstream error bodies could
  // otherwise echo request headers or other sensitive content into logs.
  constructor(statusCode: number, reason: string) {
    super(`CJ Dropshipping API request failed (${statusCode}): ${reason}`);
    this.name = 'CjApiError';
    this.status = statusCode;
    Object.setPrototypeOf(this, CjApiError.prototype);
  }
}

// Module-level token cache — the CJ credential is a single, store-wide
// account, not per-supplier, so this is intentionally global state rather
// than persisted per SupplierIntegration (design.md Decision 2).
let cachedAuth: CjAuthData | null = null;
let lastAuthCallAt = 0;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isExpiringSoon(expiryDate: string): boolean {
  const expiryMs = new Date(expiryDate).getTime();
  return Number.isNaN(expiryMs) || Date.now() > expiryMs - TOKEN_REFRESH_SAFETY_MARGIN_MS;
}

async function authenticate(): Promise<CjAuthData> {
  const waitMs = AUTH_MIN_INTERVAL_MS - (Date.now() - lastAuthCallAt);
  if (waitMs > 0) await sleep(waitMs);
  lastAuthCallAt = Date.now();

  let response: Response;
  try {
    response = await fetch(`${CJ_API_BASE_URL}/authentication/getAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: CJDROPSHIPPING_API_KEY }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new CjApiError(502, 'upstream unreachable');
  }

  const body = (await response.json().catch(() => null)) as CjEnvelope<CjAuthData> | null;
  if (!body || body.success !== true || !body.data?.accessToken) {
    throw new CjApiError(response.status, 'authentication rejected');
  }
  logger.info('CJ Dropshipping authentication succeeded', { pointsInfo: body.pointsInfo });
  cachedAuth = body.data;
  return cachedAuth;
}

async function refreshAuth(refreshToken: string): Promise<CjAuthData> {
  let response: Response;
  try {
    response = await fetch(`${CJ_API_BASE_URL}/authentication/refreshAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return authenticate();
  }

  const body = (await response.json().catch(() => null)) as CjEnvelope<CjAuthData> | null;
  if (!body || body.success !== true || !body.data?.accessToken) {
    // Refresh failed (e.g. stale/invalid refresh token) — fall back to full
    // re-authentication rather than throwing, so the client stays usable.
    return authenticate();
  }
  cachedAuth = body.data;
  return cachedAuth;
}

async function getValidToken(): Promise<string> {
  if (!cachedAuth) return (await authenticate()).accessToken;
  if (isExpiringSoon(cachedAuth.accessTokenExpiryDate)) {
    return (await refreshAuth(cachedAuth.refreshToken)).accessToken;
  }
  return cachedAuth.accessToken;
}

async function requestWithRetry<T>(path: string, init: RequestInit): Promise<T> {
  const token = await getValidToken();
  let lastStatus = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${CJ_API_BASE_URL}${path}`, {
        ...init,
        headers: { ...init.headers, 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      if (attempt === MAX_RETRIES) throw new CjApiError(502, 'upstream unreachable');
      await sleep(2 ** attempt * 200);
      continue;
    }

    const body = (await response.json().catch(() => null)) as CjEnvelope<T> | null;
    lastStatus = response.status;

    // Body-based success evaluation — HTTP status alone is not trusted, since
    // CJ returns 200 even for logical failures. This is the core contract fix
    // vs. the old placeholder Spocket client's response.ok check.
    if (body && body.success === true) {
      if (body.pointsInfo) logger.info('CJ Dropshipping pointsInfo', { pointsInfo: body.pointsInfo });
      return body.data;
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_RETRIES) {
      if (body && body.success !== true) {
        logger.warn('CJ Dropshipping API logical failure', {
          path,
          code: body.code,
          message: body.message,
        });
      }
      if (response.status === 401 || response.status === 403) {
        throw new CjApiError(response.status, 'authentication rejected');
      }
      throw new CjApiError(response.status, 'request failed');
    }
    await sleep(2 ** attempt * 200);
  }
  throw new CjApiError(lastStatus || 502, 'request failed after retries');
}

export class CjApiClient implements ICjClient {
  async verifyConnection(): Promise<CjVerifyResult> {
    try {
      await authenticate(); // force a fresh auth check rather than reusing a cached token
      await requestWithRetry('/setting/get', { method: 'GET' });
      return { healthy: true };
    } catch (err) {
      if (err instanceof CjApiError) return { healthy: false };
      throw err;
    }
  }

  async fetchCategories(): Promise<CjCategoryDto[]> {
    return requestWithRetry<CjCategoryDto[]>('/product/getCategory', { method: 'GET' });
  }

  async fetchCatalog(page: number, pageSize = 100): Promise<CjListV2Response> {
    return requestWithRetry<CjListV2Response>(`/product/listV2?page=${page}&size=${pageSize}`, {
      method: 'GET',
    });
  }

  async fetchVariants(pid: string): Promise<CjVariantDto[]> {
    return requestWithRetry<CjVariantDto[]>(`/product/variant/query?pid=${encodeURIComponent(pid)}`, {
      method: 'GET',
    });
  }

  async calculateFreight(params: CjFreightCalculateParams): Promise<CjFreightOption[]> {
    return requestWithRetry<CjFreightOption[]>('/logistic/freightCalculate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createOrder(params: Omit<CjOrderCreateParams, 'isSandbox'>): Promise<CjOrderCreateResult> {
    // isSandbox is always forced to 1 in this increment — there is no
    // parameter by which a caller could request a real order (design.md
    // Decision 5). CJ_SANDBOX_ORDERS is read only for observability/logging.
    if (process.env.CJ_SANDBOX_ORDERS === 'false') {
      logger.warn('CJ_SANDBOX_ORDERS=false ignored: real order push is not implemented in this increment');
    }
    const body: CjOrderCreateParams = {
      ...params,
      shopLogisticsType: params.shopLogisticsType ?? 2,
      isSandbox: 1,
    };
    return requestWithRetry<CjOrderCreateResult>('/shopping/order/createOrderV3', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getOrderDetail(externalOrderId: string): Promise<CjOrderDetail> {
    return requestWithRetry<CjOrderDetail>(
      `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(externalOrderId)}`,
      { method: 'GET' }
    );
  }
}

// Module-level singleton, mirrors the stripeClient.ts / prior spocketClient.ts
// composition pattern.
export const cjClient = new CjApiClient();
