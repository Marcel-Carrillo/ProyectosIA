import crypto from 'crypto';

export type OAuthProvider = 'google' | 'apple' | 'facebook';

function getOAuthStateSecret(): string {
  return process.env.COOKIE_SECRET ?? process.env.JWT_SECRET ?? 'change-me-in-production-32-chars';
}

// Stateless HMAC-signed state for serverless OAuth (no cookie required)
export function createSignedOAuthState(provider: OAuthProvider): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const payload = `${provider}.${nonce}.${timestamp}`;
  const hmac = crypto.createHmac('sha256', getOAuthStateSecret()).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

export function verifySignedOAuthState(state: string | undefined, provider: OAuthProvider): boolean {
  if (!state) return false;
  const parts = state.split('.');
  if (parts.length !== 4) return false;
  const [stateProvider, nonce, timestamp, receivedHmac] = parts;
  if (stateProvider !== provider) return false;
  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age < 0 || age > 10 * 60 * 1000) return false;
  const payload = `${stateProvider}.${nonce}.${timestamp}`;
  const expectedHmac = crypto.createHmac('sha256', getOAuthStateSecret()).update(payload).digest('hex');
  if (receivedHmac.length !== expectedHmac.length) return false;
  return crypto.timingSafeEqual(Buffer.from(receivedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'));
}

export function getApiPublicUrl(): string {
  return (
    process.env.API_PUBLIC_URL
    ?? process.env.BACKEND_URL
    ?? `http://localhost:${process.env.PORT ?? '3000'}`
  );
}

export function getOAuthCallbackUrl(provider: OAuthProvider): string {
  return `${getApiPublicUrl()}/api/public/auth/${provider}/callback`;
}

export function getFrontendUrl(): string {
  return process.env.FRONTEND_URL?.split(',')[0]?.trim() ?? 'http://localhost:3001';
}

export function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function isFacebookOAuthConfigured(): boolean {
  return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

export function isAppleOAuthConfigured(): boolean {
  return !!(
    process.env.APPLE_CLIENT_ID
    && process.env.APPLE_TEAM_ID
    && process.env.APPLE_KEY_ID
    && process.env.APPLE_PRIVATE_KEY
  );
}

export function getOAuthProviderStatus(): Record<OAuthProvider, boolean> {
  return {
    google: isGoogleOAuthConfigured(),
    apple: isAppleOAuthConfigured(),
    facebook: isFacebookOAuthConfigured(),
  };
}

