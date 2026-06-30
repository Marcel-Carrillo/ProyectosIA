import { Response, NextFunction } from 'express';
import {
  customerAuthService,
  CUSTOMER_REFRESH_COOKIE,
} from '../../application/services/customerAuthService';
import { CustomerAuthRequest } from '../../middleware/requireCustomerAuth';
import { OAuth2Client } from 'google-auth-library';
import {
  createSignedOAuthState,
  verifySignedOAuthState,
  getFrontendUrl,
  getOAuthCallbackUrl,
  getOAuthProviderStatus,
  isAppleOAuthConfigured,
  isFacebookOAuthConfigured,
  isGoogleOAuthConfigured,
} from '../../infrastructure/auth/oauthConfig';
import { getFacebookAuthorizationUrl, exchangeFacebookCode } from '../../infrastructure/auth/facebookOAuth';
import {
  exchangeAppleCode,
  getAppleAuthorizationUrl,
  parseAppleUserField,
} from '../../infrastructure/auth/appleOAuth';
import { encryptCookieValue, decryptCookieValue } from '../../infrastructure/auth/cookieCrypto';

const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  signed: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

function setRefreshCookie(res: Response, raw: string): void {
  res.cookie(CUSTOMER_REFRESH_COOKIE, encryptCookieValue(raw), COOKIE_OPTIONS);
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(CUSTOMER_REFRESH_COOKIE, { path: '/' });
}

function sendSession(res: Response, result: {
  account: unknown;
  customer: unknown;
  accessToken: string;
  refreshTokenRaw: string;
}, status = 200) {
  setRefreshCookie(res, result.refreshTokenRaw);
  res.status(status).json({
    success: true,
    data: {
      account: result.account,
      customer: result.customer,
      accessToken: result.accessToken,
    },
    message: 'Success',
  });
}

export async function register(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await customerAuthService.register(req.body);
    sendSession(res, result, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { message: 'Email and password required', code: 'VALIDATION_ERROR' },
      });
      return;
    }
    const result = await customerAuthService.login(email, password);
    if ('mfaRequired' in result) {
      res.json({
        success: true,
        data: { mfaRequired: true, mfaToken: result.mfaToken },
        message: 'Two-factor authentication required',
      });
      return;
    }
    sendSession(res, result);
  } catch (err) {
    next(err);
  }
}

