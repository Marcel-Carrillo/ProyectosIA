import { prisma } from '../../infrastructure/prismaClient';
import { CustomerAccount, toAccountPublic, toCustomerPublic } from '../../domain/models/customerAccount';
import { hashPassword, verifyPassword } from '../../infrastructure/auth/passwordHasher';
import {
  generateRefreshTokenRaw,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from '../../infrastructure/auth/refreshTokenUtils';
import { signCustomerAccessToken, signMfaToken, verifyMfaToken } from './customerTokenService';
import { ValidationError } from '../validator';
import speakeasy from 'speakeasy';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../../infrastructure/email/emailService';

export const CUSTOMER_REFRESH_COOKIE = 'customer_refresh';

export class AccountEmailConflictError extends Error {
  readonly code = 'ACCOUNT_EMAIL_CONFLICT';
  readonly status = 409;
  constructor() {
    super('An account with this email already exists');
    this.name = 'AccountEmailConflictError';
  }
}

export class InvalidCustomerCredentialsError extends Error {
  readonly code = 'INVALID_CREDENTIALS';
  readonly status = 401;
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCustomerCredentialsError';
  }
}

export class AccountDisabledError extends Error {
  readonly code = 'ACCOUNT_DISABLED';
  readonly status = 403;
  constructor() {
    super('Account is disabled');
    this.name = 'AccountDisabledError';
  }
}

export class CustomerRefreshTokenInvalidError extends Error {
  readonly code = 'REFRESH_TOKEN_INVALID';
  readonly status = 401;
  constructor() {
    super('Refresh token is invalid or expired');
    this.name = 'CustomerRefreshTokenInvalidError';
  }
}

export class ResetTokenInvalidError extends Error {
  readonly code = 'RESET_TOKEN_INVALID';
  readonly status = 400;
  constructor() {
    super('Reset token is invalid or expired');
    this.name = 'ResetTokenInvalidError';
  }
}

export class InvalidTotpCodeError extends Error {
  readonly code = 'INVALID_TOTP_CODE';
  readonly status = 401;
  constructor() {
    super('Invalid verification code');
    this.name = 'InvalidTotpCodeError';
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validatePassword(password: string): void {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new ValidationError('Password must be at least 8 characters with letters and digits');
  }
}

export class CustomerAuthService {
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    validatePassword(data.password);
    const email = normalizeEmail(data.email);

    const existingAccount = await prisma.customerAccount.findUnique({ where: { email } });
    if (existingAccount) throw new AccountEmailConflictError();

