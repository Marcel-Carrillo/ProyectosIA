import { Request, Response, NextFunction } from 'express';
import { verifyAdminAccessToken } from '../application/services/adminTokenService';

export interface AdminAuthRequest extends Request {
  admin?: { id: number; email: string };
}

export function requireAdminAuth(req: AdminAuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { message: 'Authentication required', code: 'UNAUTHORIZED' },
    });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyAdminAccessToken(token);
    req.admin = { id: parseInt(payload.sub, 10), email: payload.email };
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' },
    });
  }
}
