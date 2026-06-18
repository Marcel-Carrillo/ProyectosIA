import crypto from 'crypto';

export type OAuthProvider = 'google' | 'apple' | 'facebook';

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

export function createOAuthState(): string {
  return crypto.randomBytes(16).toString('hex');
}

export const OAUTH_STATE_COOKIE = 'oauth_state';
