import jwt from 'jsonwebtoken';

const CUSTOMER_ACCESS_TOKEN_EXPIRY = process.env.CUSTOMER_JWT_EXPIRES_IN ?? '15m';
const MFA_TOKEN_EXPIRY = '5m';

export interface CustomerTokenPayload {
  sub: string;
  customerId: string;
  email: string;
  aud: 'customer';
}

export interface MfaTokenPayload {
  sub: string;
  customerAccountId: string;
  aud: 'customer_mfa';
}

function getSecret(): string {
  const secret = process.env.CUSTOMER_JWT_SECRET;
  if (!secret) throw new Error('CUSTOMER_JWT_SECRET is not configured');
  return secret;
}

export function signCustomerAccessToken(payload: {
  sub: string;
  customerId: string;
  email: string;
}): string {
  return jwt.sign(
    { ...payload, aud: 'customer' as const },
    getSecret(),
    { expiresIn: CUSTOMER_ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'] }
  );
}

export function verifyCustomerAccessToken(token: string): CustomerTokenPayload {
  const decoded = jwt.verify(token, getSecret(), { audience: 'customer' }) as CustomerTokenPayload;
  if (decoded.aud !== 'customer') {
    throw new jwt.JsonWebTokenError('Invalid token audience');
  }
  return decoded;
}

export function signMfaToken(customerAccountId: number): string {
  return jwt.sign(
    { sub: String(customerAccountId), customerAccountId: String(customerAccountId), aud: 'customer_mfa' as const },
    getSecret(),
    { expiresIn: MFA_TOKEN_EXPIRY }
  );
}

export function verifyMfaToken(token: string): MfaTokenPayload {
  return jwt.verify(token, getSecret(), { audience: 'customer_mfa' }) as MfaTokenPayload;
}
