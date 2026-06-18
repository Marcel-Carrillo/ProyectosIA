import crypto from 'crypto';

export function generateRefreshTokenRaw(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function refreshTokenExpiresAt(days = 7): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires;
}
