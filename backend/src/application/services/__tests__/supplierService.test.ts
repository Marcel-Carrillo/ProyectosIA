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
    mockRepo.findAll.mockResolvedValue(mockListResult([makeSupplier()]));
    const res = await service.findAll();
    expect(res.items).toHaveLength(1);
  });

  it('clamps pageSize to 100', async () => {
    mockRepo.findAll.mockResolvedValue(mockListResult([]));
    await service.findAll({ pageSize: 500 });
    expect(mockRepo.findAll).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 }));
  });

  it('defaults pageSize to 20 when not provided', async () => {
    mockRepo.findAll.mockResolvedValue(mockListResult([]));
    await service.findAll();
    expect(mockRepo.findAll).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 20 }));
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
    expect(await service.findById(1)).toEqual(s);
  });

  it('throws SupplierNotFoundError when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.findById(99)).rejects.toBeInstanceOf(SupplierNotFoundError);
  });
});

describe('SupplierService - create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates supplier with status defaulting to Active', async () => {
    mockRepo.create.mockResolvedValue(makeSupplier({ status: 'Active' }));
    const result = await service.create({ name: 'ACME' });
    expect(result.status).toBe('Active');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ACME', status: 'Active' })
    );
  });

  it('creates supplier with explicit status Blocked', async () => {
    mockRepo.create.mockResolvedValue(makeSupplier({ status: 'Blocked' }));
    await service.create({ name: 'ACME', status: 'Blocked' });
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'Blocked' }));
  });

  it('throws ValidationError when name is missing', async () => {
    await expect(service.create({ name: '' })).rejects.toBeInstanceOf(ValidationError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('throws ValidationError for invalid email format', async () => {
    await expect(service.create({ name: 'ACME', contactEmail: 'bad-email' })).rejects.toBeInstanceOf(ValidationError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('throws ValidationError for invalid status', async () => {
    await expect(service.create({ name: 'ACME', status: 'Unknown' })).rejects.toBeInstanceOf(ValidationError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });
});

describe('SupplierService - update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates supplier successfully', async () => {
    mockRepo.findById.mockResolvedValue(makeSupplier());
    mockRepo.update.mockResolvedValue(makeSupplier({ contactEmail: 'new@acme.com' }));
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
    mockRepo.findById.mockResolvedValue(makeSupplier({ status: 'Active' }));
    mockRepo.update.mockResolvedValue(makeSupplier({ status: 'Blocked' }));
    const result = await service.update(1, { status: 'Blocked' });
    expect(result.status).toBe('Blocked');
  });
});

describe('SupplierService - softDelete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls repo.softDelete and returns supplier with status Inactive', async () => {
    mockRepo.findById.mockResolvedValue(makeSupplier({ status: 'Active' }));
    mockRepo.softDelete.mockResolvedValue(makeSupplier({ status: 'Inactive' }));
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
