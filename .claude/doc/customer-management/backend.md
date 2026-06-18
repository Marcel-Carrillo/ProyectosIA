# Backend Implementation Plan: Customer Management (KAN-17)

## Overview

This plan describes the exact files to create or modify for the customer management backend feature, following the DDD layered architecture established by the supplier-management feature. Read the supplier-management pattern files before implementing anything.

**Affected layers (in implementation order):**
1. Prisma schema (Infrastructure prerequisite)
2. Domain model (Domain layer)
3. Domain repository interface (Domain layer)
4. Infrastructure repository + error classes (Infrastructure layer)
5. Validator additions (Application layer)
6. Service (Application layer)
7. Controller (Presentation layer)
8. Routes (Presentation layer)
9. Route index export (Wiring)
10. App entry point registration (Wiring)
11. Error handler (Wiring)

**Migration note:** After modifying `schema.prisma`, run `npx prisma migrate dev --name add_customer_and_customer_address` from the `backend/` directory before starting any implementation work.

---

## File 1: `backend/prisma/schema.prisma` — MODIFY

**Action:** Append two new models at the end of the file (after `ProductImage`).

```prisma
model Customer {
  id        Int               @id @default(autoincrement())
  firstName String            @db.VarChar(100)
  lastName  String            @db.VarChar(100)
  email     String            @unique @db.VarChar(255)
  phone     String?           @db.VarChar(30)
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
  addresses CustomerAddress[]
}

model CustomerAddress {
  id          Int      @id @default(autoincrement())
  customerId  Int
  customer    Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  type        String   @db.VarChar(20)
  fullName    String   @db.VarChar(150)
  phone       String?  @db.VarChar(30)
  streetLine1 String   @db.VarChar(150)
  streetLine2 String?  @db.VarChar(150)
  city        String   @db.VarChar(100)
  province    String   @db.VarChar(100)
  postalCode  String   @db.VarChar(20)
  country     String   @db.VarChar(100)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Notes:**
- `email` has `@unique` at the database level.
- `onDelete: Cascade` on `CustomerAddress.customer` ensures addresses are physically removed when the parent customer is deleted. The service-layer delete guard (`countOrders`) prevents deletion of customers who have orders, so the cascade only fires in the safe case.
- `type` is `VarChar(20)` — the valid values are `Shipping` and `Billing`, enforced at the validator level.

---

## File 2: `backend/src/domain/models/customer.ts` — CREATE

```typescript
export class Customer {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  addresses?: CustomerAddress[];

  constructor(data: {
    id?: number;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
    addresses?: CustomerAddress[];
  }) {
    this.id = data.id;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.email = data.email;
    this.phone = data.phone ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.addresses = data.addresses;
  }
}

export class CustomerAddress {
  id?: number;
  customerId: number;
  type: string;
  fullName: string;
  phone?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    customerId: number;
    type: string;
    fullName: string;
    phone?: string | null;
    streetLine1: string;
    streetLine2?: string | null;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.customerId = data.customerId;
    this.type = data.type;
    this.fullName = data.fullName;
    this.phone = data.phone ?? null;
    this.streetLine1 = data.streetLine1;
    this.streetLine2 = data.streetLine2 ?? null;
    this.city = data.city;
    this.province = data.province;
    this.postalCode = data.postalCode;
    this.country = data.country;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
```

**Notes:**
- `addresses` on `Customer` is optional because the list endpoint does not load addresses (only `findById` does). The service decides whether to include them.
- Both classes are plain TypeScript — no Prisma references.

---

## File 3: `backend/src/domain/repositories/customerRepository.ts` — CREATE

```typescript
import { Customer, CustomerAddress } from '../models/customer';

export interface CustomerCreateData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
}

export interface CustomerUpdateData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
}

