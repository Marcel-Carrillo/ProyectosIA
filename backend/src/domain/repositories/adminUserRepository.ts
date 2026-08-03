import { AdminUser } from '../models/adminUser';

export interface RefreshTokenRecord {
  adminUserId: number;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface AdminLoginChallengeRecord {
  id: number;
  adminUserId: number;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  failedAttempts: number;
}

export interface IAdminUserRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: number): Promise<AdminUser | null>;
  storeRefreshToken(adminUserId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllRefreshTokensForAdmin(adminUserId: number): Promise<void>;
  consumeOpenLoginChallenges(adminUserId: number): Promise<void>;
  createLoginChallenge(
    adminUserId: number,
    codeHash: string,
    expiresAt: Date,
  ): Promise<AdminLoginChallengeRecord>;
  findLatestOpenLoginChallenge(adminUserId: number): Promise<AdminLoginChallengeRecord | null>;
  incrementLoginChallengeFailures(challengeId: number): Promise<AdminLoginChallengeRecord>;
  consumeLoginChallenge(challengeId: number): Promise<void>;
}
