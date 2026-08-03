import { prisma } from '../prismaClient';
import { AdminUser } from '../../domain/models/adminUser';
import {
  AdminLoginChallengeRecord,
  IAdminUserRepository,
  RefreshTokenRecord,
} from '../../domain/repositories/adminUserRepository';

export class AdminNotFoundError extends Error {
  readonly code = 'ADMIN_NOT_FOUND';
  readonly status = 404;
  constructor() {
    super('Admin not found');
    this.name = 'AdminNotFoundError';
  }
}

export class AdminDisabledError extends Error {
  readonly code = 'ADMIN_DISABLED';
  readonly status = 403;
  constructor() {
    super('Admin account is disabled');
    this.name = 'AdminDisabledError';
  }
}

export class AdminRefreshTokenInvalidError extends Error {
  readonly code = 'REFRESH_TOKEN_INVALID';
  readonly status = 401;
  constructor() {
    super('Refresh token is invalid or expired');
    this.name = 'AdminRefreshTokenInvalidError';
  }
}

export class InvalidAdminCredentialsError extends Error {
  readonly code = 'INVALID_CREDENTIALS';
  readonly status = 401;
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidAdminCredentialsError';
  }
}

export class InvalidAdminOtpError extends Error {
  readonly code = 'INVALID_OTP';
  readonly status = 401;
  constructor(message = 'Invalid or expired verification code') {
    super(message);
    this.name = 'InvalidAdminOtpError';
  }
}

export class AdminOtpEmailFailedError extends Error {
  readonly code = 'ADMIN_OTP_EMAIL_FAILED';
  readonly status = 503;
  constructor() {
    super('Could not send the verification code email. Try again later.');
    this.name = 'AdminOtpEmailFailedError';
  }
}

function mapAdmin(row: {
  id: number;
  email: string;
  passwordHash: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): AdminUser {
  return new AdminUser(row);
}

export class AdminUserRepository implements IAdminUserRepository {
  async findByEmail(email: string): Promise<AdminUser | null> {
    const row = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });
    return row ? mapAdmin(row) : null;
  }

  async findById(id: number): Promise<AdminUser | null> {
    const row = await prisma.adminUser.findUnique({ where: { id } });
    return row ? mapAdmin(row) : null;
  }

  async storeRefreshToken(adminUserId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    await prisma.adminRefreshToken.create({
      data: { adminUserId, tokenHash, expiresAt },
    });
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await prisma.adminRefreshToken.findUnique({ where: { tokenHash } });
    if (!row) return null;
    return {
      adminUserId: row.adminUserId,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    try {
      await prisma.adminRefreshToken.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    } catch {
      // token already gone — ignore
    }
  }

  async revokeAllRefreshTokensForAdmin(adminUserId: number): Promise<void> {
    await prisma.adminRefreshToken.updateMany({
      where: { adminUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async consumeOpenLoginChallenges(adminUserId: number): Promise<void> {
    await prisma.adminLoginChallenge.updateMany({
      where: { adminUserId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  async createLoginChallenge(
    adminUserId: number,
    codeHash: string,
    expiresAt: Date,
  ): Promise<AdminLoginChallengeRecord> {
    const row = await prisma.adminLoginChallenge.create({
      data: { adminUserId, codeHash, expiresAt },
    });
    return mapChallenge(row);
  }

  async findLatestOpenLoginChallenge(adminUserId: number): Promise<AdminLoginChallengeRecord | null> {
    const row = await prisma.adminLoginChallenge.findFirst({
      where: { adminUserId, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return row ? mapChallenge(row) : null;
  }

  async incrementLoginChallengeFailures(challengeId: number): Promise<AdminLoginChallengeRecord> {
    const row = await prisma.adminLoginChallenge.update({
      where: { id: challengeId },
      data: { failedAttempts: { increment: 1 } },
    });
    return mapChallenge(row);
  }

  async consumeLoginChallenge(challengeId: number): Promise<void> {
    await prisma.adminLoginChallenge.update({
      where: { id: challengeId },
      data: { consumedAt: new Date() },
    });
  }
}

function mapChallenge(row: {
  id: number;
  adminUserId: number;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  failedAttempts: number;
}): AdminLoginChallengeRecord {
  return {
    id: row.id,
    adminUserId: row.adminUserId,
    codeHash: row.codeHash,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
    failedAttempts: row.failedAttempts,
  };
}
