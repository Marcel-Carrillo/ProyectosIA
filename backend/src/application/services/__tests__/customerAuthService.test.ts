import { CustomerAuthService, AccountEmailConflictError } from '../customerAuthService';

// --- Prisma mock ---
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
      create: jest.fn(),
    },
  },
}));

// --- Email service mock ---
jest.mock('../../../infrastructure/email/emailService', () => ({
  sendWelcomeEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

// --- Welcome email template mock ---
jest.mock('../../../infrastructure/email/templates/welcomeEmail', () => ({
  buildWelcomeEmail: jest.fn().mockReturnValue({
    subject: 'Mavile — Bienvenida',
    html: '<html>welcome</html>',
    text: 'welcome text',
  }),
}));

// --- Logger mock ---
jest.mock('../../../infrastructure/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// --- Auth infrastructure mocks ---
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

// --- Helpers ---
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

const makeCouponResult = () => ({
  code: 'WELCOME-ABCDEF1234567890ABCDEF1234567890AB',
  percent: 15,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
});

// --- Get mock references after module load ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPrisma = () => (jest.requireMock('../../../infrastructure/prismaClient') as any).prisma;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getEmailService = () => jest.requireMock('../../../infrastructure/email/emailService') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getLogger = () => (jest.requireMock('../../../infrastructure/logger') as any).logger;

function setupTransactionMock() {
  const prisma = getPrisma();
  (prisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: unknown) => unknown) => {
    const tx = {
      customerAccount: { create: prisma.customerAccount.create },
      coupon: { create: prisma.coupon.create },
    };
    return cb(tx);
  });
}

// ============================================================
describe('CustomerAuthService - register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a Coupon with WELCOME- prefix and calls sendWelcomeEmail on success', async () => {
    const prisma = getPrisma();
    const emailService = getEmailService();

    prisma.customerAccount.findUnique.mockResolvedValue(null);
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.create.mockResolvedValue(makeCustomer());
    prisma.customerAccount.create.mockResolvedValue(makeAccount());
    prisma.coupon.create.mockResolvedValue({ id: 99 });
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

    expect(prisma.coupon.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'percentage',
          maxUses: 1,
          active: true,
        }),
      })
    );

    const couponData = (prisma.coupon.create as jest.Mock).mock.calls[0][0].data as { code: string };
    expect(couponData.code).toMatch(/^WELCOME-[A-F0-9]{32}$/);

    await new Promise((r) => setImmediate(r));

    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ subject: expect.stringContaining('Mavile') })
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
    prisma.coupon.create.mockResolvedValue({ id: 100 });
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
      })
    ).rejects.toThrow(AccountEmailConflictError);

    expect(prisma.coupon.create).not.toHaveBeenCalled();
  });
});

// ============================================================
describe('CustomerAuthService - oauthLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('new-account branch creates Coupon and calls sendWelcomeEmail', async () => {
    const prisma = getPrisma();
    const emailService = getEmailService();

    prisma.customerAccount.findFirst.mockResolvedValue(null);
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.create.mockResolvedValue(makeCustomer());
    prisma.customerAccount.create.mockResolvedValue(makeAccount({ authProvider: 'google', googleId: 'gid-1' }));
    prisma.coupon.create.mockResolvedValue({ id: 101 });
    prisma.customerAccount.update.mockResolvedValue(makeAccount());
    prisma.customerRefreshToken.create.mockResolvedValue({});
    emailService.sendWelcomeEmail.mockResolvedValue(undefined);
    setupTransactionMock();

    const service = new CustomerAuthService();
    await service.oauthLogin('google', 'gid-1', 'jane@example.com', { firstName: 'Jane', lastName: 'Doe' });

    await new Promise((r) => setImmediate(r));

    expect(prisma.coupon.create).toHaveBeenCalledTimes(1);
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it('existing-account with same provider does NOT create Coupon or call sendWelcomeEmail', async () => {
    const prisma = getPrisma();
    const emailService = getEmailService();

    const existingAccount = makeAccount({ googleId: 'gid-1', authProvider: 'google' });
    prisma.customerAccount.findFirst.mockResolvedValue(existingAccount);
    prisma.customerAccount.update.mockResolvedValue(existingAccount);
    prisma.customerRefreshToken.create.mockResolvedValue({});

    const service = new CustomerAuthService();
    await service.oauthLogin('google', 'gid-1', 'jane@example.com', { firstName: 'Jane', lastName: 'Doe' });

    await new Promise((r) => setImmediate(r));

    expect(prisma.coupon.create).not.toHaveBeenCalled();
    expect(emailService.sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('provider-link branch (existing account, new provider) does NOT create Coupon or call sendWelcomeEmail', async () => {
    const prisma = getPrisma();
    const emailService = getEmailService();

    const existingAccountNoGoogle = makeAccount({ googleId: null, authProvider: 'local' });
    prisma.customerAccount.findFirst.mockResolvedValue(existingAccountNoGoogle);
    prisma.customerAccount.update.mockResolvedValue(makeAccount({ googleId: 'gid-2', authProvider: 'google' }));
    prisma.customerRefreshToken.create.mockResolvedValue({});

    const service = new CustomerAuthService();
    await service.oauthLogin('google', 'gid-2', 'jane@example.com', { firstName: 'Jane', lastName: 'Doe' });

    await new Promise((r) => setImmediate(r));

    expect(prisma.coupon.create).not.toHaveBeenCalled();
    expect(emailService.sendWelcomeEmail).not.toHaveBeenCalled();
  });
});

// Suppress unused variable warning for makeCouponResult (reserved for future use)
void makeCouponResult;