export interface CustomerListFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerListResult {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AddressCreateData {
  type: string;
  fullName: string;
  phone?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export interface AddressUpdateData {
  type?: string;
  fullName?: string;
  phone?: string | null;
  streetLine1?: string;
  streetLine2?: string | null;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

export interface ICustomerRepository {
  findAll(filters?: CustomerListFilters): Promise<CustomerListResult>;
  findById(id: number): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  create(data: CustomerCreateData): Promise<Customer>;
  update(id: number, data: CustomerUpdateData): Promise<Customer>;
  countOrders(customerId: number): Promise<number>;
  delete(id: number): Promise<void>;
  findAddressesByCustomerId(customerId: number): Promise<CustomerAddress[]>;
  findAddressById(id: number, customerId: number): Promise<CustomerAddress | null>;
  createAddress(customerId: number, data: AddressCreateData): Promise<CustomerAddress>;
  updateAddress(id: number, data: AddressUpdateData): Promise<CustomerAddress>;
  deleteAddress(id: number): Promise<void>;
}
```

**Notes:**
- `findByEmail` is used by the service for uniqueness checks before create and update. The service does the `id !== currentId` comparison for the update case.
- `findAddressById(id, customerId)` enforces ownership at the repository level by filtering on both `id` and `customerId`.
- `countOrders` returns a `Promise<number>` — see the infrastructure implementation note about this being a stub until `CustomerOrder` is added.

---

## File 4: `backend/src/infrastructure/repositories/customerRepository.ts` — CREATE

```typescript
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
    // Until then, this stub safely allows deletion of any customer.
    void customerId;
    return 0;
  }

  async delete(id: number): Promise<void> {
    await prisma.customer.delete({ where: { id } });
    // CustomerAddress rows are removed automatically via onDelete: Cascade.
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
```

**Notes:**
- `findAll` does NOT include addresses — for list performance. Only `findById` includes them.
- `findAddressById` uses `findFirst` with both `id` and `customerId` to enforce ownership in a single query.
- `countOrders` is a stub returning 0 until `CustomerOrder` is added. The `void customerId` line silences the unused-variable TypeScript warning without altering logic.
- `update` in the repository does NOT check for customer existence — the service already performs that check before calling update. This matches the supplier pattern.
- The `delete` method calls `prisma.customer.delete` directly; the Prisma cascade handles addresses. A missing customer here would throw a Prisma `P2025` error, which falls through to the generic error handler as a 500. The service always checks existence before calling delete, so this path is only reached in unexpected race conditions.

---

## File 5: `backend/src/application/validator.ts` — MODIFY

**Action:** Append the following two functions at the end of the existing file. Do not modify any existing code.

```typescript
const CUSTOMER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCustomerData(
  data: Record<string, unknown>,
  options: { requireFields?: boolean } = { requireFields: true }
): void {
  const firstName = data['firstName'];
  if (options.requireFields !== false) {
    if (firstName === undefined || firstName === null || firstName === '') {
      throw new ValidationError("Field 'firstName' is required");
    }
  }
  if (firstName !== undefined && firstName !== null && firstName !== '') {
    if (typeof firstName === 'string' && firstName.length > 100) {
      throw new ValidationError("Field 'firstName' must not exceed 100 characters");
    }
  }

  const lastName = data['lastName'];
  if (options.requireFields !== false) {
    if (lastName === undefined || lastName === null || lastName === '') {
      throw new ValidationError("Field 'lastName' is required");
    }
  }
  if (lastName !== undefined && lastName !== null && lastName !== '') {
    if (typeof lastName === 'string' && lastName.length > 100) {
      throw new ValidationError("Field 'lastName' must not exceed 100 characters");
    }
  }

  const email = data['email'];
  if (options.requireFields !== false) {
    if (email === undefined || email === null || email === '') {
      throw new ValidationError("Field 'email' is required");
    }
  }
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string') {
      throw new ValidationError("Field 'email' must be a string");
    }
    if (email.length > 255) {
      throw new ValidationError("Field 'email' must not exceed 255 characters");
    }
    if (!CUSTOMER_EMAIL_REGEX.test(email)) {
      throw new ValidationError("Field 'email' must be a valid email address");
    }
  }

  const phone = data['phone'];
  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone === 'string' && phone.length > 30) {
      throw new ValidationError("Field 'phone' must not exceed 30 characters");
    }
  }
}

