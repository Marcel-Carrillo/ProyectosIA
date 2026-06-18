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
  AdminRefreshTokenInvalidError,
  InvalidAdminCredentialsError,
} from '../../infrastructure/repositories/adminUserRepository';
import { signAdminAccessToken } from './adminTokenService';

export const ADMIN_REFRESH_COOKIE = 'admin_refresh';

export interface AdminAuthResult {
  admin: ReturnType<typeof toAdminPublic>;
  accessToken: string;
  refreshTokenRaw: string;
}

export class AdminAuthService {
  constructor(private readonly repo: IAdminUserRepository) {}

  async login(email: string, password: string): Promise<AdminAuthResult> {
    const normalized = email.trim().toLowerCase();
    const admin = await this.repo.findByEmail(normalized);
    if (!admin) throw new InvalidAdminCredentialsError();
    if (!admin.isActive()) throw new AdminDisabledError();

    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) throw new InvalidAdminCredentialsError();

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
