import jwt from 'jsonwebtoken';

const ADMIN_ACCESS_TOKEN_EXPIRY = process.env.ADMIN_JWT_EXPIRES_IN ?? '15m';
const ADMIN_MFA_TOKEN_EXPIRY: jwt.SignOptions['expiresIn'] = '10m';

export interface AdminTokenPayload {
  sub: string;
  email: string;
  aud: 'admin';
}

export interface AdminMfaTokenPayload {
  sub: string;
  adminUserId: string;
  aud: 'admin_mfa';
}

function getSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error('ADMIN_JWT_SECRET is not configured');
  return secret;
}

export function signAdminAccessToken(payload: { sub: string; email: string }): string {
  return jwt.sign(
    { ...payload, aud: 'admin' as const },
    getSecret(),
    { expiresIn: ADMIN_ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'] }
  );
}

export function verifyAdminAccessToken(token: string): AdminTokenPayload {
  const decoded = jwt.verify(token, getSecret(), { audience: 'admin' }) as AdminTokenPayload;
  if (decoded.aud !== 'admin') {
    throw new jwt.JsonWebTokenError('Invalid token audience');
  }
  return decoded;
}

export function signAdminMfaToken(adminUserId: number): string {
  return jwt.sign(
    {
      sub: String(adminUserId),
      adminUserId: String(adminUserId),
      aud: 'admin_mfa' as const,
    },
    getSecret(),
    { expiresIn: ADMIN_MFA_TOKEN_EXPIRY },
  );
}

export function verifyAdminMfaToken(token: string): AdminMfaTokenPayload {
  return jwt.verify(token, getSecret(), { audience: 'admin_mfa' }) as AdminMfaTokenPayload;
}
