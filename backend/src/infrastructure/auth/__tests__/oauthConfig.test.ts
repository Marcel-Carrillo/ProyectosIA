import {
  getOAuthCallbackUrl,
  getOAuthProviderStatus,
  isAppleOAuthConfigured,
  isFacebookOAuthConfigured,
  isGoogleOAuthConfigured,
} from '../oauthConfig';

describe('oauthConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    delete process.env.APPLE_CLIENT_ID;
    delete process.env.APPLE_TEAM_ID;
    delete process.env.APPLE_KEY_ID;
    delete process.env.APPLE_PRIVATE_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds backend callback URLs', () => {
    process.env.API_PUBLIC_URL = 'http://localhost:3000';
    expect(getOAuthCallbackUrl('google')).toBe('http://localhost:3000/api/public/auth/google/callback');
    expect(getOAuthCallbackUrl('facebook')).toBe('http://localhost:3000/api/public/auth/facebook/callback');
    expect(getOAuthCallbackUrl('apple')).toBe('http://localhost:3000/api/public/auth/apple/callback');
  });

  it('detects configured providers', () => {
    expect(getOAuthProviderStatus()).toEqual({ google: false, apple: false, facebook: false });

    process.env.GOOGLE_CLIENT_ID = 'g';
    process.env.GOOGLE_CLIENT_SECRET = 's';
    expect(isGoogleOAuthConfigured()).toBe(true);

    process.env.FACEBOOK_APP_ID = 'f';
    process.env.FACEBOOK_APP_SECRET = 's';
    expect(isFacebookOAuthConfigured()).toBe(true);

    process.env.APPLE_CLIENT_ID = 'a';
    process.env.APPLE_TEAM_ID = 't';
    process.env.APPLE_KEY_ID = 'k';
    process.env.APPLE_PRIVATE_KEY = 'pk';
    expect(isAppleOAuthConfigured()).toBe(true);
  });
});
