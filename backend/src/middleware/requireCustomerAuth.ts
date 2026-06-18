import { Request, Response, NextFunction } from 'express';
import { verifyCustomerAccessToken } from '../application/services/customerTokenService';

export interface CustomerAuthRequest extends Request {
  customer?: { accountId: number; customerId: number; email: string };
}

export function requireCustomerAuth(req: CustomerAuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { message: 'Authentication required', code: 'UNAUTHORIZED' },
    });
    return;
  }

  try {
    const payload = verifyCustomerAccessToken(header.slice(7));
    req.customer = {
      accountId: parseInt(payload.sub, 10),
      customerId: parseInt(payload.customerId, 10),
      email: payload.email,
    };
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' },
    });
  }
}
