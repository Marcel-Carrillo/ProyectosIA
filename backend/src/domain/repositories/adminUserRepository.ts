import { AdminUser } from '../models/adminUser';

export interface RefreshTokenRecord {
  adminUserId: number;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface IAdminUserRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: number): Promise<AdminUser | null>;
  storeRefreshToken(adminUserId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllRefreshTokensForAdmin(adminUserId: number): Promise<void>;
}
