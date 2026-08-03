import crypto from 'crypto';
import { verifyPassword } from '../../infrastructure/auth/passwordHasher';
import {
  generateRefreshTokenRaw,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from '../../infrastructure/auth/refreshTokenUtils';
import { AdminUser, toAdminPublic } from '../../domain/models/adminUser';
import { IAdminUserRepository } from '../../domain/repositories/adminUserRepository';
import {
  AdminDisabledError,
  AdminNotFoundError,
  AdminOtpEmailFailedError,
  AdminRefreshTokenInvalidError,
  InvalidAdminCredentialsError,
  InvalidAdminOtpError,
} from '../../infrastructure/repositories/adminUserRepository';
import { sendAdminLoginOtpEmail } from '../../infrastructure/email/emailService';
import { signAdminAccessToken, signAdminMfaToken, verifyAdminMfaToken } from './adminTokenService';

export const ADMIN_REFRESH_COOKIE = 'admin_refresh';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_FAILURES = 5;

export interface AdminAuthResult {
  admin: ReturnType<typeof toAdminPublic>;
  accessToken: string;
  refreshTokenRaw: string;
}

export interface AdminMfaChallengeResult {
  mfaRequired: true;
  mfaToken: string;
}

function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashOtpCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export class AdminAuthService {
  constructor(private readonly repo: IAdminUserRepository) {}

  async login(email: string, password: string): Promise<AdminMfaChallengeResult> {
    const normalized = email.trim().toLowerCase();
    const admin = await this.repo.findByEmail(normalized);
    if (!admin) throw new InvalidAdminCredentialsError();
    if (!admin.isActive()) throw new AdminDisabledError();

    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) throw new InvalidAdminCredentialsError();

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.repo.consumeOpenLoginChallenges(admin.id!);
    await this.repo.createLoginChallenge(admin.id!, hashOtpCode(code), expiresAt);

    try {
      await sendAdminLoginOtpEmail(admin.email, code);
    } catch (err) {
      if (err instanceof AdminOtpEmailFailedError) throw err;
      throw new AdminOtpEmailFailedError();
    }

    return {
      mfaRequired: true,
      mfaToken: signAdminMfaToken(admin.id!),
    };
  }

  async verify2fa(mfaToken: string, code: string): Promise<AdminAuthResult> {
    let payload;
    try {
      payload = verifyAdminMfaToken(mfaToken);
    } catch {
      throw new InvalidAdminOtpError('Invalid or expired verification session');
    }

    const adminUserId = Number(payload.adminUserId || payload.sub);
    if (!Number.isInteger(adminUserId) || adminUserId <= 0) {
      throw new InvalidAdminOtpError('Invalid or expired verification session');
    }

    const admin = await this.repo.findById(adminUserId);
    if (!admin) throw new InvalidAdminOtpError();
    if (!admin.isActive()) throw new AdminDisabledError();

    const challenge = await this.repo.findLatestOpenLoginChallenge(adminUserId);
    if (!challenge || challenge.expiresAt < new Date()) {
      if (challenge) await this.repo.consumeLoginChallenge(challenge.id);
      throw new InvalidAdminOtpError();
    }

    const normalizedCode = code.trim();
    if (!/^\d{6}$/.test(normalizedCode) || hashOtpCode(normalizedCode) !== challenge.codeHash) {
      const updated = await this.repo.incrementLoginChallengeFailures(challenge.id);
      if (updated.failedAttempts >= OTP_MAX_FAILURES) {
        await this.repo.consumeLoginChallenge(challenge.id);
      }
      throw new InvalidAdminOtpError();
    }

    await this.repo.consumeLoginChallenge(challenge.id);
    return this.issueSession(admin);
  }

  async refresh(rawRefreshToken: string): Promise<AdminAuthResult> {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const record = await this.repo.findRefreshToken(tokenHash);
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new AdminRefreshTokenInvalidError();
    }

    await this.repo.revokeRefreshToken(tokenHash);
    const admin = await this.repo.findById(record.adminUserId);
    if (!admin) throw new AdminRefreshTokenInvalidError();
    if (!admin.isActive()) throw new AdminDisabledError();

    return this.issueSession(admin);
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    await this.repo.revokeRefreshToken(hashRefreshToken(rawRefreshToken));
  }

  async getMe(adminId: number): Promise<ReturnType<typeof toAdminPublic>> {
    const admin = await this.repo.findById(adminId);
    if (!admin) throw new AdminNotFoundError();
    return toAdminPublic(admin);
  }

  private async issueSession(admin: AdminUser): Promise<AdminAuthResult> {
    const accessToken = signAdminAccessToken({
      sub: String(admin.id),
      email: admin.email,
    });
    const refreshTokenRaw = generateRefreshTokenRaw();
    await this.repo.storeRefreshToken(
      admin.id!,
      hashRefreshToken(refreshTokenRaw),
      refreshTokenExpiresAt()
    );
    return {
      admin: toAdminPublic(admin),
      accessToken,
      refreshTokenRaw,
    };
  }
}
