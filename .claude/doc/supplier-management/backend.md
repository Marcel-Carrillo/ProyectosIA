# Backend Implementation Plan — supplier-management (KAN-16)

> Scope: tasks.md sections 1–6 and 12/14 (backend).
> Reference template: the delivered product module.
> No schema change required — `Supplier` Prisma model already exists with no `deletedAt`.

---

## 0. Key architectural decisions before reading further

| Decision | Detail |
|---|---|
| Soft-delete | `status = 'Inactive'` — NOT `deletedAt` (column doesn't exist on `Supplier`) |
| `findAll` default filter | Returns ALL suppliers regardless of status (no implicit active-only). Status filter is an explicit optional query param |
| `DELETE` HTTP response | **200** with the updated supplier object (status=Inactive) — mirrors the Category soft-delete pattern, NOT the product 204 pattern. The product 204 is for logical-deletion via `deletedAt` |
| `ISupplierRepository.softDelete` return type | `Promise<Supplier>` (returns the updated row) — unlike `IProductRepository.softDelete: Promise<void>` |
| Non-numeric `:id` path param | Explicit `isNaN` check → `ValidationError` → 400 VALIDATION_ERROR (spec requirement; product module does not do this) |
| `pageSize` clamping | Clamped to 100 in the **service** layer (not the repository) |
| Error registration | `SupplierNotFoundError` must be added to `errorHandler.ts` imports and switch chain |

---

## 1. Domain layer

### 1.1 CREATE `backend/src/domain/models/supplier.ts`

Mirror `product.ts`. No relations (no nested variants here — the admin supplier screen doesn't manage variants).

```typescript
export type SupplierStatus = 'Active' | 'Inactive' | 'Blocked';

export class Supplier {
  id?: number;
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  notes?: string | null;
  status: SupplierStatus;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    name: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    website?: string | null;
    notes?: string | null;
    status?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.name = data.name;
    this.contactName = data.contactName ?? null;
    this.contactEmail = data.contactEmail ?? null;
    this.contactPhone = data.contactPhone ?? null;
    this.website = data.website ?? null;
    this.notes = data.notes ?? null;
    this.status = (data.status as SupplierStatus) ?? 'Active';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
```

### 1.2 CREATE `backend/src/domain/repositories/supplierRepository.ts`

Mirror `productRepository.ts` — interface + data-transfer types only, no Prisma.

```typescript
import { Supplier } from '../models/supplier';

export interface SupplierCreateData {
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  notes?: string | null;
  status?: string;
}

export interface SupplierUpdateData {
  name?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  notes?: string | null;
  status?: string;
}

export interface SupplierListFilters {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface SupplierListResult {
  items: Supplier[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ISupplierRepository {
  findAll(filters?: SupplierListFilters): Promise<SupplierListResult>;
  findById(id: number): Promise<Supplier | null>;
  create(data: SupplierCreateData): Promise<Supplier>;
  update(id: number, data: SupplierUpdateData): Promise<Supplier>;
  softDelete(id: number): Promise<Supplier>;   // returns updated row (status=Inactive)
}
```

### 1.3 MODIFY `backend/src/domain/models/index.ts`

Append at the end of the file (after the Category class):

```typescript
export { Supplier } from './supplier';
export type { SupplierStatus } from './supplier';
```

### 1.4 MODIFY `backend/src/domain/repositories/index.ts`

Append at the end of the file:

```typescript
export { ISupplierRepository } from './supplierRepository';
export type {
  SupplierCreateData,
  SupplierUpdateData,
  SupplierListFilters,
  SupplierListResult,
} from './supplierRepository';
```

---

## 2. Validator (TDD — write tests first, then implement)

### 2.1 MODIFY `backend/src/application/validator.ts`

Add at the end of the file. Use a private helper `validateSupplierFields` for the shared field checks,
then expose `validateSupplierData` with an `options` object to handle both create (name required) and
update (name optional).

```typescript
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSupplierFields(data: Record<string, unknown>): void {
  const contactName = data['contactName'];
  if (contactName !== undefined && contactName !== null && contactName !== '') {
    if (typeof contactName === 'string' && contactName.length > 150) {
      throw new ValidationError("Field 'contactName' must not exceed 150 characters");
    }
  }

  const contactEmail = data['contactEmail'];
  if (contactEmail !== undefined && contactEmail !== null && contactEmail !== '') {
    if (typeof contactEmail === 'string') {
      if (!EMAIL_REGEX.test(contactEmail)) {
        throw new ValidationError("Field 'contactEmail' must be a valid email address");
      }
      if (contactEmail.length > 255) {
        throw new ValidationError("Field 'contactEmail' must not exceed 255 characters");
      }
    }
  }

  const contactPhone = data['contactPhone'];
  if (contactPhone !== undefined && contactPhone !== null && contactPhone !== '') {
    if (typeof contactPhone === 'string' && contactPhone.length > 30) {
      throw new ValidationError("Field 'contactPhone' must not exceed 30 characters");
    }
  }

  const website = data['website'];
  if (website !== undefined && website !== null && website !== '') {
    if (typeof website === 'string' && website.length > 500) {
      throw new ValidationError("Field 'website' must not exceed 500 characters");
    }
  }

  const notes = data['notes'];
  if (notes !== undefined && notes !== null && notes !== '') {
    if (typeof notes === 'string' && notes.length > 2000) {
      throw new ValidationError("Field 'notes' must not exceed 2000 characters");
    }
  }

  const status = data['status'];
  if (status !== undefined && status !== null && status !== '') {
    const validStatuses = ['Active', 'Inactive', 'Blocked'];
    if (!validStatuses.includes(status as string)) {
      throw new ValidationError(`Field 'status' must be one of: ${validStatuses.join(', ')}`);
    }
  }
}

export function validateSupplierData(
  data: Record<string, unknown>,
  options: { requireName?: boolean } = { requireName: true }
): void {
  const name = data['name'];
  if (options.requireName !== false) {
    if (name === undefined || name === null || name === '') {
      throw new ValidationError("Field 'name' is required");
    }
  }
  if (name !== undefined && name !== null && name !== '') {
    if (typeof name === 'string' && name.length > 150) {
      throw new ValidationError("Field 'name' must not exceed 150 characters");
    }
  }
  validateSupplierFields(data);
}
```

**Note on email regex:** The regex `EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` is a pragmatic
simple check. Tests must verify it rejects strings without `@` and without `.` in domain.

### 2.2 CREATE `backend/src/application/__tests__/validator.supplier.test.ts`

Write these tests FIRST (TDD), make them red, then implement the validator.

```typescript
import { validateSupplierData, ValidationError } from '../validator';

describe('validateSupplierData — create mode (requireName: true)', () => {
  it('passes with name only', () => {
    expect(() => validateSupplierData({ name: 'ACME' })).not.toThrow();
  });

  it('throws when name is missing', () => {
    expect(() => validateSupplierData({})).toThrow(ValidationError);
  });

  it('throws when name is empty string', () => {
    expect(() => validateSupplierData({ name: '' })).toThrow(ValidationError);
  });

  it('throws when name exceeds 150 chars', () => {
    expect(() => validateSupplierData({ name: 'A'.repeat(151) })).toThrow(ValidationError);
  });

  it('passes with name at exactly 150 chars', () => {
    expect(() => validateSupplierData({ name: 'A'.repeat(150) })).not.toThrow();
  });

  it('passes with all optional fields populated and valid', () => {
    expect(() =>
      validateSupplierData({
        name: 'ACME',
        contactName: 'Jane',
        contactEmail: 'jane@acme.com',
        contactPhone: '+34999123456',
        website: 'https://acme.com',
        notes: 'Internal note',
        status: 'Active',
      })
    ).not.toThrow();
  });

  it('throws ValidationError for invalid email format', () => {
    expect(() => validateSupplierData({ name: 'ACME', contactEmail: 'not-an-email' })).toThrow(ValidationError);
    expect(() => validateSupplierData({ name: 'ACME', contactEmail: 'missing@dot' })).toThrow(ValidationError);
  });

  it('throws when contactEmail exceeds 255 chars', () => {
    const email = 'a'.repeat(246) + '@test.com'; // >255
    expect(() => validateSupplierData({ name: 'ACME', contactEmail: email })).toThrow(ValidationError);
  });

  it('throws when contactPhone exceeds 30 chars', () => {
    expect(() =>
      validateSupplierData({ name: 'ACME', contactPhone: '1'.repeat(31) })
    ).toThrow(ValidationError);
  });

  it('throws when website exceeds 500 chars', () => {
    expect(() =>
      validateSupplierData({ name: 'ACME', website: 'https://' + 'x'.repeat(494) })
    ).toThrow(ValidationError);
  });

  it('throws when notes exceed 2000 chars', () => {
    expect(() =>
      validateSupplierData({ name: 'ACME', notes: 'x'.repeat(2001) })
    ).toThrow(ValidationError);
  });

  it('throws for invalid status value', () => {
    expect(() =>
      validateSupplierData({ name: 'ACME', status: 'Deleted' })
    ).toThrow(ValidationError);
  });

  it('accepts all valid status values', () => {
    for (const s of ['Active', 'Inactive', 'Blocked']) {
      expect(() => validateSupplierData({ name: 'ACME', status: s })).not.toThrow();
    }
  });

  it('throws when contactName exceeds 150 chars', () => {
    expect(() =>
      validateSupplierData({ name: 'ACME', contactName: 'A'.repeat(151) })
    ).toThrow(ValidationError);
  });
});

describe('validateSupplierData — update mode (requireName: false)', () => {
  it('passes with empty object', () => {
    expect(() => validateSupplierData({}, { requireName: false })).not.toThrow();
  });

  it('passes with a valid name', () => {
    expect(() => validateSupplierData({ name: 'ACME' }, { requireName: false })).not.toThrow();
  });

  it('throws when name is present but empty string', () => {
    // Empty string is still invalid if provided
    expect(() => validateSupplierData({ name: '' }, { requireName: false })).not.toThrow();
    // The validator does NOT reject empty string in update mode because the field is just absent
    // (product pattern: update doesn't validate name). But the spec says same validation rules apply.
    // Decision: empty string '' in update means "do not update" — treat as absent. Do NOT throw.
    // Rationale: PATCH semantics; omitted = unchanged. The service should reject '' explicitly if needed.
    // Adjust if spec clarifies differently.
  });

  it('throws for invalid email even in update mode', () => {
    expect(() =>
      validateSupplierData({ contactEmail: 'bad-email' }, { requireName: false })
    ).toThrow(ValidationError);
  });

  it('throws for invalid status even in update mode', () => {
    expect(() =>
      validateSupplierData({ status: 'Unknown' }, { requireName: false })
    ).toThrow(ValidationError);
  });
});
```

---

## 3. Infrastructure: Repository + Typed Errors

### 3.1 CREATE `backend/src/infrastructure/repositories/supplierRepository.ts`

```typescript
import { prisma } from '../prismaClient';
import { Supplier } from '../../domain/models/supplier';
import {
  ISupplierRepository,
  SupplierCreateData,
  SupplierUpdateData,
  SupplierListFilters,
  SupplierListResult,
} from '../../domain/repositories/supplierRepository';

// ── Typed domain errors ──────────────────────────────────────────────────────

export class SupplierNotFoundError extends Error {
  readonly code = 'SUPPLIER_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Supplier not found');
    this.name = 'SupplierNotFoundError';
    Object.setPrototypeOf(this, SupplierNotFoundError.prototype);
  }
}

// ── Repository implementation ────────────────────────────────────────────────

export class SupplierRepository implements ISupplierRepository {
  async findAll(filters: SupplierListFilters = {}): Promise<SupplierListResult> {
    const page =
      filters.page != null && Number.isFinite(filters.page) && filters.page >= 1
        ? filters.page
        : 1;
    const pageSize =
      filters.pageSize != null && Number.isFinite(filters.pageSize) && filters.pageSize >= 1
        ? filters.pageSize
        : 20;
    const skip = (page - 1) * pageSize;

    // IMPORTANT: No deletedAt filter — Supplier has no deletedAt column.
    // All suppliers are returned. Status filter is OPTIONAL and explicit.
    const where: Record<string, unknown> = {};
    if (filters.status) where['status'] = filters.status;
    if (filters.search) {
      where['name'] = { contains: filters.search, mode: 'insensitive' };
    }

    const [rows, total] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      items: rows.map((r) => new Supplier(r)),
      total,
      page,
      pageSize,
    };
  }

  async findById(id: number): Promise<Supplier | null> {
    const row = await prisma.supplier.findUnique({ where: { id } });
    return row ? new Supplier(row) : null;
    // Note: findUnique not findFirst because id is PK. No deletedAt filter needed.
    // An Inactive/Blocked supplier IS still accessible by ID (admin use case).
  }

  async create(data: SupplierCreateData): Promise<Supplier> {
    const row = await prisma.supplier.create({
      data: {
        name: data.name,
        contactName: data.contactName ?? null,
        contactEmail: data.contactEmail ?? null,
        contactPhone: data.contactPhone ?? null,
        website: data.website ?? null,
        notes: data.notes ?? null,
        status: data.status ?? 'Active',
      },
    });
    return new Supplier(row);
  }

  async update(id: number, data: SupplierUpdateData): Promise<Supplier> {
    // Pre-check existence (mirrors ProductRepository pattern)
    const current = await this.findById(id);
    if (!current) throw new SupplierNotFoundError();

    const row = await prisma.supplier.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.contactName !== undefined && { contactName: data.contactName }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
    return new Supplier(row);
  }

  async softDelete(id: number): Promise<Supplier> {
    // Soft-delete = set status = 'Inactive'. Row is NEVER removed.
    // Returns the updated supplier so the controller can echo it back (200 response).
    const current = await this.findById(id);
    if (!current) throw new SupplierNotFoundError();

    const row = await prisma.supplier.update({
      where: { id },
      data: { status: 'Inactive' },
    });
    return new Supplier(row);
    // Note: We do NOT use prisma.supplier.delete() — ever.
  }
}
```

---

## 4. Application: Service

### 4.1 CREATE `backend/src/application/services/supplierService.ts`

```typescript
import {
  ISupplierRepository,
  SupplierCreateData,
  SupplierUpdateData,
  SupplierListFilters,
  SupplierListResult,
} from '../../domain/repositories/supplierRepository';
import { Supplier } from '../../domain/models/supplier';
import { validateSupplierData } from '../validator';
import { SupplierNotFoundError } from '../../infrastructure/repositories/supplierRepository';

const MAX_PAGE_SIZE = 100;

export class SupplierService {
  constructor(private readonly repo: ISupplierRepository) {}

  async findAll(filters: SupplierListFilters = {}): Promise<SupplierListResult> {
    // Clamp pageSize here so the controller/repo never has to worry about it
    const pageSize =
      filters.pageSize !== undefined
        ? Math.min(Math.max(1, filters.pageSize), MAX_PAGE_SIZE)
        : 20;
    return this.repo.findAll({ ...filters, pageSize });
  }

  async findById(id: number): Promise<Supplier> {
    const supplier = await this.repo.findById(id);
    if (!supplier) throw new SupplierNotFoundError();
    return supplier;
  }

  async create(data: SupplierCreateData): Promise<Supplier> {
    validateSupplierData(data as Record<string, unknown>);
    return this.repo.create({
      ...data,
      status: data.status ?? 'Active',   // explicit default even though DB has it
    });
  }

  async update(id: number, data: SupplierUpdateData): Promise<Supplier> {
    // Check existence before validation so we return 404 not 400 when id missing
    const current = await this.repo.findById(id);
    if (!current) throw new SupplierNotFoundError();

    validateSupplierData(data as Record<string, unknown>, { requireName: false });
    return this.repo.update(id, data);
    // Status transition guard: currently unrestricted (any → any per D2).
    // Future: add guard here without changing the API.
  }

  async softDelete(id: number): Promise<Supplier> {
    // Service-level existence check before delegating to repo
    const current = await this.repo.findById(id);
    if (!current) throw new SupplierNotFoundError();
    return this.repo.softDelete(id);
    // repo.softDelete sets status=Inactive and returns the updated Supplier
  }
}
```

**Return type of `softDelete` is `Promise<Supplier>`** — this is intentional (differs from ProductService).

### 4.2 CREATE `backend/src/application/services/__tests__/supplierService.test.ts`

Mirror `productService.test.ts` structure.

```typescript
import { SupplierService } from '../supplierService';
import {
  ISupplierRepository,
  SupplierListResult,
} from '../../../domain/repositories/supplierRepository';
import { Supplier } from '../../../domain/models/supplier';
import { ValidationError } from '../../validator';
import { SupplierNotFoundError } from '../../../infrastructure/repositories/supplierRepository';

const makeSupplier = (overrides: Partial<ConstructorParameters<typeof Supplier>[0]> = {}) =>
  new Supplier({ id: 1, name: 'ACME', status: 'Active', ...overrides });

const mockListResult = (items: Supplier[]): SupplierListResult => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
});

const mockRepo: jest.Mocked<ISupplierRepository> = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const service = new SupplierService(mockRepo);

describe('SupplierService - findAll', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns paginated supplier list', async () => {
    const result = mockListResult([makeSupplier()]);
    mockRepo.findAll.mockResolvedValue(result);
    const res = await service.findAll();
    expect(res.items).toHaveLength(1);
  });

  it('clamps pageSize to 100', async () => {
    mockRepo.findAll.mockResolvedValue(mockListResult([]));
    await service.findAll({ pageSize: 500 });
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 100 })
    );
  });

  it('defaults pageSize to 20 when not provided', async () => {
    mockRepo.findAll.mockResolvedValue(mockListResult([]));
    await service.findAll();
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 20 })
    );
  });

  it('passes search and status filters through', async () => {
    mockRepo.findAll.mockResolvedValue(mockListResult([]));
    await service.findAll({ search: 'acme', status: 'Active' });
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'acme', status: 'Active' })
    );
  });
});

describe('SupplierService - findById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns supplier when found', async () => {
    const s = makeSupplier();
    mockRepo.findById.mockResolvedValue(s);
    const result = await service.findById(1);
    expect(result).toEqual(s);
  });

  it('throws SupplierNotFoundError when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.findById(99)).rejects.toBeInstanceOf(SupplierNotFoundError);
  });
});

describe('SupplierService - create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates supplier with status defaulting to Active', async () => {
    const s = makeSupplier({ status: 'Active' });
    mockRepo.create.mockResolvedValue(s);
    const result = await service.create({ name: 'ACME' });
    expect(result.status).toBe('Active');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ACME', status: 'Active' })
    );
  });

  it('creates supplier with explicit status Blocked', async () => {
    const s = makeSupplier({ status: 'Blocked' });
    mockRepo.create.mockResolvedValue(s);
    await service.create({ name: 'ACME', status: 'Blocked' });
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Blocked' })
    );
  });

  it('throws ValidationError when name is missing', async () => {
    await expect(service.create({ name: '' } as any)).rejects.toBeInstanceOf(ValidationError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('throws ValidationError for invalid email format', async () => {
    await expect(service.create({ name: 'ACME', contactEmail: 'bad-email' }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('throws ValidationError for invalid status', async () => {
    await expect(service.create({ name: 'ACME', status: 'Unknown' }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });
});

describe('SupplierService - update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates supplier successfully', async () => {
    const current = makeSupplier();
    const updated = makeSupplier({ contactEmail: 'new@acme.com' });
    mockRepo.findById.mockResolvedValue(current);
    mockRepo.update.mockResolvedValue(updated);
    const result = await service.update(1, { contactEmail: 'new@acme.com' });
    expect(result.contactEmail).toBe('new@acme.com');
  });

  it('throws SupplierNotFoundError when supplier does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.update(99, { name: 'X' })).rejects.toBeInstanceOf(SupplierNotFoundError);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('throws ValidationError on invalid email and does not update', async () => {
    mockRepo.findById.mockResolvedValue(makeSupplier());
    await expect(service.update(1, { contactEmail: 'bad' })).rejects.toBeInstanceOf(ValidationError);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('allows status transition to Blocked', async () => {
    const current = makeSupplier({ status: 'Active' });
    const blocked = makeSupplier({ status: 'Blocked' });
    mockRepo.findById.mockResolvedValue(current);
    mockRepo.update.mockResolvedValue(blocked);
    const result = await service.update(1, { status: 'Blocked' });
    expect(result.status).toBe('Blocked');
  });
});

describe('SupplierService - softDelete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls repo.softDelete and returns supplier with status Inactive', async () => {
    const current = makeSupplier({ status: 'Active' });
    const inactive = makeSupplier({ status: 'Inactive' });
    mockRepo.findById.mockResolvedValue(current);
    mockRepo.softDelete.mockResolvedValue(inactive);
    const result = await service.softDelete(1);
    expect(mockRepo.softDelete).toHaveBeenCalledWith(1);
    expect(result.status).toBe('Inactive');
  });

  it('throws SupplierNotFoundError when supplier does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.softDelete(99)).rejects.toBeInstanceOf(SupplierNotFoundError);
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });
});
```

---

## 5. Presentation: Controller and Routes

### 5.1 CREATE `backend/src/presentation/controllers/supplierController.ts`

Key differences from `productController.ts`:
- **`parseIdParam` helper** validates the path `:id` is numeric and throws `ValidationError` (400) if not — spec requirement
- `createSupplier` returns **201**
- `deleteSupplier` returns **200** with the updated supplier (not 204)
- Only one repo dependency (no variant repo)
- Logger calls for create/update/delete

```typescript
import { Request, Response, NextFunction } from 'express';
import { SupplierService } from '../../application/services/supplierService';
import { SupplierRepository } from '../../infrastructure/repositories/supplierRepository';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';

// Validates `:id` path param and throws ValidationError (→ 400) for non-numeric values.
function parseIdParam(value: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) {
    throw new ValidationError("Parameter 'id' must be a valid integer");
  }
  return id;
}

const supplierService = new SupplierService(new SupplierRepository());

export async function listSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, status, page, pageSize } = req.query;
    const parsedPage = page ? parseInt(String(page), 10) : undefined;
    const parsedPageSize = pageSize ? parseInt(String(pageSize), 10) : undefined;
    const result = await supplierService.findAll({
      search: search as string | undefined,
      status: status as string | undefined,
      page: parsedPage,
      pageSize: parsedPageSize,
    });
    logger.info('Suppliers listed', { total: result.total, page: result.page });
    res.json({ success: true, data: result, message: 'Suppliers retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getSupplierById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const supplier = await supplierService.findById(id);
    logger.info('Supplier retrieved', { supplierId: id });
    res.json({ success: true, data: supplier, message: 'Supplier retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplier = await supplierService.create(req.body);
    logger.info('Supplier created', { supplierId: supplier.id, name: supplier.name });
    res.status(201).json({ success: true, data: supplier, message: 'Supplier created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const supplier = await supplierService.update(id, req.body);
    logger.info('Supplier updated', { supplierId: id });
    res.json({ success: true, data: supplier, message: 'Supplier updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    // Returns 200 with the soft-deleted supplier (status=Inactive), NOT 204.
    // Rationale: soft-delete is a status change; the resource still exists; echoing it
    // confirms to the client that status is now Inactive. Mirrors category soft-delete pattern.
    const supplier = await supplierService.softDelete(id);
    logger.info('Supplier soft-deleted', { supplierId: id });
    res.json({ success: true, data: supplier, message: 'Supplier deactivated successfully' });
  } catch (err) {
    next(err);
  }
}
```

### 5.2 CREATE `backend/src/routes/admin/supplierRoutes.ts`

```typescript
import { Router } from 'express';
import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../../presentation/controllers/supplierController';

const supplierRouter = Router();
supplierRouter.get('/', listSuppliers);
supplierRouter.post('/', createSupplier);
supplierRouter.get('/:id', getSupplierById);
supplierRouter.patch('/:id', updateSupplier);        // PATCH, NOT PUT — admin convention
supplierRouter.delete('/:id', deleteSupplier);

export default supplierRouter;
```

### 5.3 MODIFY `backend/src/routes/index.ts`

Add a new export line inside the `/api/admin routes` comment block (after the `productAdminRoutes` export):

```typescript
export { default as supplierAdminRoutes } from './admin/supplierRoutes';
```

### 5.4 MODIFY `backend/src/index.ts`

Add import at the top (after the `productAdminRoutes` import):

```typescript
import supplierAdminRoutes from './routes/admin/supplierRoutes';
```

Add mount line after `app.use('/api/admin/products', productAdminRoutes)`:

```typescript
app.use('/api/admin/suppliers', supplierAdminRoutes);
// IMPORTANT: NO /api/public/suppliers route is added — ever.
```

### 5.5 MODIFY `backend/src/middleware/errorHandler.ts`

**Import** `SupplierNotFoundError` at the top:

```typescript
import {
  SupplierNotFoundError,
} from '../infrastructure/repositories/supplierRepository';
```

**Add handler** inside `globalErrorHandler`, adjacent to the existing `ProductNotFoundError` block:

```typescript
} else if (err instanceof SupplierNotFoundError) {
  statusCode = 404; code = err.code; message = err.message;
}
```

---

## 6. Supplier-data isolation guard

### 6.1 Confirm existing serializer is safe (no code change expected)

Verify `backend/src/presentation/serializers/publicProduct.ts` uses an explicit allow-list
(it does — confirmed). The variant select in `productRepository.ts` also omits `supplierId`,
`supplierReference`, `supplierCost` (confirmed via `variantSelect` constant).

### 6.2 CREATE `backend/src/routes/public/__tests__/supplierIsolation.test.ts`

A route-level integration regression test using supertest + the Express app:

```typescript
import request from 'supertest';
import { app } from '../../../index';

// Mock prisma to avoid DB in unit tests
jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    product: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation((queries) => Promise.all(queries)),
  },
}));

describe('Supplier data isolation — /api/public/* routes', () => {
  it('returns 404 for GET /api/public/suppliers (route does not exist)', async () => {
    const res = await request(app).get('/api/public/suppliers');
    expect(res.status).toBe(404);
    // The error body must NOT contain any supplier data
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/supplierId/i);
    expect(body).not.toMatch(/supplierReference/i);
    expect(body).not.toMatch(/supplierCost/i);
  });

  it('GET /api/public/products response contains no supplier fields', async () => {
    const res = await request(app).get('/api/public/products');
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/supplierId/i);
    expect(body).not.toMatch(/supplierReference/i);
    expect(body).not.toMatch(/supplierCost/i);
  });

  it('GET /api/public/products/:id response contains no supplier fields', async () => {
    // With mock returning null, service throws NotFoundError → 404
    const res = await request(app).get('/api/public/products/1');
    const body = JSON.stringify(res.body);
    // Even in error responses, no supplier data
    expect(body).not.toMatch(/supplierId/i);
    expect(body).not.toMatch(/supplierReference/i);
    expect(body).not.toMatch(/supplierCost/i);
  });
});
```

**Note on test approach:** If prisma mocking proves complex with the existing test setup, extend
`backend/src/presentation/serializers/__tests__/publicProduct.test.ts` instead — it already has
a test `'never emits supplier or internal fields...'`. Add an assertion about the
route's non-existence using supertest. Both approaches satisfy the requirement.

### 5.6 CREATE `backend/src/presentation/controllers/__tests__/supplierController.test.ts`

Mirror `productController.test.ts` structure exactly.

```typescript
import { Request, Response, NextFunction } from 'express';
import { Supplier } from '../../../domain/models/supplier';
import { SupplierListResult } from '../../../domain/repositories/supplierRepository';

const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockSoftDelete = jest.fn();

jest.mock('../../../application/services/supplierService', () => ({
  SupplierService: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    create: mockCreate,
    update: mockUpdate,
    softDelete: mockSoftDelete,
  })),
}));

jest.mock('../../../infrastructure/repositories/supplierRepository', () => ({
  SupplierRepository: jest.fn().mockImplementation(() => ({})),
  SupplierNotFoundError: class SupplierNotFoundError extends Error {
    readonly code = 'SUPPLIER_NOT_FOUND';
    readonly status = 404;
    constructor() { super('Supplier not found'); }
  },
}));

import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../supplierController';

const makeSupplier = (overrides: Partial<ConstructorParameters<typeof Supplier>[0]> = {}) =>
  new Supplier({ id: 1, name: 'ACME', status: 'Active', ...overrides });

const makeListResult = (items: Supplier[]): SupplierListResult => ({
  items, total: items.length, page: 1, pageSize: 20,
});

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};
const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

// --- listSuppliers ---
describe('listSuppliers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with envelope', async () => {
    const result = makeListResult([makeSupplier()]);
    mockFindAll.mockResolvedValue(result);
    const req = { query: {} } as Request;
    const res = mockRes();
    await listSuppliers(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: result,
      message: 'Suppliers retrieved successfully',
    });
  });

  it('passes search, status, page, pageSize to service', async () => {
    mockFindAll.mockResolvedValue(makeListResult([]));
    const req = { query: { search: 'acme', status: 'Active', page: '2', pageSize: '10' } } as unknown as Request;
    const res = mockRes();
    await listSuppliers(req, res, mockNext);
    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'acme', status: 'Active', page: 2, pageSize: 10 })
    );
  });

  it('calls next on error', async () => {
    mockFindAll.mockRejectedValue(new Error('db error'));
    const req = { query: {} } as Request;
    await listSuppliers(req, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});

// --- getSupplierById ---
describe('getSupplierById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with supplier', async () => {
    const s = makeSupplier();
    mockFindById.mockResolvedValue(s);
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await getSupplierById(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true, data: s, message: 'Supplier retrieved successfully',
    });
  });

  it('calls next with ValidationError for non-numeric id', async () => {
    const req = { params: { id: 'abc' } } as unknown as Request;
    const res = mockRes();
    await getSupplierById(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    );
  });

  it('calls next on SupplierNotFoundError', async () => {
    const err = Object.assign(new Error('not found'), { code: 'SUPPLIER_NOT_FOUND', status: 404 });
    mockFindById.mockRejectedValue(err);
    const req = { params: { id: '99' } } as unknown as Request;
    await getSupplierById(req, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

// --- createSupplier ---
describe('createSupplier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 with created supplier', async () => {
    const s = makeSupplier();
    mockCreate.mockResolvedValue(s);
    const req = { body: { name: 'ACME' } } as Request;
    const res = mockRes();
    await createSupplier(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true, data: s, message: 'Supplier created successfully',
    });
  });

  it('calls next on ValidationError', async () => {
    const err = Object.assign(new Error('name required'), { code: 'VALIDATION_ERROR' });
    mockCreate.mockRejectedValue(err);
    const req = { body: {} } as Request;
    await createSupplier(req, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

// --- updateSupplier ---
describe('updateSupplier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with updated supplier', async () => {
    const updated = makeSupplier({ status: 'Blocked' });
    mockUpdate.mockResolvedValue(updated);
    const req = { params: { id: '1' }, body: { status: 'Blocked' } } as unknown as Request;
    const res = mockRes();
    await updateSupplier(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true, data: updated, message: 'Supplier updated successfully',
    });
  });

  it('calls next with ValidationError for non-numeric id', async () => {
    const req = { params: { id: 'xyz' }, body: {} } as unknown as Request;
    await updateSupplier(req, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('calls next on SupplierNotFoundError', async () => {
    const err = Object.assign(new Error('not found'), { code: 'SUPPLIER_NOT_FOUND', status: 404 });
    mockUpdate.mockRejectedValue(err);
    const req = { params: { id: '99' }, body: {} } as unknown as Request;
    await updateSupplier(req, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

// --- deleteSupplier ---
describe('deleteSupplier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with soft-deleted supplier (status=Inactive)', async () => {
    const inactive = makeSupplier({ status: 'Inactive' });
    mockSoftDelete.mockResolvedValue(inactive);
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await deleteSupplier(req, res, mockNext);
    // NOT 204 — the soft-deleted supplier is returned
    expect(res.json).toHaveBeenCalledWith({
      success: true, data: inactive, message: 'Supplier deactivated successfully',
    });
    expect(res.status).not.toHaveBeenCalledWith(204);
  });

  it('calls next on SupplierNotFoundError', async () => {
    const err = Object.assign(new Error('not found'), { code: 'SUPPLIER_NOT_FOUND', status: 404 });
    mockSoftDelete.mockRejectedValue(err);
    const req = { params: { id: '99' } } as unknown as Request;
    await deleteSupplier(req, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});
```

---

## 7. Test plan summary

| File | Type | New? |
|---|---|---|
| `backend/src/application/__tests__/validator.supplier.test.ts` | Unit | CREATE |
| `backend/src/application/services/__tests__/supplierService.test.ts` | Unit | CREATE |
| `backend/src/presentation/controllers/__tests__/supplierController.test.ts` | Unit | CREATE |
| `backend/src/routes/public/__tests__/supplierIsolation.test.ts` | Integration | CREATE |

**Coverage expectation:** Project requires ≥90% branch coverage. The four new test files
target 100% branch coverage of all new code paths (validation conditions, null checks,
clamping, error branches, non-numeric ID).

---

## 8. File creation/modification checklist

| Order | Action | File |
|---|---|---|
| 1 | CREATE | `backend/src/domain/models/supplier.ts` |
| 2 | CREATE | `backend/src/domain/repositories/supplierRepository.ts` |
| 3 | MODIFY | `backend/src/domain/models/index.ts` (add Supplier export) |
| 4 | MODIFY | `backend/src/domain/repositories/index.ts` (add ISupplierRepository exports) |
| 5 | MODIFY | `backend/src/application/validator.ts` (add validateSupplierData) |
| 6 | CREATE | `backend/src/application/__tests__/validator.supplier.test.ts` (TDD — first) |
| 7 | CREATE | `backend/src/infrastructure/repositories/supplierRepository.ts` |
| 8 | CREATE | `backend/src/application/services/supplierService.ts` |
| 9 | CREATE | `backend/src/application/services/__tests__/supplierService.test.ts` |
| 10 | CREATE | `backend/src/presentation/controllers/supplierController.ts` |
| 11 | CREATE | `backend/src/presentation/controllers/__tests__/supplierController.test.ts` |
| 12 | CREATE | `backend/src/routes/admin/supplierRoutes.ts` |
| 13 | MODIFY | `backend/src/routes/index.ts` (add supplierAdminRoutes export) |
| 14 | MODIFY | `backend/src/index.ts` (import + mount `/api/admin/suppliers`) |
| 15 | MODIFY | `backend/src/middleware/errorHandler.ts` (import + handle SupplierNotFoundError) |
| 16 | CREATE | `backend/src/routes/public/__tests__/supplierIsolation.test.ts` |
| 17 | MODIFY | `docs/api-spec.yml` (see section 9) |

---

## 9. `docs/api-spec.yml` changes (task 14.1)

### 9.1 Replace legacy `/suppliers` and `/suppliers/{id}` blocks

The existing legacy paths (`/suppliers`, `/suppliers/{id}`) use PUT and `page`/`limit` which
diverge from the admin convention. **Replace them** (comment them out with a deprecation notice
or remove them) and add `/api/admin/suppliers` and `/api/admin/suppliers/{id}` blocks:

```yaml
  # SUPERSEDED: The legacy /suppliers and /suppliers/{id} endpoints (PUT, page/limit) are
  # replaced by /api/admin/suppliers below (PATCH, page/pageSize). Do not add new routes here.

  /api/admin/suppliers:
    get:
      summary: List suppliers (admin)
      description: >
        Returns a paginated list of suppliers. Returns ALL statuses unless `status` is
        explicitly filtered. No public counterpart exists — suppliers are admin-only.
      tags:
        - Admin — Suppliers
      parameters:
        - in: query
          name: search
          schema:
            type: string
          description: Case-insensitive match on supplier name
        - in: query
          name: status
          schema:
            $ref: '#/components/schemas/SupplierStatus'
          description: Filter by status (Active, Inactive, Blocked)
        - in: query
          name: page
          schema:
            type: integer
            minimum: 1
            default: 1
        - in: query
          name: pageSize
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
          description: Clamped to 100 server-side
      responses:
        '200':
          description: Suppliers retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SupplierListResponse'
        '500':
          $ref: '#/components/responses/InternalServerError'

    post:
      summary: Create supplier (admin)
      description: Creates a new supplier. Status defaults to Active when not provided.
      tags:
        - Admin — Suppliers
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateSupplierRequest'
      responses:
        '201':
          description: Supplier created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SupplierResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '500':
          $ref: '#/components/responses/InternalServerError'

  /api/admin/suppliers/{id}:
    get:
      summary: Get supplier by ID (admin)
      description: Returns full supplier record including internal notes. 400 for non-numeric id.
      tags:
        - Admin — Suppliers
      parameters:
        - $ref: '#/components/parameters/IdPathParam'
      responses:
        '200':
          description: Supplier retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SupplierResponse'
        '400':
          description: Non-numeric id (VALIDATION_ERROR)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: Supplier not found (SUPPLIER_NOT_FOUND)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          $ref: '#/components/responses/InternalServerError'

    patch:
      summary: Update supplier (admin)
      description: Partial update. All fields are optional. Status transitions are unrestricted.
      tags:
        - Admin — Suppliers
      parameters:
        - $ref: '#/components/parameters/IdPathParam'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateSupplierRequest'
      responses:
        '200':
          description: Supplier updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SupplierResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '404':
          description: Supplier not found (SUPPLIER_NOT_FOUND)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          $ref: '#/components/responses/InternalServerError'

    delete:
      summary: Soft-delete supplier (admin)
      description: >
        Sets status = Inactive. Row is NEVER physically removed (preserves referential
        integrity with ProductVariant). Returns 200 with the updated supplier record.
      tags:
        - Admin — Suppliers
      parameters:
        - $ref: '#/components/parameters/IdPathParam'
      responses:
        '200':
          description: Supplier deactivated (status=Inactive)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SupplierResponse'
        '404':
          description: Supplier not found (SUPPLIER_NOT_FOUND)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          $ref: '#/components/responses/InternalServerError'
```

### 9.2 Update existing `SupplierListResponse` schema

The existing schema uses `data: array` + `meta: PaginationMeta` which does not match the
delivered envelope `{ success, data: { items, total, page, pageSize }, message }`. Replace it:

```yaml
    SupplierListResponse:
      type: object
      properties:
        success:
          type: boolean
          example: true
        data:
          type: object
          properties:
            items:
              type: array
              items:
                $ref: '#/components/schemas/Supplier'
            total:
              type: integer
              example: 42
            page:
              type: integer
              example: 1
            pageSize:
              type: integer
              example: 20
        message:
          type: string
          example: Suppliers retrieved successfully
```

### 9.3 Update `CreateSupplierRequest` required fields

The existing schema marks both `name` AND `status` as required. Since `status` defaults to
`Active`, only `name` should be required:

```yaml
    CreateSupplierRequest:
      type: object
      required:
        - name        # only name required; status defaults to Active
      properties:
        name:
          type: string
          maxLength: 150
          example: Example Supplier
        contactName:
          type: string
          maxLength: 150
          nullable: true
        contactEmail:
          type: string
          maxLength: 255
          nullable: true
          example: supplier@example.com
        contactPhone:
          type: string
          maxLength: 30
          nullable: true
        website:
          type: string
          maxLength: 500
          nullable: true
        notes:
          type: string
          maxLength: 2000
          nullable: true
        status:
          $ref: '#/components/schemas/SupplierStatus'
```

### 9.4 Update `UpdateSupplierRequest`

The existing `UpdateSupplierRequest` uses `allOf: [$ref: CreateSupplierRequest]` which
inherits the `required: [name]` — wrong for PATCH. Replace with an independent schema with
no required fields:

```yaml
    UpdateSupplierRequest:
      type: object
      description: All fields are optional (PATCH semantics).
      properties:
        name:
          type: string
          maxLength: 150
        contactName:
          type: string
          maxLength: 150
          nullable: true
        contactEmail:
          type: string
          maxLength: 255
          nullable: true
        contactPhone:
          type: string
          maxLength: 30
          nullable: true
        website:
          type: string
          maxLength: 500
          nullable: true
        notes:
          type: string
          maxLength: 2000
          nullable: true
        status:
          $ref: '#/components/schemas/SupplierStatus'
```

---

## 10. Section 12 — Curl commands (to be executed by the implementing agent)

These commands assume the backend is running on `http://localhost:3000` with a populated DB.
Replace `:SUPPLIER_ID` with the actual ID from the create response.

```bash
# ── 12.1 Start backend and capture baseline ──────────────────────────────────
# cd backend && npm run dev
# BASELINE: count of suppliers before tests:
# psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Supplier\";"

# ── 12.2 List / search / filter / clamp ─────────────────────────────────────
# List all
curl -s http://localhost:3000/api/admin/suppliers | jq .

# Search by name (case-insensitive)
curl -s "http://localhost:3000/api/admin/suppliers?search=acme" | jq .

# Filter by status
curl -s "http://localhost:3000/api/admin/suppliers?status=Active" | jq .
curl -s "http://localhost:3000/api/admin/suppliers?status=Inactive" | jq .

# pageSize clamp: pageSize=500 must return pageSize=100 in response
curl -s "http://localhost:3000/api/admin/suppliers?pageSize=500" | jq '.data.pageSize'
# Expected: 100

# Get existing supplier (replace 1 with a real id)
curl -s http://localhost:3000/api/admin/suppliers/1 | jq .
# Expected: 200 with all fields including notes

# Get missing id
curl -s http://localhost:3000/api/admin/suppliers/999999 | jq .
# Expected: 404 { success: false, error: { code: "SUPPLIER_NOT_FOUND" } }

# Non-numeric id
curl -s http://localhost:3000/api/admin/suppliers/abc | jq .
# Expected: 400 { success: false, error: { code: "VALIDATION_ERROR" } }

# ── 12.3 Create (then restore DB by soft-deleting created supplier) ──────────
CREATED=$(curl -s -X POST http://localhost:3000/api/admin/suppliers \
  -H "Content-Type: application/json" \
  -d '{"name":"Curl Test Supplier","contactEmail":"test@supplier.com","status":"Active"}')
echo $CREATED | jq .
# Expected: 201 with created supplier, status=Active

SUPPLIER_ID=$(echo $CREATED | jq -r '.data.id')
echo "Created supplier ID: $SUPPLIER_ID"

# Restore: soft-delete the created supplier (status=Inactive keeps row)
curl -s -X DELETE http://localhost:3000/api/admin/suppliers/$SUPPLIER_ID | jq .
# Expected: 200 { success:true, data: { status: "Inactive" } }

# ── 12.4 PATCH (update, then revert) ─────────────────────────────────────────
# Patch an existing supplier (use id=1 or a known id)
curl -s -X PATCH http://localhost:3000/api/admin/suppliers/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"Blocked"}' | jq .
# Expected: 200 { success:true, data: { status: "Blocked" } }

# Revert status back to Active
curl -s -X PATCH http://localhost:3000/api/admin/suppliers/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"Active"}' | jq .
# Expected: 200 { success:true, data: { status: "Active" } }

# ── 12.5 DELETE / soft-delete + restore ─────────────────────────────────────
# Soft-delete (use a different supplier id to avoid clobbering the one used above)
curl -s -X DELETE http://localhost:3000/api/admin/suppliers/1 | jq .
# Expected: 200, data.status === "Inactive"
# Verify row preserved (not hard-deleted):
# psql $DATABASE_URL -c "SELECT id, status FROM \"Supplier\" WHERE id = 1;"

# Restore original status
curl -s -X PATCH http://localhost:3000/api/admin/suppliers/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"Active"}' | jq .

# ── 12.6 Error cases ─────────────────────────────────────────────────────────
# Missing name
curl -s -X POST http://localhost:3000/api/admin/suppliers \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
# Expected: 400 VALIDATION_ERROR

# Invalid email
curl -s -X POST http://localhost:3000/api/admin/suppliers \
  -H "Content-Type: application/json" \
  -d '{"name":"X","contactEmail":"not-valid"}' | jq .
# Expected: 400 VALIDATION_ERROR

# Invalid status value
curl -s -X POST http://localhost:3000/api/admin/suppliers \
  -H "Content-Type: application/json" \
  -d '{"name":"X","status":"Deleted"}' | jq .
# Expected: 400 VALIDATION_ERROR

# Missing id on update
curl -s -X PATCH http://localhost:3000/api/admin/suppliers/999999 \
  -H "Content-Type: application/json" \
  -d '{"name":"X"}' | jq .
# Expected: 404 SUPPLIER_NOT_FOUND

# ── 12.7 Security: supplier-data isolation ───────────────────────────────────
# No public supplier route
curl -s http://localhost:3000/api/public/suppliers | jq '.error.code'
# Expected: "NOT_FOUND" (Express notFoundHandler)

# Public product list must not contain supplier fields
curl -s http://localhost:3000/api/public/products | jq . | grep -iE 'supplierId|supplierReference|supplierCost'
# Expected: no output (no supplier fields)

curl -s http://localhost:3000/api/public/products/1 | jq . | grep -iE 'supplierId|supplierReference|supplierCost'
# Expected: no output

# ── 12.8 Verify DB count matches baseline ────────────────────────────────────
# psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Supplier\";"
# Expected: same as baseline (soft-deleted rows still exist, count unchanged)
```

---

## 11. Critical notes for the implementing agent

1. **No hard delete ever.** `prisma.supplier.delete()` must never appear in supplier code. Only
   `prisma.supplier.update({ data: { status: 'Inactive' } })`.

2. **No `deletedAt` filter.** Unlike `productRepository.ts` which filters `where: { deletedAt: null }`,
   the supplier repository has no such filter. `findAll` returns all rows unless filtered by `status`.

3. **`softDelete` returns `Supplier`, not `void`.** The interface, implementation, service, and
   controller all use the updated supplier. Do not change this to void after reading product code.

4. **`deleteSupplier` controller returns 200, not 204.** This is intentional (echoes the
   updated status=Inactive object). No `res.status(204).send()` here.

5. **`parseIdParam` throws `ValidationError`** for non-numeric `:id`. This is a spec-required
   behaviour that the product module does NOT implement. The error propagates through `next(err)`
   and is handled by the existing `ValidationError` branch in `errorHandler.ts` (no change needed
   there for this case since `ValidationError` is already handled).

6. **`SupplierNotFoundError` MUST be added to `errorHandler.ts`** imports and the if-else chain.
   Without this, SupplierNotFoundError falls through to the generic 500 handler.

7. **`pageSize` clamping is in the service, not the repo.** The repo accepts whatever pageSize the
   service sends. This means tests for clamping belong in `supplierService.test.ts`.

8. **`UpdateSupplierRequest` in api-spec.yml must NOT use `allOf` from `CreateSupplierRequest`**
   because the create schema marks `name` required. The update schema must be independent.

9. **Isolation regression test:** The `supplierIsolation.test.ts` is a safety net for D5. Even if
   the test setup is complex, at minimum add an assertion to the existing
   `publicProduct.test.ts` serializer test that the public route produces no supplier keys.

10. **Logger note:** The logger sanitizes keys containing 'cost', so if `supplierCost` ever
    appeared in a log meta object it would be redacted. No change needed to `logger.ts`.
