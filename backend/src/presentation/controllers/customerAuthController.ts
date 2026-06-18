import { Response, NextFunction } from 'express';
import {
  customerAuthService,
  CUSTOMER_REFRESH_COOKIE,
} from '../../application/services/customerAuthService';
import { CustomerAuthRequest } from '../../middleware/requireCustomerAuth';
import { OAuth2Client } from 'google-auth-library';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

function setRefreshCookie(res: Response, raw: string): void {
  res.cookie(CUSTOMER_REFRESH_COOKIE, raw, COOKIE_OPTIONS);
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
    const raw = req.cookies?.[CUSTOMER_REFRESH_COOKIE] as string | undefined;
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
    const raw = req.cookies?.[CUSTOMER_REFRESH_COOKIE] as string | undefined;
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

export async function googleAuthStart(_req: CustomerAuthRequest, res: Response) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirect = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/oauth/google/callback`;
  if (!clientId) {
    res.status(501).json({
      success: false,
      error: { message: 'Google OAuth not configured', code: 'OAUTH_NOT_CONFIGURED' },
    });
    return;
  }
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=openid%20email%20profile`;
  res.redirect(url);
}

export async function googleAuthCallback(req: CustomerAuthRequest, res: Response, next: NextFunction) {
  try {
    const code = req.query.code as string | undefined;
    if (!code) {
      res.status(400).json({ success: false, error: { message: 'Missing code', code: 'OAUTH_VERIFICATION_FAILED' } });
      return;
    }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirect = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/oauth/google/callback`;
    if (!clientId || !clientSecret) {
      res.status(501).json({ success: false, error: { message: 'Google OAuth not configured', code: 'OAUTH_NOT_CONFIGURED' } });
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
    const result = await customerAuthService.oauthLogin('google', payload.sub, payload.email, {
      firstName: payload.given_name ?? 'User',
      lastName: payload.family_name ?? '',
    });
    setRefreshCookie(res, result.refreshTokenRaw);
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    res.redirect(`${frontend}/account?token=${result.accessToken}`);
  } catch (err) {
    next(err);
  }
}

export async function appleAuthStart(_req: CustomerAuthRequest, res: Response) {
  res.status(501).json({
    success: false,
    error: { message: 'Apple OAuth requires production credentials', code: 'OAUTH_NOT_CONFIGURED' },
  });
}

export async function facebookAuthStart(_req: CustomerAuthRequest, res: Response) {
  res.status(501).json({
    success: false,
    error: { message: 'Facebook OAuth requires production credentials', code: 'OAUTH_NOT_CONFIGURED' },
  });
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
