import { Response, NextFunction } from 'express';
import { AdminAuthService, ADMIN_REFRESH_COOKIE } from '../../application/services/adminAuthService';
import { AdminUserRepository } from '../../infrastructure/repositories/adminUserRepository';
import { AdminAuthRequest } from '../../middleware/requireAdminAuth';

const adminAuthService = new AdminAuthService(new AdminUserRepository());

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  signed: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

function setRefreshCookie(res: Response, raw: string): void {
  res.cookie(ADMIN_REFRESH_COOKIE, raw, COOKIE_OPTIONS);
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(ADMIN_REFRESH_COOKIE, { path: '/' });
}

export async function adminLogin(
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { message: 'Email and password are required', code: 'VALIDATION_ERROR' },
      });
      return;
    }
    const result = await adminAuthService.login(email, password);
    setRefreshCookie(res, result.refreshTokenRaw);
    res.json({
      success: true,
      data: { admin: result.admin, accessToken: result.accessToken },
      message: 'Login successful',
    });
  } catch (err) {
    next(err);
  }
}

export async function adminRefresh(
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const raw = req.signedCookies?.[ADMIN_REFRESH_COOKIE] as string | undefined;
    if (!raw) {
      res.status(401).json({
        success: false,
        error: { message: 'Refresh token missing', code: 'REFRESH_TOKEN_INVALID' },
      });
      return;
    }
    const result = await adminAuthService.refresh(raw);
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

export async function adminLogout(
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const raw = req.signedCookies?.[ADMIN_REFRESH_COOKIE] as string | undefined;
    await adminAuthService.logout(raw);
    clearRefreshCookie(res);
    res.json({ success: true, data: null, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function adminMe(
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'UNAUTHORIZED' },
      });
      return;
    }
    const admin = await adminAuthService.getMe(req.admin.id);
    res.json({ success: true, data: { admin }, message: 'Admin profile retrieved' });
  } catch (err) {
    next(err);
  }
}
