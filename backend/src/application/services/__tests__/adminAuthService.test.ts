import { AdminAuthService } from '../adminAuthService';
import { IAdminUserRepository } from '../../../domain/repositories/adminUserRepository';
import { AdminUser } from '../../../domain/models/adminUser';
import {
  InvalidAdminCredentialsError,
  InvalidAdminOtpError,
} from '../../../infrastructure/repositories/adminUserRepository';
import { signAdminMfaToken } from '../adminTokenService';

jest.mock('../../../infrastructure/email/emailService', () => ({
  sendAdminLoginOtpEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../infrastructure/auth/passwordHasher', () => ({
  verifyPassword: jest.fn(),
}));

import { verifyPassword } from '../../../infrastructure/auth/passwordHasher';
import { sendAdminLoginOtpEmail } from '../../../infrastructure/email/emailService';

const mockVerifyPassword = verifyPassword as jest.MockedFunction<typeof verifyPassword>;
const mockSendOtp = sendAdminLoginOtpEmail as jest.MockedFunction<typeof sendAdminLoginOtpEmail>;

function makeAdmin(over: Partial<ConstructorParameters<typeof AdminUser>[0]> = {}) {
  return new AdminUser({
    id: 1,
    email: 'admin@example.com',
    passwordHash: 'hash',
    status: 'Active',
    ...over,
  });
}

describe('AdminAuthService MFA', () => {
  let repo: jest.Mocked<IAdminUserRepository>;
  let service: AdminAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret-minimum-32-chars!!';
    repo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      storeRefreshToken: jest.fn(),
      findRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllRefreshTokensForAdmin: jest.fn(),
      consumeOpenLoginChallenges: jest.fn(),
      createLoginChallenge: jest.fn().mockResolvedValue({
        id: 10,
        adminUserId: 1,
        codeHash: 'x',
        expiresAt: new Date(Date.now() + 60_000),
        consumedAt: null,
        failedAttempts: 0,
      }),
      findLatestOpenLoginChallenge: jest.fn(),
      incrementLoginChallengeFailures: jest.fn(),
      consumeLoginChallenge: jest.fn(),
    };
    service = new AdminAuthService(repo);
  });

  it('returns mfaRequired after valid password and emails OTP', async () => {
    repo.findByEmail.mockResolvedValue(makeAdmin());
    mockVerifyPassword.mockResolvedValue(true);

    const result = await service.login('admin@example.com', 'AdminPass1');

    expect(result.mfaRequired).toBe(true);
    expect(result.mfaToken).toBeTruthy();
    expect(repo.consumeOpenLoginChallenges).toHaveBeenCalledWith(1);
    expect(repo.createLoginChallenge).toHaveBeenCalled();
    expect(mockSendOtp).toHaveBeenCalledWith('admin@example.com', expect.stringMatching(/^\d{6}$/));
  });

  it('rejects invalid password without sending OTP', async () => {
    repo.findByEmail.mockResolvedValue(makeAdmin());
    mockVerifyPassword.mockResolvedValue(false);

    await expect(service.login('admin@example.com', 'wrong')).rejects.toBeInstanceOf(
      InvalidAdminCredentialsError,
    );
    expect(mockSendOtp).not.toHaveBeenCalled();
  });

  it('issues a session when OTP is valid', async () => {
    const code = '123456';
    const crypto = await import('crypto');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    repo.findById.mockResolvedValue(makeAdmin());
    repo.findLatestOpenLoginChallenge.mockResolvedValue({
      id: 10,
      adminUserId: 1,
      codeHash,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      failedAttempts: 0,
    });
    repo.storeRefreshToken.mockResolvedValue(undefined);

    const result = await service.verify2fa(signAdminMfaToken(1), code);

    expect(result.accessToken).toBeTruthy();
    expect(result.admin.email).toBe('admin@example.com');
    expect(repo.consumeLoginChallenge).toHaveBeenCalledWith(10);
  });

  it('rejects a wrong OTP and increments failures', async () => {
    repo.findById.mockResolvedValue(makeAdmin());
    repo.findLatestOpenLoginChallenge.mockResolvedValue({
      id: 10,
      adminUserId: 1,
      codeHash: 'not-matching',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      failedAttempts: 0,
    });
    repo.incrementLoginChallengeFailures.mockResolvedValue({
      id: 10,
      adminUserId: 1,
      codeHash: 'not-matching',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      failedAttempts: 1,
    });

    await expect(service.verify2fa(signAdminMfaToken(1), '000000')).rejects.toBeInstanceOf(
      InvalidAdminOtpError,
    );
    expect(repo.incrementLoginChallengeFailures).toHaveBeenCalledWith(10);
  });
});