export function validateCustomerAddressData(
  data: Record<string, unknown>,
  options: { requireAll?: boolean } = { requireAll: true }
): void {
  const VALID_TYPES = ['Shipping', 'Billing'];

  const type = data['type'];
  if (options.requireAll !== false) {
    if (type === undefined || type === null || type === '') {
      throw new ValidationError("Field 'type' is required");
    }
  }
  if (type !== undefined && type !== null && type !== '') {
    if (!VALID_TYPES.includes(type as string)) {
      throw new ValidationError(`Field 'type' must be one of: ${VALID_TYPES.join(', ')}`);
    }
  }

  const fullName = data['fullName'];
  if (options.requireAll !== false) {
    if (fullName === undefined || fullName === null || fullName === '') {
      throw new ValidationError("Field 'fullName' is required");
    }
  }
  if (fullName !== undefined && fullName !== null && fullName !== '') {
    if (typeof fullName === 'string' && fullName.length > 150) {
      throw new ValidationError("Field 'fullName' must not exceed 150 characters");
    }
  }

  const streetLine1 = data['streetLine1'];
  if (options.requireAll !== false) {
    if (streetLine1 === undefined || streetLine1 === null || streetLine1 === '') {
      throw new ValidationError("Field 'streetLine1' is required");
    }
  }
  if (streetLine1 !== undefined && streetLine1 !== null && streetLine1 !== '') {
    if (typeof streetLine1 === 'string' && streetLine1.length > 150) {
      throw new ValidationError("Field 'streetLine1' must not exceed 150 characters");
    }
  }

  const streetLine2 = data['streetLine2'];
  if (streetLine2 !== undefined && streetLine2 !== null && streetLine2 !== '') {
    if (typeof streetLine2 === 'string' && streetLine2.length > 150) {
      throw new ValidationError("Field 'streetLine2' must not exceed 150 characters");
    }
  }

  const city = data['city'];
  if (options.requireAll !== false) {
    if (city === undefined || city === null || city === '') {
      throw new ValidationError("Field 'city' is required");
    }
  }
  if (city !== undefined && city !== null && city !== '') {
    if (typeof city === 'string' && city.length > 100) {
      throw new ValidationError("Field 'city' must not exceed 100 characters");
    }
  }

  const province = data['province'];
  if (options.requireAll !== false) {
    if (province === undefined || province === null || province === '') {
      throw new ValidationError("Field 'province' is required");
    }
  }
  if (province !== undefined && province !== null && province !== '') {
    if (typeof province === 'string' && province.length > 100) {
      throw new ValidationError("Field 'province' must not exceed 100 characters");
    }
  }

  const postalCode = data['postalCode'];
  if (options.requireAll !== false) {
    if (postalCode === undefined || postalCode === null || postalCode === '') {
      throw new ValidationError("Field 'postalCode' is required");
    }
  }
  if (postalCode !== undefined && postalCode !== null && postalCode !== '') {
    if (typeof postalCode === 'string' && postalCode.length > 20) {
      throw new ValidationError("Field 'postalCode' must not exceed 20 characters");
    }
  }

  const country = data['country'];
  if (options.requireAll !== false) {
    if (country === undefined || country === null || country === '') {
      throw new ValidationError("Field 'country' is required");
    }
  }
  if (country !== undefined && country !== null && country !== '') {
    if (typeof country === 'string' && country.length > 100) {
      throw new ValidationError("Field 'country' must not exceed 100 characters");
    }
  }

  const phone = data['phone'];
  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone === 'string' && phone.length > 30) {
      throw new ValidationError("Field 'phone' must not exceed 30 characters");
    }
  }
}
```

**Notes:**
- `validateCustomerData` uses `options.requireFields` (default true for create, false for update PATCH).
- `validateCustomerAddressData` uses `options.requireAll` (default true for create, false for update PATCH).
- The validator only sees raw input data — email normalization (trim+lowercase) happens in the service BEFORE calling the validator, so the validator receives the already-normalized email.
- `CUSTOMER_EMAIL_REGEX` is defined locally (not shared with the supplier one) to keep things independent.

---

## File 6: `backend/src/application/services/customerService.ts` — CREATE

```typescript
import {
  ICustomerRepository,
  CustomerCreateData,
  CustomerUpdateData,
  CustomerListFilters,
  CustomerListResult,
  AddressCreateData,
  AddressUpdateData,
} from '../../domain/repositories/customerRepository';
import { Customer, CustomerAddress } from '../../domain/models/customer';
import { validateCustomerData, validateCustomerAddressData } from '../validator';
import {
  CustomerNotFoundError,
  CustomerEmailConflictError,
  CustomerHasOrdersError,
  AddressNotFoundError,
} from '../../infrastructure/repositories/customerRepository';

const MAX_PAGE_SIZE = 100;

