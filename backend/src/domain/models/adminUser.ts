export type AdminStatus = 'Active' | 'Disabled';

export class AdminUser {
  id?: number;
  email: string;
  passwordHash: string;
  status: AdminStatus;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    email: string;
    passwordHash: string;
    status?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.email = data.email;
    this.passwordHash = data.passwordHash;
    this.status = (data.status as AdminStatus) ?? 'Active';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  isActive(): boolean {
    return this.status === 'Active';
  }
}

export function toAdminPublic(admin: AdminUser) {
  return {
    id: admin.id,
    email: admin.email,
    status: admin.status,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}
