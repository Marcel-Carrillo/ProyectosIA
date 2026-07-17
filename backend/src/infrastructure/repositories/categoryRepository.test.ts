import { Prisma } from '@prisma/client';
import {
  CategoryRepository,
  CategoryNotFoundError,
  CategoryNameConflictError,
} from './categoryRepository';
import { prisma } from '../prismaClient';
import { ValidationError } from '../../application/validator';

jest.mock('../prismaClient', () => ({
  prisma: {
    category: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    supplierCategoryMapping: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.0.0',
  });
}

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const dbRow = {
  id: 1,
  name: 'Dresses',
  description: null,
  imageUrl: null,
  status: 'Active',
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const repo = new CategoryRepository();

describe('CategoryRepository - findAll', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return active categories by default', async () => {
    (mockedPrisma.category.findMany as jest.Mock).mockResolvedValue([dbRow]);
    const result = await repo.findAll();
    expect(mockedPrisma.category.findMany).toHaveBeenCalledWith({
      where: { status: 'Active' },
      orderBy: { name: 'asc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Dresses');
  });

  it('should return all categories when includeInactive is true', async () => {
    (mockedPrisma.category.findMany as jest.Mock).mockResolvedValue([dbRow]);
    await repo.findAll(true);
    expect(mockedPrisma.category.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { name: 'asc' },
    });
  });
});

describe('CategoryRepository - findById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return category when found', async () => {
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(dbRow);
    const result = await repo.findById(1);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
  });

  it('should return null when not found', async () => {
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await repo.findById(99);
    expect(result).toBeNull();
  });
});

describe('CategoryRepository - findByName', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return category when found by name', async () => {
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(dbRow);
    const result = await repo.findByName('Dresses');
    expect(result!.name).toBe('Dresses');
  });

  it('should return null when name not found', async () => {
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await repo.findByName('Unknown');
    expect(result).toBeNull();
  });
});

describe('CategoryRepository - create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create category when name is unique', async () => {
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(null);
    (mockedPrisma.category.create as jest.Mock).mockResolvedValue(dbRow);
    const result = await repo.create({ name: 'Dresses' });
    expect(result.name).toBe('Dresses');
    expect(mockedPrisma.category.create).toHaveBeenCalledTimes(1);
  });

  it('should throw CategoryNameConflictError when name already exists', async () => {
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(dbRow);
    await expect(repo.create({ name: 'Dresses' })).rejects.toBeInstanceOf(
      CategoryNameConflictError
    );
    expect(mockedPrisma.category.create).not.toHaveBeenCalled();
  });
});