    let customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          email,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          phone: data.phone?.trim() || null,
        },
      });
    }

    const passwordHash = await hashPassword(data.password);
    const account = await prisma.customerAccount.create({
      data: {
        customerId: customer.id,
        email,
        passwordHash,
        authProvider: 'local',
      },
    });

    return this.issueFullSession(account, customer);
  }

  async login(email: string, password: string) {
    const normalized = normalizeEmail(email);
    const account = await prisma.customerAccount.findUnique({
      where: { email: normalized },
      include: { customer: true },
    });
    if (!account || !account.passwordHash) throw new InvalidCustomerCredentialsError();
    if (account.status !== 'Active') throw new AccountDisabledError();

    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) throw new InvalidCustomerCredentialsError();

    if (account.totpEnabled && account.totpSecret) {
      return {
        mfaRequired: true as const,
        mfaToken: signMfaToken(account.id),
      };
    }

    await prisma.customerAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueFullSession(account, account.customer);
  }

  async verify2fa(mfaToken: string, code: string) {
    const payload = verifyMfaToken(mfaToken);
    const accountId = parseInt(payload.customerAccountId, 10);
    const account = await prisma.customerAccount.findUnique({
      where: { id: accountId },
      include: { customer: true },
    });
    if (!account || !account.totpSecret) throw new InvalidTotpCodeError();

    const valid = speakeasy.totp.verify({
      secret: account.totpSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!valid) throw new InvalidTotpCodeError();

    await prisma.customerAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueFullSession(account, account.customer);
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const record = await prisma.customerRefreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new CustomerRefreshTokenInvalidError();
    }

    await prisma.customerRefreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });

    const account = await prisma.customerAccount.findUnique({
      where: { id: record.customerAccountId },
      include: { customer: true },
    });
    if (!account || account.status !== 'Active') throw new CustomerRefreshTokenInvalidError();

    return this.issueFullSession(account, account.customer);
  }

  async logout(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) return;
    const tokenHash = hashRefreshToken(rawRefreshToken);
    try {
      await prisma.customerRefreshToken.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    } catch {
      // ignore
    }
  }

  async forgotPassword(email: string) {
    const normalized = normalizeEmail(email);
    const account = await prisma.customerAccount.findUnique({ where: { email: normalized } });
    if (account) {
      const raw = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashRefreshToken(raw);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);
      await prisma.passwordResetToken.create({
        data: { customerAccountId: account.id, tokenHash, expiresAt },
      });
      const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
      await sendPasswordResetEmail(account.email, `${frontend}/reset-password?token=${raw}`);
    }
    return { message: 'If an account exists, a reset email has been sent' };
  }

  async resetPassword(token: string, password: string) {
    validatePassword(password);
    const tokenHash = hashRefreshToken(token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ResetTokenInvalidError();
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.customerAccount.update({
        where: { id: record.customerAccountId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
      prisma.customerRefreshToken.updateMany({
        where: { customerAccountId: record.customerAccountId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async setup2fa(customerAccountId: number) {
    const secret = speakeasy.generateSecret({ name: 'Fashion Store' });
    await prisma.customerAccount.update({
      where: { id: customerAccountId },
      data: { totpSecret: secret.base32, totpEnabled: false },
    });
    return { secret: secret.base32, otpauthUrl: secret.otpauth_url };
  }

  async confirm2fa(customerAccountId: number, code: string) {
    const account = await prisma.customerAccount.findUnique({ where: { id: customerAccountId } });
    if (!account?.totpSecret) throw new InvalidTotpCodeError();
    const valid = speakeasy.totp.verify({
      secret: account.totpSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!valid) throw new InvalidTotpCodeError();
    await prisma.customerAccount.update({
      where: { id: customerAccountId },
      data: { totpEnabled: true },
    });
  }

  async disable2fa(customerAccountId: number, password: string) {
    const account = await prisma.customerAccount.findUnique({ where: { id: customerAccountId } });
    if (!account?.passwordHash) throw new InvalidCustomerCredentialsError();
    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) throw new InvalidCustomerCredentialsError();
    await prisma.customerAccount.update({
      where: { id: customerAccountId },
      data: { totpEnabled: false, totpSecret: null },
    });
  }

  async oauthLogin(provider: 'google' | 'apple' | 'facebook', providerId: string, email: string, profile: {
    firstName: string;
    lastName: string;
  }) {
    const normalized = normalizeEmail(email);
    const idField = provider === 'google' ? 'googleId' : provider === 'apple' ? 'appleId' : 'facebookId';

    let account = await prisma.customerAccount.findFirst({
      where: { OR: [{ [idField]: providerId }, { email: normalized }] },
      include: { customer: true },
    });

    if (!account) {
      let customer = await prisma.customer.findUnique({ where: { email: normalized } });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            email: normalized,
            firstName: profile.firstName,
            lastName: profile.lastName,
          },
        });
      }
      account = await prisma.customerAccount.create({
        data: {
          customerId: customer.id,
          email: normalized,
          authProvider: provider,
          [idField]: providerId,
        },
        include: { customer: true },
      });
    } else if (!account[idField as keyof typeof account]) {
      account = await prisma.customerAccount.update({
        where: { id: account.id },
        data: { [idField]: providerId, authProvider: provider },
        include: { customer: true },
      });
    }

    if (account.status !== 'Active') throw new AccountDisabledError();
    await prisma.customerAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueFullSession(account, account.customer);
  }

  private async issueFullSession(
    account: {
      id: number;
      customerId: number;
      email: string;
      authProvider: string;
      status: string;
      totpEnabled: boolean;
      lastLoginAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    customer: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  ) {
    const accessToken = signCustomerAccessToken({
      sub: String(account.id),
      customerId: String(customer.id),
      email: account.email,
    });
    const refreshTokenRaw = generateRefreshTokenRaw();
    await prisma.customerRefreshToken.create({
      data: {
        customerAccountId: account.id,
        tokenHash: hashRefreshToken(refreshTokenRaw),
        expiresAt: refreshTokenExpiresAt(),
      },
    });

    const accountModel = new CustomerAccount({
      id: account.id,
      customerId: account.customerId,
      email: account.email,
      authProvider: account.authProvider,
      status: account.status,
      totpEnabled: account.totpEnabled,
      lastLoginAt: account.lastLoginAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    });

    return {
      account: toAccountPublic(accountModel),
      customer: toCustomerPublic(customer),
      accessToken,
      refreshTokenRaw,
    };
  }
}

export const customerAuthService = new CustomerAuthService();
