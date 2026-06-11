import { Request, Response, NextFunction } from 'express';
import { Category } from '../../domain/models';

const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockSoftDelete = jest.fn();

jest.mock('../../application/services/categoryService', () => ({
  CategoryService: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    create: mockCreate,
    update: mockUpdate,
    softDelete: mockSoftDelete,
  })),
}));

jest.mock('../../infrastructure/repositories/categoryRepository', () => ({
  CategoryRepository: jest.fn().mockImplementation(() => ({})),
}));

import {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from './categoryController';

const makeCategory = (overrides: Partial<ConstructorParameters<typeof Category>[0]> = {}) =>
  new Category({ id: 1, name: 'Dresses', status: 'Active', ...overrides });

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('listCategories', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 200 with category list', async () => {
    const cats = [makeCategory()];
    mockFindAll.mockResolvedValue(cats);
    const req = { query: {} } as Request;
    const res = mockRes();
    await listCategories(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: cats,
      message: 'Categories retrieved successfully',
    });
  });

  it('should pass includeInactive=true when query param is set', async () => {
    mockFindAll.mockResolvedValue([]);
    const req = { query: { includeInactive: 'true' } } as unknown as Request;
    const res = mockRes();
    await listCategories(req, res, mockNext);
    expect(mockFindAll).toHaveBeenCalledWith(true);
  });

  it('should call next on error', async () => {
    const err = new Error('db error');
    mockFindAll.mockRejectedValue(err);
    const req = { query: {} } as Request;
    const res = mockRes();
    await listCategories(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('getCategoryById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 200 with category', async () => {
    const cat = makeCategory();
    mockFindById.mockResolvedValue(cat);
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await getCategoryById(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: cat,
      message: 'Category retrieved successfully',
    });
  });

  it('should call next when category not found', async () => {
    const err = Object.assign(new Error('Category not found'), { code: 'CATEGORY_NOT_FOUND', status: 404 });
    mockFindById.mockRejectedValue(err);
    const req = { params: { id: '99' } } as unknown as Request;
    const res = mockRes();
    await getCategoryById(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('createCategory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 201 with created category', async () => {
    const cat = makeCategory();
    mockCreate.mockResolvedValue(cat);
    const req = { body: { name: 'Dresses' } } as Request;
    const res = mockRes();
    await createCategory(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: cat,
      message: 'Category created successfully',
    });
  });

  it('should call next on validation error', async () => {
    const err = new Error('validation');
    mockCreate.mockRejectedValue(err);
    const req = { body: {} } as Request;
    const res = mockRes();
    await createCategory(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('updateCategory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 200 with updated category', async () => {
    const updated = makeCategory({ name: 'Updated' });
    mockUpdate.mockResolvedValue(updated);
    const req = { params: { id: '1' }, body: { name: 'Updated' } } as unknown as Request;
    const res = mockRes();
    await updateCategory(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: updated,
      message: 'Category updated successfully',
    });
  });

  it('should call next when category not found', async () => {
    const err = Object.assign(new Error('not found'), { code: 'CATEGORY_NOT_FOUND' });
    mockUpdate.mockRejectedValue(err);
    const req = { params: { id: '99' }, body: { name: 'X' } } as unknown as Request;
    const res = mockRes();
    await updateCategory(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('deleteCategory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 200 with deactivated category', async () => {
    const inactive = makeCategory({ status: 'Inactive' });
    mockSoftDelete.mockResolvedValue(inactive);
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await deleteCategory(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: inactive,
      message: 'Category deactivated successfully',
    });
  });

  it('should call next when category not found', async () => {
    const err = Object.assign(new Error('not found'), { code: 'CATEGORY_NOT_FOUND' });
    mockSoftDelete.mockRejectedValue(err);
    const req = { params: { id: '99' } } as unknown as Request;
    const res = mockRes();
    await deleteCategory(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});
