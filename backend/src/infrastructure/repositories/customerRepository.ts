import { prisma } from '../prismaClient';
import { Customer, CustomerAddress } from '../../domain/models/customer';
import {
  ICustomerRepository,
  CustomerCreateData,
  CustomerUpdateData,
  CustomerListFilters,
  CustomerListResult,
  AddressCreateData,
  AddressUpdateData,
} from '../../domain/repositories/customerRepository';

// ─── Domain error classes ────────────────────────────────────────────────────

export class CustomerNotFoundError extends Error {
  readonly code = 'CUSTOMER_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Customer not found');
    this.name = 'CustomerNotFoundError';
    Object.setPrototypeOf(this, CustomerNotFoundError.prototype);
  }
}

export class CustomerEmailConflictError extends Error {
  readonly code = 'CUSTOMER_EMAIL_CONFLICT' as const;
  readonly status = 409;

  constructor() {
    super('A customer with that email already exists');
    this.name = 'CustomerEmailConflictError';
    Object.setPrototypeOf(this, CustomerEmailConflictError.prototype);
  }
}

export class CustomerHasOrdersError extends Error {
  readonly code = 'CUSTOMER_HAS_ORDERS' as const;
  readonly status = 409;

  constructor() {
    super('Cannot delete a customer who has associated orders');
    this.name = 'CustomerHasOrdersError';
    Object.setPrototypeOf(this, CustomerHasOrdersError.prototype);
  }
}

export class AddressNotFoundError extends Error {
  readonly code = 'ADDRESS_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Address not found');
    this.name = 'AddressNotFoundError';
    Object.setPrototypeOf(this, AddressNotFoundError.prototype);
  }
}

// ─── Repository implementation ───────────────────────────────────────────────

export class CustomerRepository implements ICustomerRepository {
  async findAll(filters: CustomerListFilters = {}): Promise<CustomerListResult> {
    const page =
      filters.page != null && Number.isFinite(filters.page) && filters.page >= 1
        ? filters.page
        : 1;
    const pageSize =
      filters.pageSize != null && Number.isFinite(filters.pageSize) && filters.pageSize >= 1
        ? filters.pageSize
        : 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (filters.search) {
      where['OR'] = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      items: rows.map((r) => new Customer(r)),
      total,
      page,
      pageSize,
    };
  }

  async findById(id: number): Promise<Customer | null> {
    const row = await prisma.customer.findUnique({
      where: { id },
      include: { addresses: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) return null;
    return new Customer({
      ...row,
      addresses: row.addresses.map((a) => new CustomerAddress(a)),
    });
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const row = await prisma.customer.findUnique({ where: { email } });
    return row ? new Customer(row) : null;
  }

  async create(data: CustomerCreateData): Promise<Customer> {
    const row = await prisma.customer.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone ?? null,
      },
    });
    return new Customer(row);
  }

  async update(id: number, data: CustomerUpdateData): Promise<Customer> {
    const row = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
    });
    return new Customer(row);
  }

  async countOrders(customerId: number): Promise<number> {
    // TODO: Replace with `prisma.customerOrder.count({ where: { customerId } })`
    // once the CustomerOrder model is added to the schema in a future feature.
    void customerId;
    return 0;
  }

  async delete(id: number): Promise<void> {
    await prisma.customer.delete({ where: { id } });
  }

  async findAddressesByCustomerId(customerId: number): Promise<CustomerAddress[]> {
    const rows = await prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => new CustomerAddress(r));
  }

  async findAddressById(id: number, customerId: number): Promise<CustomerAddress | null> {
    const row = await prisma.customerAddress.findFirst({
      where: { id, customerId },
    });
    return row ? new CustomerAddress(row) : null;
  }

  async createAddress(customerId: number, data: AddressCreateData): Promise<CustomerAddress> {
    const row = await prisma.customerAddress.create({
      data: {
        customerId,
        type: data.type,
        fullName: data.fullName,
        phone: data.phone ?? null,
        streetLine1: data.streetLine1,
        streetLine2: data.streetLine2 ?? null,
        city: data.city,
        province: data.province,
        postalCode: data.postalCode,
        country: data.country,
      },
    });
    return new CustomerAddress(row);
  }

  async updateAddress(id: number, data: AddressUpdateData): Promise<CustomerAddress> {
    const row = await prisma.customerAddress.update({
      where: { id },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.streetLine1 !== undefined && { streetLine1: data.streetLine1 }),
        ...(data.streetLine2 !== undefined && { streetLine2: data.streetLine2 }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.province !== undefined && { province: data.province }),
        ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
        ...(data.country !== undefined && { country: data.country }),
      },
    });
    return new CustomerAddress(row);
  }

  async deleteAddress(id: number): Promise<void> {
    await prisma.customerAddress.delete({ where: { id } });
  }
}
