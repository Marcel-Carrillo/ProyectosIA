import { CategoryService } from './categoryService';
import { ICategoryRepository } from '../../domain/repositories';
import { Category } from '../../domain/models';
import { ValidationError } from '../validator';

const mockRepo: jest.Mocked<ICategoryRepository> = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByName: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const service = new CategoryService(mockRepo);

const makeCategory = (overrides: Partial<ConstructorParameters<typeof Category>[0]> = {}) =>
  new Category({ id: 1, name: 'Dresses', status: 'Active', ...overrides });

describe('CategoryService - findAll', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return active categories by default', async () => {
    const cats = [makeCategory()];
    mockRepo.findAll.mockResolvedValue(cats);
    const result = await service.findAll();
    expect(result).toEqual(cats);
    expect(mockRepo.findAll).toHaveBeenCalledWith(false);
  });

  it('should pass includeInactive flag to repo', async () => {
    mockRepo.findAll.mockResolvedValue([makeCategory(), makeCategory({ status: 'Inactive' })]);
    await service.findAll(true);
    expect(mockRepo.findAll).toHaveBeenCalledWith(true);
  });
});

describe('CategoryService - findById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return category when found', async () => {
    const cat = makeCategory();
    mockRepo.findById.mockResolvedValue(cat);
    const result = await service.findById(1);
    expect(result).toEqual(cat);
  });

  it('should throw CATEGORY_NOT_FOUND when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.findById(99)).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
  });
});

describe('CategoryService - create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create category with valid data', async () => {
    const cat = makeCategory();
    mockRepo.create.mockResolvedValue(cat);
    const result = await service.create({ name: 'Dresses' });
    expect(result).toEqual(cat);
    expect(mockRepo.create).toHaveBeenCalledWith({ name: 'Dresses' });
  });

  it('should throw ValidationError when name is missing', async () => {
    await expect(service.create({ name: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('should throw ValidationError when status is invalid', async () => {
    await expect(
      service.create({ name: 'Test', status: 'Published' } as unknown as { name: string })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('should propagate CATEGORY_NAME_ALREADY_EXISTS from repo', async () => {
    const err = Object.assign(new Error('dup'), { code: 'CATEGORY_NAME_ALREADY_EXISTS' });
    mockRepo.create.mockRejectedValue(err);
    await expect(service.create({ name: 'Dresses' })).rejects.toMatchObject({
      code: 'CATEGORY_NAME_ALREADY_EXISTS',
    });
  });
});

describe('CategoryService - update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should update category with valid data', async () => {
    const updated = makeCategory({ name: 'Evening Dresses' });
    mockRepo.update.mockResolvedValue(updated);
    const result = await service.update(1, { name: 'Evening Dresses' });
    expect(result).toEqual(updated);
    expect(mockRepo.update).toHaveBeenCalledWith(1, { name: 'Evening Dresses' });
  });

  it('should propagate CATEGORY_NOT_FOUND from repo', async () => {
    const err = Object.assign(new Error('not found'), { code: 'CATEGORY_NOT_FOUND' });
    mockRepo.update.mockRejectedValue(err);
    await expect(service.update(99, { name: 'X' })).rejects.toMatchObject({
      code: 'CATEGORY_NOT_FOUND',
    });
  });
});

describe('CategoryService - softDelete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should soft-delete category', async () => {
    const inactive = makeCategory({ status: 'Inactive' });
    mockRepo.softDelete.mockResolvedValue(inactive);
    const result = await service.softDelete(1);
    expect(result.status).toBe('Inactive');
    expect(mockRepo.softDelete).toHaveBeenCalledWith(1);
  });

  it('should propagate CATEGORY_NOT_FOUND from repo', async () => {
    const err = Object.assign(new Error('not found'), { code: 'CATEGORY_NOT_FOUND' });
    mockRepo.softDelete.mockRejectedValue(err);
    await expect(service.softDelete(99)).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
  });
});
