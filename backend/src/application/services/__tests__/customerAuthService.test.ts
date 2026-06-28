import { CustomerAuthService, AccountEmailConflictError } from '../customerAuthService';

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    $transaction: jest.fn(),
    customerAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    customerRefreshToken: {
      create: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
    },
    coupon: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock('../../../infrastructure/email/emailService', () => ({
  sendWelcomeEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock('../../../infrastructure/email/templates/welcomeEmail', () => ({
  buildWelcomeEmail: jest.fn().mockReturnValue({
    subject: 'Mavile — Bienvenida',
    html: '<html>welcome</html>',
    text: 'welcome text',
  }),
}));

jest.mock('../welcomeCouponService', () => ({
  ensureWelcomeCouponExists: jest.fn().mockResolvedValue({
    code: 'Bienvenida15',
    percent: 15,
    expiresAt: null,
  }),
}));

jest.mock('../../../infrastructure/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../infrastructure/auth/passwordHasher', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
  verifyPassword: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../infrastructure/auth/refreshTokenUtils', () => ({
  generateRefreshTokenRaw: jest.fn().mockReturnValue('raw-refresh-token'),
  hashRefreshToken: jest.fn().mockReturnValue('hashed-refresh-token'),
  refreshTokenExpiresAt: jest.fn().mockReturnValue(new Date()),
}));

jest.mock('../customerTokenService', () => ({
  signCustomerAccessToken: jest.fn().mockReturnValue('mock-access-token'),
  signMfaToken: jest.fn().mockReturnValue('mock-mfa-token'),
  verifyMfaToken: jest.fn(),
}));

jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: { verify: jest.fn(), generate: jest.fn() },
}));

const makeCustomer = () => ({
  id: 1,
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  phone: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeAccount = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  customerId: 1,
  email: 'jane@example.com',
  authProvider: 'local',
  passwordHash: 'hashed-password',
  status: 'Active',
  totpEnabled: false,
  totpSecret: null,
  lastLoginAt: null,
  googleId: null,
  appleId: null,
  facebookId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  customer: makeCustomer(),
  ...overrides,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPrisma = () => (jest.requireMock('../../../infrastructure/prismaClient') as any).prisma;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getEmailService = () => jest.requireMock('../../../infrastructure/email/emailService') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getWelcomeCoupon = () => jest.requireMock('../welcomeCouponService') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getLogger = () => (jest.requireMock('../../../infrastructure/logger') as any).logger;

function setupTransactionMock() {
  const prisma = getPrisma();
  (prisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: unknown) => unknown) => {
    const tx = {
      customerAccount: { create: prisma.customerAccount.create },
    };
    return cb(tx);
  });
}

describe('CustomerAuthService - register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ensures shared welcome coupon and calls sendWelcomeEmail on success', async () => {
    const prisma = getPrisma();
    const emailService = getEmailService();
    const welcomeCoupon = getWelcomeCoupon();

    prisma.customerAccount.findUnique.mockResolvedValue(null);
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.create.mockResolvedValue(makeCustomer());
    prisma.customerAccount.create.mockResolvedValue(makeAccount());
    prisma.customerRefreshToken.create.mockResolvedValue({});
    emailService.sendWelcomeEmail.mockResolvedValue(undefined);
    setupTransactionMock();

    const service = new CustomerAuthService();
    const result = await service.register({
      email: 'jane@example.com',
      password: 'Password1',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(result.accessToken).toBe('mock-access-token');
    expect(welcomeCoupon.ensureWelcomeCouponExists).toHaveBeenCalledTimes(1);
    expect(prisma.coupon.create).toBeUndefined();

    await new Promise((r) => setImmediate(r));

    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ subject: expect.stringContaining('Mavile') }),
    );
  });

  it('returns success even when sendWelcomeEmail rejects (fire-and-forget)', async () => {
    const prisma = getPrisma();
    const emailService = getEmailService();
    const logger = getLogger();

    emailService.sendWelcomeEmail.mockRejectedValue(new Error('SMTP down'));
    prisma.customerAccount.findUnique.mockResolvedValue(null);
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.create.mockResolvedValue(makeCustomer());
    prisma.customerAccount.create.mockResolvedValue(makeAccount());
    prisma.customerRefreshToken.create.mockResolvedValue({});
    setupTransactionMock();

    const service = new CustomerAuthService();
    const result = await service.register({
      email: 'jane@example.com',
      password: 'Password1',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(result.accessToken).toBe('mock-access-token');
    await new Promise((r) => setImmediate(r));
    expect(logger.warn).toHaveBeenCalledWith('Welcome email failed', expect.anything());
  });

  it('throws AccountEmailConflictError when email is already taken', async () => {
    const prisma = getPrisma();
    prisma.customerAccount.findUnique.mockResolvedValue(makeAccount());

    const service = new CustomerAuthService();
    await expect(
      service.register({
        email: 'jane@example.com',
        password: 'Password1',
        firstName: 'Jane',
        lastName: 'Doe',
      }),
    ).rejects.toThrow(AccountEmailConflictError);

    expect(getWelcomeCoupon().ensureWelcomeCouponExists).not.toHaveBeenCalled();
  });
});

describe('CustomerAuthService - oauthLogin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('new-account branch ensures welcome coupon and calls sendWelcomeEmail', async () => {
    const prisma = getPrisma();
    const emailService = getEmailService();
    const welcomeCoupon = getWelcomeCoupon();

    prisma.customerAccount.findFirst.mockResolvedValue(null);
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.create.mockResolvedValue(makeCustomer());
    prisma.customerAccount.create.mockResolvedValue(makeAccount({ authProvider: 'google', googleId: 'gid-1' }));
    prisma.customerAccount.update.mockResolvedValue(makeAccount());
    prisma.customerRefreshToken.create.mockResolvedValue({});
    emailService.sendWelcomeEmail.mockResolvedValue(undefined);
    setupTransactionMock();

    const service = new CustomerAuthService();
    await service.oauthLogin('google', 'gid-1', 'jane@example.com', { firstName: 'Jane', lastName: 'Doe' });

    await new Promise((r) => setImmediate(r));

    expect(welcomeCoupon.ensureWelcomeCouponExists).toHaveBeenCalledTimes(1);
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it('existing-account with same provider does NOT send welcome email', async () => {
    const prisma = getPrisma();
    const emailService = getEmailService();

    const existingAccount = makeAccount({ googleId: 'gid-1', authProvider: 'google' });
    prisma.customerAccount.findFirst.mockResolvedValue(existingAccount);
    prisma.customerAccount.update.mockResolvedValue(existingAccount);
    prisma.customerRefreshToken.create.mockResolvedValue({});

    const service = new CustomerAuthService();
    await service.oauthLogin('google', 'gid-1', 'jane@example.com', { firstName: 'Jane', lastName: 'Doe' });

    await new Promise((r) => setImmediate(r));

    expect(getWelcomeCoupon().ensureWelcomeCouponExists).not.toHaveBeenCalled();
    expect(emailService.sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