export class CustomerService {
  constructor(private readonly repo: ICustomerRepository) {}

  async findAll(filters: CustomerListFilters = {}): Promise<CustomerListResult> {
    const pageSize =
      filters.pageSize !== undefined
        ? Math.min(Math.max(1, filters.pageSize), MAX_PAGE_SIZE)
        : 20;
    return this.repo.findAll({ ...filters, pageSize });
  }

  async findById(id: number): Promise<Customer> {
    const customer = await this.repo.findById(id);
    if (!customer) throw new CustomerNotFoundError();
    return customer;
  }

  async create(data: CustomerCreateData): Promise<Customer> {
    // Normalize email before validation so the validator sees the canonical form.
    const normalized: CustomerCreateData = {
      ...data,
      email: data.email.trim().toLowerCase(),
    };
    validateCustomerData(normalized as unknown as Record<string, unknown>);

    const existing = await this.repo.findByEmail(normalized.email);
    if (existing) throw new CustomerEmailConflictError();

    return this.repo.create(normalized);
  }

  async update(id: number, data: CustomerUpdateData): Promise<Customer> {
    // Existence check first: a missing customer returns 404 before any validation.
    const current = await this.repo.findById(id);
    if (!current) throw new CustomerNotFoundError();

    // Normalize email if provided.
    const normalized: CustomerUpdateData = { ...data };
    if (data.email !== undefined) {
      normalized.email = data.email.trim().toLowerCase();
    }

    validateCustomerData(normalized as unknown as Record<string, unknown>, { requireFields: false });

    if (normalized.email !== undefined) {
      const existing = await this.repo.findByEmail(normalized.email);
      if (existing && existing.id !== id) throw new CustomerEmailConflictError();
    }

    return this.repo.update(id, normalized);
  }

  async delete(id: number): Promise<void> {
    const current = await this.repo.findById(id);
    if (!current) throw new CustomerNotFoundError();

    const orderCount = await this.repo.countOrders(id);
    if (orderCount > 0) throw new CustomerHasOrdersError();

    await this.repo.delete(id);
  }

  async findAddressesByCustomerId(customerId: number): Promise<CustomerAddress[]> {
    const customer = await this.repo.findById(customerId);
    if (!customer) throw new CustomerNotFoundError();
    return this.repo.findAddressesByCustomerId(customerId);
  }

  async createAddress(customerId: number, data: AddressCreateData): Promise<CustomerAddress> {
    const customer = await this.repo.findById(customerId);
    if (!customer) throw new CustomerNotFoundError();
    validateCustomerAddressData(data as unknown as Record<string, unknown>);
    return this.repo.createAddress(customerId, data);
  }

  async updateAddress(
    customerId: number,
    addressId: number,
    data: AddressUpdateData
  ): Promise<CustomerAddress> {
    const customer = await this.repo.findById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    const address = await this.repo.findAddressById(addressId, customerId);
    if (!address) throw new AddressNotFoundError();

    validateCustomerAddressData(data as unknown as Record<string, unknown>, { requireAll: false });
    return this.repo.updateAddress(addressId, data);
  }

  async deleteAddress(customerId: number, addressId: number): Promise<void> {
    const customer = await this.repo.findById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    const address = await this.repo.findAddressById(addressId, customerId);
    if (!address) throw new AddressNotFoundError();

    await this.repo.deleteAddress(addressId);
  }
}
```

**Notes:**
- Email normalization (`trim().toLowerCase()`) happens BEFORE validation so the validator receives the canonical email.
- `update` calls `repo.findById` (not `findByEmail`) for the existence check, consistent with the supplier pattern.
- `findAddressesByCustomerId` in the service calls `repo.findById` (not the dedicated addresses method) for the customer existence check — this is intentional because `findById` is already efficient and the result is not used further.
- Address ownership is enforced by `repo.findAddressById(addressId, customerId)` which filters by both columns in one query.
- `delete` calls `findById` (which includes addresses) for the existence check; that is slightly wasteful but consistent with the service pattern. A minor optimization would be a dedicated `exists(id)` method, but it is out of scope.

---

## File 7: `backend/src/presentation/controllers/customerController.ts` — CREATE

```typescript
import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../../application/services/customerService';
import { CustomerRepository } from '../../infrastructure/repositories/customerRepository';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';

