import axios from 'axios';

/**
 * Maps an API failure to an i18n key under the `common` namespace.
 *
 * Backend business errors always carry a stable `error.code`; translating the
 * code (instead of echoing the English `error.message`) keeps customer-facing
 * error text in the visitor's language. Unknown codes fall back to
 * `errors.generic`, and transport failures to `errors.network`.
 */
export function apiErrorKey(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'errors.network';
    const code = (err.response.data as { error?: { code?: string } } | undefined)?.error?.code;
    if (code && KNOWN_ERROR_CODES.has(code)) return `errors.${code}`;
  }
  return 'errors.generic';
}

// Keep in sync with the `errors` section of i18n/locales/*/common.json.
const KNOWN_ERROR_CODES = new Set([
  'VALIDATION_ERROR',
  'EMAIL_HAS_ACCOUNT',
  'VARIANT_NOT_FOUND',
  'COUPON_NOT_FOUND',
  'COUPON_EXHAUSTED',
  'PAYMENT_GATEWAY_UNAVAILABLE',
  'ORDER_NOT_FOUND',
  'UNAUTHORIZED',
]);
