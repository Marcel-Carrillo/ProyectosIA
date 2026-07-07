import { ISpocketClient, SpocketCatalogPage, SpocketVerifyResult } from './spocketTypes';

// startup does not hard-require SPOCKET_API_KEY/SPOCKET_API_BASE_URL (design.md
// migration plan: absence must not crash the app). The placeholder fallback
// mirrors stripeClient.ts's sk_test_placeholder, allowing Jest to import this
// module without real credentials; tests that exercise Spocket must mock it.
const SPOCKET_API_BASE_URL = process.env.SPOCKET_API_BASE_URL ?? 'https://api.spocket.co/placeholder';
const SPOCKET_API_KEY = process.env.SPOCKET_API_KEY ?? 'spocket_test_placeholder';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class SpocketApiError extends Error {
  readonly code = 'SPOCKET_API_ERROR' as const;
  readonly status: number;

  // message is built only from statusCode + a fixed vocabulary string, never
  // from raw response body text — upstream error bodies could otherwise echo
  // request headers or other sensitive content back into logs.
  constructor(statusCode: number, reason: string) {
    super(`Spocket API request failed (${statusCode}): ${reason}`);
    this.name = 'SpocketApiError';
    this.status = statusCode;
    Object.setPrototypeOf(this, SpocketApiError.prototype);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry(path: string, init: RequestInit): Promise<Response> {
  let lastStatus = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${SPOCKET_API_BASE_URL}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${SPOCKET_API_KEY}`,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      if (attempt === MAX_RETRIES) throw new SpocketApiError(502, 'upstream unreachable');
      await sleep(2 ** attempt * 200);
      continue;
    }

    if (response.ok) return response;
    lastStatus = response.status;

    if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_RETRIES) {
      if (response.status === 401 || response.status === 403) {
        throw new SpocketApiError(response.status, 'authentication rejected');
      }
      throw new SpocketApiError(response.status, 'request failed');
    }
    await sleep(2 ** attempt * 200);
  }
  throw new SpocketApiError(lastStatus || 502, 'request failed after retries');
}

export class SpocketApiClient implements ISpocketClient {
  async verifyConnection(): Promise<SpocketVerifyResult> {
    try {
      const res = await requestWithRetry('/v1/auth/verify', { method: 'GET' });
      const body = (await res.json()) as { accountRef?: string };
      return { healthy: true, externalAccountRef: body.accountRef };
    } catch (err) {
      if (err instanceof SpocketApiError) return { healthy: false };
      throw err;
    }
  }

  async fetchCatalog(pageToken?: string): Promise<SpocketCatalogPage> {
    const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    const res = await requestWithRetry(`/v1/catalog${query}`, { method: 'GET' });
    return (await res.json()) as SpocketCatalogPage;
  }
}

// Module-level singleton, mirrors stripeClient.ts's composition pattern.
export const spocketClient = new SpocketApiClient();