export async function verify2fa(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const { mfaToken, code } = req.body as { mfaToken?: string; code?: string };
    if (!mfaToken || !code) {
      res.status(400).json({
        success: false,
        error: { message: 'mfaToken and code required', code: 'VALIDATION_ERROR' },
      });
      return;
    }
    const result = await customerAuthService.verify2fa(mfaToken, code);
    sendSession(res, result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const encrypted = req.signedCookies?.[CUSTOMER_REFRESH_COOKIE] as string | undefined;
    const raw = encrypted ? decryptCookieValue(encrypted) : null;
    if (!raw) {
      res.status(401).json({
        success: false,
        error: { message: 'Refresh token missing', code: 'REFRESH_TOKEN_INVALID' },
      });
      return;
    }
    const result = await customerAuthService.refresh(raw);
    setRefreshCookie(res, result.refreshTokenRaw);
    res.json({
      success: true,
      data: { accessToken: result.accessToken },
      message: 'Token refreshed',
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const encrypted = req.signedCookies?.[CUSTOMER_REFRESH_COOKIE] as string | undefined;
    const raw = encrypted ? decryptCookieValue(encrypted) ?? undefined : undefined;
    await customerAuthService.logout(raw);
    clearRefreshCookie(res);
    res.json({ success: true, data: null, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

export async function me(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.customer) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      return;
    }
    const { prisma } = await import('../../infrastructure/prismaClient');
    const account = await prisma.customerAccount.findUnique({
      where: { id: req.customer.accountId },
    });
    const customer = await prisma.customer.findUnique({
      where: { id: req.customer.customerId },
    });
    if (!account || !customer) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      return;
    }
    const { toAccountPublic, toCustomerPublic, CustomerAccount } = await import('../../domain/models/customerAccount');
    res.json({
      success: true,
      data: {
        account: toAccountPublic(new CustomerAccount(account)),
        customer: toCustomerPublic(customer),
      },
      message: 'Profile retrieved',
    });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({
        success: false,
        error: { message: 'Email required', code: 'VALIDATION_ERROR' },
      });
      return;
    }
    const result = await customerAuthService.forgotPassword(email);
    res.json({ success: true, data: result, message: result.message });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) {
      res.status(400).json({
        success: false,
        error: { message: 'Token and password required', code: 'VALIDATION_ERROR' },
      });
      return;
    }
    await customerAuthService.resetPassword(token, password);
    res.json({ success: true, data: null, message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
}

function oauthNotConfigured(res: Response, provider: string): void {
  res.status(501).json({
    success: false,
    error: {
      message: `${provider} OAuth not configured — add credentials to backend/.env`,
      code: 'OAUTH_NOT_CONFIGURED',
    },
  });
}


async function completeOAuthLogin(
  res: Response,
  provider: 'google' | 'apple' | 'facebook',
  providerId: string,
  email: string,
  profile: { firstName: string; lastName: string },
): Promise<void> {
  const result = await customerAuthService.oauthLogin(provider, providerId, email, profile);
  setRefreshCookie(res, result.refreshTokenRaw);
  const frontend = getFrontendUrl();
  res.redirect(`${frontend}/account?token=${result.accessToken}`);
}

export async function oauthProviders(_req: CustomerAuthRequest, res: Response) {
  res.json({
    success: true,
    data: getOAuthProviderStatus(),
    message: 'OAuth providers',
  });
}

export async function googleAuthStart(_req: CustomerAuthRequest, res: Response) {
  if (!isGoogleOAuthConfigured()) {
    oauthNotConfigured(res, 'Google');
    return;
  }
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirect = getOAuthCallbackUrl('google');
  const state = createSignedOAuthState('google');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function googleAuthCallback(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    if (!code) {
      res.status(400).json({ success: false, error: { message: 'Missing code', code: 'OAUTH_VERIFICATION_FAILED' } });
      return;
    }
    if (!verifySignedOAuthState(state, 'google')) {
      res.status(400).json({ success: false, error: { message: 'Invalid OAuth state', code: 'OAUTH_VERIFICATION_FAILED' } });
      return;
    }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirect = getOAuthCallbackUrl('google');
    if (!clientId || !clientSecret) {
      oauthNotConfigured(res, 'Google');
      return;
    }
    const client = new OAuth2Client(clientId, clientSecret, redirect);
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      res.status(401).json({ success: false, error: { message: 'OAuth verification failed', code: 'OAUTH_VERIFICATION_FAILED' } });
      return;
    }
    await completeOAuthLogin(res, 'google', payload.sub, payload.email, {
      firstName: payload.given_name ?? 'User',
      lastName: payload.family_name ?? '',
    });
  } catch (err) {
    next(err);
  }
}

export async function appleAuthStart(_req: CustomerAuthRequest, res: Response) {
  if (!isAppleOAuthConfigured()) {
    oauthNotConfigured(res, 'Apple');
    return;
  }
  const state = createSignedOAuthState('apple');
  res.redirect(getAppleAuthorizationUrl(state));
}

export async function appleAuthCallback(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const code = req.body?.code as string | undefined;
    const state = req.body?.state as string | undefined;
    const userField = req.body?.user as string | undefined;
    if (!code) {
      res.status(400).json({ success: false, error: { message: 'Missing code', code: 'OAUTH_VERIFICATION_FAILED' } });
      return;
    }
    if (!verifySignedOAuthState(state, 'apple')) {
      res.status(400).json({ success: false, error: { message: 'Invalid OAuth state', code: 'OAUTH_VERIFICATION_FAILED' } });
      return;
    }
    if (!isAppleOAuthConfigured()) {
      oauthNotConfigured(res, 'Apple');
      return;
    }
    const profile = await exchangeAppleCode(code);
    const names = parseAppleUserField(userField);
    await completeOAuthLogin(res, 'apple', profile.id, profile.email, {
      firstName: names.firstName,
      lastName: names.lastName,
    });
  } catch (err) {
    next(err);
  }
}

export async function facebookAuthStart(_req: CustomerAuthRequest, res: Response) {
  if (!isFacebookOAuthConfigured()) {
    oauthNotConfigured(res, 'Facebook');
    return;
  }
  const state = createSignedOAuthState('facebook');
  res.redirect(getFacebookAuthorizationUrl(state));
}

export async function facebookAuthCallback(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    if (!code) {
      res.status(400).json({ success: false, error: { message: 'Missing code', code: 'OAUTH_VERIFICATION_FAILED' } });
      return;
    }
    if (!verifySignedOAuthState(state, 'facebook')) {
      res.status(400).json({ success: false, error: { message: 'Invalid OAuth state', code: 'OAUTH_VERIFICATION_FAILED' } });
      return;
    }
    if (!isFacebookOAuthConfigured()) {
      oauthNotConfigured(res, 'Facebook');
      return;
    }
    const profile = await exchangeFacebookCode(code);
    await completeOAuthLogin(res, 'facebook', profile.id, profile.email, {
      firstName: profile.firstName,
      lastName: profile.lastName,
    });
  } catch (err) {
    next(err);
  }
}

export async function oauthMockLogin(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    return;
  }
  try {
    const { provider, providerId, email, firstName, lastName } = req.body as {
      provider?: 'google' | 'apple' | 'facebook';
      providerId?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    };
    if (!provider || !providerId || !email) {
      res.status(400).json({ success: false, error: { message: 'Invalid mock OAuth payload', code: 'VALIDATION_ERROR' } });
      return;
    }
    const result = await customerAuthService.oauthLogin(provider, providerId, email, {
      firstName: firstName ?? 'Test',
      lastName: lastName ?? 'User',
    });
    sendSession(res, result);
  } catch (err) {
    next(err);
  }
}