function parseIdParam(value: string, paramName = 'id'): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) {
    throw new ValidationError(`Parameter '${paramName}' must be a valid integer`);
  }
  return id;
}

const customerService = new CustomerService(new CustomerRepository());

// ─── Customer CRUD ───────────────────────────────────────────────────────────

export async function listCustomers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, page, pageSize } = req.query;
    const result = await customerService.findAll({
      search: search as string | undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
    });
    logger.info('Customers listed', { total: result.total, page: result.page });
    res.json({ success: true, data: result, message: 'Customers retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const customer = await customerService.findById(id);
    res.json({ success: true, data: customer, message: 'Customer retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customer = await customerService.create(req.body);
    logger.info('Customer created', { customerId: customer.id });
    res.status(201).json({ success: true, data: customer, message: 'Customer created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const customer = await customerService.update(id, req.body);
    logger.info('Customer updated', { customerId: id });
    res.json({ success: true, data: customer, message: 'Customer updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    await customerService.delete(id);
    logger.info('Customer deleted', { customerId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── Address sub-resource ────────────────────────────────────────────────────

export async function listAddresses(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId = parseIdParam(req.params['customerId'] as string, 'customerId');
    const addresses = await customerService.findAddressesByCustomerId(customerId);
    res.json({ success: true, data: addresses, message: 'Addresses retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId = parseIdParam(req.params['customerId'] as string, 'customerId');
    const address = await customerService.createAddress(customerId, req.body);
    logger.info('Customer address created', { customerId, addressId: address.id });
    res.status(201).json({ success: true, data: address, message: 'Address created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId = parseIdParam(req.params['customerId'] as string, 'customerId');
    const addressId = parseIdParam(req.params['addressId'] as string, 'addressId');
    const address = await customerService.updateAddress(customerId, addressId, req.body);
    logger.info('Customer address updated', { customerId, addressId });
    res.json({ success: true, data: address, message: 'Address updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId = parseIdParam(req.params['customerId'] as string, 'customerId');
    const addressId = parseIdParam(req.params['addressId'] as string, 'addressId');
    await customerService.deleteAddress(customerId, addressId);
    logger.info('Customer address deleted', { customerId, addressId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
```

**Notes:**
- `parseIdParam` accepts an optional `paramName` argument so error messages are specific (e.g., "Parameter 'customerId' must be a valid integer").
- PII (email, phone, name) is never logged. Only IDs are logged.
- DELETE endpoints call `res.status(204).send()` — no JSON body, consistent with the spec.
- The module-level `customerService` instantiation follows the exact supplier pattern.

---

## File 8: `backend/src/routes/admin/customerRoutes.ts` — CREATE

```typescript
import { Router } from 'express';
import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../../presentation/controllers/customerController';

const customerRouter = Router();

// Customer CRUD
customerRouter.get('/', listCustomers);
customerRouter.post('/', createCustomer);
customerRouter.get('/:id', getCustomerById);
customerRouter.patch('/:id', updateCustomer);
customerRouter.delete('/:id', deleteCustomer);

// Address sub-resource
customerRouter.get('/:customerId/addresses', listAddresses);
customerRouter.post('/:customerId/addresses', createAddress);
customerRouter.patch('/:customerId/addresses/:addressId', updateAddress);
customerRouter.delete('/:customerId/addresses/:addressId', deleteAddress);

export default customerRouter;
```

**Notes:**
- There is no Express routing conflict between `/:id` and `/:customerId/addresses`. Express matches by path depth: a single-segment path matches `/:id` while a two-segment path matches `/:customerId/addresses`. The different param names (`id` vs `customerId`) are intentional and match the controller's `req.params` access.
- No public customer routes are registered anywhere — customers are admin-only per the spec.

---

## File 9: `backend/src/routes/index.ts` — MODIFY

**Action:** Add one export line in the admin routes section (after the `supplierAdminRoutes` export).

**Current content of the admin section:**
```typescript
export { default as productAdminRoutes } from './admin/productRoutes';
export { default as supplierAdminRoutes } from './admin/supplierRoutes';
```

**New content of the admin section:**
```typescript
export { default as productAdminRoutes } from './admin/productRoutes';
export { default as supplierAdminRoutes } from './admin/supplierRoutes';
export { default as customerAdminRoutes } from './admin/customerRoutes';
```

Only this one line is added. All other content is unchanged.

---

## File 10: `backend/src/index.ts` — MODIFY

**Action:** Add the import and route registration for customers. Two changes in two places.

**Change 1 — Add import** (after the `supplierAdminRoutes` import line):
```typescript
import customerAdminRoutes from './routes/admin/customerRoutes';
```

**Change 2 — Register route** (after the `app.use('/api/admin/suppliers', supplierAdminRoutes)` line, before the NOTE comment):
```typescript
app.use('/api/admin/customers', customerAdminRoutes);
```

The NOTE comment and public routes below it are unchanged.

**Resulting relevant section of index.ts after both changes:**
```typescript
import productAdminRoutes from './routes/admin/productRoutes';
import supplierAdminRoutes from './routes/admin/supplierRoutes';
import customerAdminRoutes from './routes/admin/customerRoutes';
import productPublicRoutes from './routes/public/productRoutes';
import categoryPublicRoutes from './routes/public/categoryRoutes';
// ... (rest of imports unchanged)

app.use('/api/admin/products', productAdminRoutes);
app.use('/api/admin/suppliers', supplierAdminRoutes);
app.use('/api/admin/customers', customerAdminRoutes);
// NOTE: No /api/public/suppliers route exists ...
```

---

## File 11: `backend/src/middleware/errorHandler.ts` — MODIFY

**Action:** Add one import block and four `else if` branches in `globalErrorHandler`. Two changes.

**Change 1 — Add import** (after the existing `SupplierNotFoundError` import):
```typescript
import {
  CustomerNotFoundError,
  CustomerEmailConflictError,
  CustomerHasOrdersError,
  AddressNotFoundError,
} from '../infrastructure/repositories/customerRepository';
```

**Change 2 — Add four `else if` branches** in `globalErrorHandler`, after the `} else if (err instanceof SupplierNotFoundError) {` block:
```typescript
  } else if (err instanceof CustomerNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof AddressNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof CustomerEmailConflictError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof CustomerHasOrdersError) {
    statusCode = 409; code = err.code; message = err.message;
```

Insert these four branches immediately after the `SupplierNotFoundError` branch and before the `ProductSlugConflictError` branch. Keep all other content unchanged.

---

## Implementation Order

1. Modify `schema.prisma` → run `npx prisma migrate dev --name add_customer_and_customer_address`
2. Create `domain/models/customer.ts`
3. Create `domain/repositories/customerRepository.ts`
4. Create `infrastructure/repositories/customerRepository.ts`
5. Modify `application/validator.ts` (append only)
6. Create `application/services/customerService.ts`
7. Create `presentation/controllers/customerController.ts`
8. Create `routes/admin/customerRoutes.ts`
9. Modify `routes/index.ts`
10. Modify `src/index.ts`
11. Modify `middleware/errorHandler.ts`

---

## Key Decisions and Gotchas

| Decision | Rationale |
|---|---|
| `onDelete: Cascade` on `CustomerAddress` | Physical delete of customer should remove all owned addresses automatically. The service guard (`countOrders`) prevents deletion of customers with orders, so cascade only fires in safe cases. |
| `countOrders` stub returns 0 | `CustomerOrder` model doesn't exist in the schema yet. The guard logic is fully wired; it will activate as soon as the CustomerOrder feature adds the model and updates this method. |
| Email normalization before validation | The validator sees the canonical form. This prevents duplicate checks from missing `" Ana@Test.com"` vs `"ana@test.com"`. |
| `findAddressById(id, customerId)` uses `findFirst` | Enforces ownership in one DB round-trip instead of two. The service still does the customer existence check first so we always get the correct 404 code (CUSTOMER_NOT_FOUND vs ADDRESS_NOT_FOUND). |
| `findAll` does not include addresses | List endpoint does not need addresses; loading them for every customer in a paginated list is wasteful. Only `findById` includes them. |
| `parseIdParam(value, paramName)` with named param | Error messages are specific to the failing parameter, improving client-side debuggability. |
| No `softDelete` for Customer | Unlike Supplier, Customer is physically deleted. The delete guard (`countOrders`) is the safety mechanism. This matches the spec which says "physically removes the customer record". |
| Error classes in infrastructure layer | Follows the existing project pattern where `SupplierNotFoundError` lives in `infrastructure/repositories/supplierRepository.ts`. |
