export type CustomerAccountStatus = 'Active' | 'Disabled';
export type AuthProvider = 'local' | 'google' | 'apple' | 'facebook';

export class CustomerAccount {
  id?: number;
  customerId: number;
  email: string;
  passwordHash?: string | null;
  authProvider: AuthProvider;
  googleId?: string | null;
  appleId?: string | null;
  facebookId?: string | null;
  status: CustomerAccountStatus;
  totpSecret?: string | null;
  totpEnabled: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    customerId: number;
    email: string;
    passwordHash?: string | null;
    authProvider?: string;
    googleId?: string | null;
    appleId?: string | null;
    facebookId?: string | null;
    status?: string;
    totpSecret?: string | null;
    totpEnabled?: boolean;
    lastLoginAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.customerId = data.customerId;
    this.email = data.email;
    this.passwordHash = data.passwordHash;
    this.authProvider = (data.authProvider as AuthProvider) ?? 'local';
    this.googleId = data.googleId;
    this.appleId = data.appleId;
    this.facebookId = data.facebookId;
    this.status = (data.status as CustomerAccountStatus) ?? 'Active';
    this.totpSecret = data.totpSecret;
    this.totpEnabled = data.totpEnabled ?? false;
    this.lastLoginAt = data.lastLoginAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  isActive(): boolean {
    return this.status === 'Active';
  }
}

export function toAccountPublic(account: CustomerAccount) {
  return {
    id: account.id,
    customerId: account.customerId,
    email: account.email,
    authProvider: account.authProvider,
    status: account.status,
    totpEnabled: account.totpEnabled,
    lastLoginAt: account.lastLoginAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export function toCustomerPublic(customer: {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}