describe('CategoryRepository - update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should update category successfully', async () => {
    const updated = { ...dbRow, name: 'Evening Dresses' };
    (mockedPrisma.category.findUnique as jest.Mock)
      .mockResolvedValueOnce(dbRow)
      .mockResolvedValueOnce(null);
    (mockedPrisma.category.update as jest.Mock).mockResolvedValue(updated);
    const result = await repo.update(1, { name: 'Evening Dresses' });
    expect(result.name).toBe('Evening Dresses');
  });

  it('should throw CategoryNotFoundError when id does not exist', async () => {
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(repo.update(99, { name: 'X' })).rejects.toBeInstanceOf(CategoryNotFoundError);
  });

  it('should throw ValidationError when parentId equals own id', async () => {
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(dbRow);
    await expect(repo.update(1, { parentId: 1 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('should throw CategoryNameConflictError when new name conflicts', async () => {
    const conflicting = { ...dbRow, id: 2, name: 'Shoes' };
    (mockedPrisma.category.findUnique as jest.Mock)
      .mockResolvedValueOnce(dbRow)
      .mockResolvedValueOnce(conflicting);
    await expect(repo.update(1, { name: 'Shoes' })).rejects.toBeInstanceOf(
      CategoryNameConflictError
    );
  });
});

describe('CategoryRepository - softDelete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should set status to Inactive', async () => {
    const inactive = { ...dbRow, status: 'Inactive' };
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(dbRow);
    (mockedPrisma.category.update as jest.Mock).mockResolvedValue(inactive);
    const result = await repo.softDelete(1);
    expect(result.status).toBe('Inactive');
    expect(mockedPrisma.category.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'Inactive' },
    });
  });

  it('should throw CategoryNotFoundError when id does not exist', async () => {
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(repo.softDelete(99)).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});

describe('CategoryRepository - findOrCreateByExternalRef', () => {
  beforeEach(() => jest.clearAllMocks());

  const mapping = { id: 1, provider: 'CJDropshipping', externalCategoryId: 'cj-cat-1', categoryId: 1, category: dbRow };

  it('should reuse an existing mapping without creating a category or mapping', async () => {
    (mockedPrisma.supplierCategoryMapping.findUnique as jest.Mock).mockResolvedValue(mapping);

    const result = await repo.findOrCreateByExternalRef('CJDropshipping', 'cj-cat-1', 'Dresses');

    expect(result.name).toBe('Dresses');
    expect(mockedPrisma.category.create).not.toHaveBeenCalled();
    expect(mockedPrisma.supplierCategoryMapping.create).not.toHaveBeenCalled();
  });

  it('should create a new Inactive category and mapping when neither exists', async () => {
    (mockedPrisma.supplierCategoryMapping.findUnique as jest.Mock).mockResolvedValue(null);
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(null);
    const created = { ...dbRow, id: 2, name: 'Shoes', status: 'Inactive' };
    (mockedPrisma.category.create as jest.Mock).mockResolvedValue(created);
    (mockedPrisma.supplierCategoryMapping.create as jest.Mock).mockResolvedValue({});

    const result = await repo.findOrCreateByExternalRef('CJDropshipping', 'cj-cat-2', 'Shoes');

    expect(mockedPrisma.category.create).toHaveBeenCalledWith({ data: { name: 'Shoes', status: 'Inactive' } });
    expect(mockedPrisma.supplierCategoryMapping.create).toHaveBeenCalledWith({
      data: { provider: 'CJDropshipping', externalCategoryId: 'cj-cat-2', categoryId: 2 },
    });
    expect(result.status).toBe('Inactive');
  });

  it('should reuse an existing local category by name instead of violating the name-unique constraint', async () => {
    (mockedPrisma.supplierCategoryMapping.findUnique as jest.Mock).mockResolvedValue(null);
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(dbRow); // 'Dresses' already exists
    (mockedPrisma.supplierCategoryMapping.create as jest.Mock).mockResolvedValue({});

    const result = await repo.findOrCreateByExternalRef('CJDropshipping', 'cj-cat-3', 'Dresses');

    expect(mockedPrisma.category.create).not.toHaveBeenCalled();
    expect(result.id).toBe(dbRow.id);
    expect(mockedPrisma.supplierCategoryMapping.create).toHaveBeenCalledWith({
      data: { provider: 'CJDropshipping', externalCategoryId: 'cj-cat-3', categoryId: dbRow.id },
    });
  });

  it('should resolve a concurrent-creation race on the mapping by re-reading the winner instead of throwing', async () => {
    (mockedPrisma.supplierCategoryMapping.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // initial lookup: no mapping yet
      .mockResolvedValueOnce(mapping); // re-read after losing the create race
    (mockedPrisma.category.findUnique as jest.Mock).mockResolvedValue(dbRow);
    (mockedPrisma.supplierCategoryMapping.create as jest.Mock).mockRejectedValue(uniqueConstraintError());

    const result = await repo.findOrCreateByExternalRef('CJDropshipping', 'cj-cat-1', 'Dresses');

    expect(result.name).toBe('Dresses');
  });

  it('should resolve a concurrent-creation race on the category name by re-reading the winner instead of throwing', async () => {
    (mockedPrisma.supplierCategoryMapping.findUnique as jest.Mock).mockResolvedValue(null);
    (mockedPrisma.category.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // initial lookup: no category yet
      .mockResolvedValueOnce(dbRow); // re-read after losing the create race
    (mockedPrisma.category.create as jest.Mock).mockRejectedValue(uniqueConstraintError());
    (mockedPrisma.supplierCategoryMapping.create as jest.Mock).mockResolvedValue({});

    const result = await repo.findOrCreateByExternalRef('CJDropshipping', 'cj-cat-4', 'Dresses');

    expect(result.id).toBe(dbRow.id);
    expect(mockedPrisma.supplierCategoryMapping.create).toHaveBeenCalledWith({
      data: { provider: 'CJDropshipping', externalCategoryId: 'cj-cat-4', categoryId: dbRow.id },
    });
  });
});
