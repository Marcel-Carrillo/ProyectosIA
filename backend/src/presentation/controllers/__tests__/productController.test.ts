import { Request, Response, NextFunction } from 'express';
import { Product } from '../../../domain/models/product';
import { ProductListResult } from '../../../domain/repositories/productRepository';

const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockSoftDelete = jest.fn();

jest.mock('../../../application/services/productService', () => ({
  ProductService: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    create: mockCreate,
    update: mockUpdate,
    softDelete: mockSoftDelete,
  })),
}));

jest.mock('../../../infrastructure/repositories/productRepository', () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../infrastructure/repositories/productVariantRepository', () => ({
  ProductVariantRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../infrastructure/repositories/productTranslationRepository', () => ({
  ProductTranslationRepository: jest.fn().mockImplementation(() => ({})),
}));

import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../productController';

const makeProduct = (overrides: Partial<ConstructorParameters<typeof Product>[0]> = {}) =>
  new Product({ id: 1, name: 'Summer Dress', slug: 'summer-dress', status: 'Draft', ...overrides });

const makeListResult = (items: Product[]): ProductListResult => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
});

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('listProducts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 200 with paginated result', async () => {
    const result = makeListResult([makeProduct()]);
    mockFindAll.mockResolvedValue(result);
    const req = { query: {} } as Request;
    const res = mockRes();
    await listProducts(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: result,
      message: 'Products retrieved successfully',
    });
  });

  it('should pass filters to service', async () => {
    mockFindAll.mockResolvedValue(makeListResult([]));
    const req = { query: { status: 'Active', categoryId: '2', search: 'dress', page: '2', pageSize: '10' } } as unknown as Request;
    const res = mockRes();
    await listProducts(req, res, mockNext);
    expect(mockFindAll).toHaveBeenCalledWith({
      status: 'Active',
      categoryId: 2,
      search: 'dress',
      page: 2,
      pageSize: 10,
    });
  });

  it('should call next on error', async () => {
    const err = new Error('db error');
    mockFindAll.mockRejectedValue(err);
    const req = { query: {} } as Request;
    const res = mockRes();
    await listProducts(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('getProductById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 200 with product', async () => {
    const p = makeProduct();
    mockFindById.mockResolvedValue(p);
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await getProductById(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: p,
      message: 'Product retrieved successfully',
    });
  });

  it('should call next when product not found', async () => {
    const err = Object.assign(new Error('Product not found'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
    mockFindById.mockRejectedValue(err);
    const req = { params: { id: '99' } } as unknown as Request;
    const res = mockRes();
    await getProductById(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('createProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 201 with created product', async () => {
    const p = makeProduct();
    mockCreate.mockResolvedValue(p);
    const req = { body: { name: 'Summer Dress' } } as Request;
    const res = mockRes();
    await createProduct(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: p,
      message: 'Product created successfully',
    });
  });

  it('should call next on slug conflict', async () => {
    const err = Object.assign(new Error('Slug conflict'), { code: 'PRODUCT_SLUG_CONFLICT', status: 409 });
    mockCreate.mockRejectedValue(err);
    const req = { body: { name: 'Summer Dress' } } as Request;
    const res = mockRes();
    await createProduct(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });

  it('should call next on validation error', async () => {
    const err = new Error('Field name is required');
    mockCreate.mockRejectedValue(err);
    const req = { body: {} } as Request;
    const res = mockRes();
    await createProduct(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('updateProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 200 with updated product', async () => {
    const updated = makeProduct({ name: 'Updated' });
    mockUpdate.mockResolvedValue(updated);
    const req = { params: { id: '1' }, body: { name: 'Updated' } } as unknown as Request;
    const res = mockRes();
    await updateProduct(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: updated,
      message: 'Product updated successfully',
    });
  });

  it('should call next when requires active variant', async () => {
    const err = Object.assign(new Error('Requires active variant'), { code: 'PRODUCT_REQUIRES_ACTIVE_VARIANT', status: 422 });
    mockUpdate.mockRejectedValue(err);
    const req = { params: { id: '1' }, body: { status: 'Active' } } as unknown as Request;
    const res = mockRes();
    await updateProduct(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });

  it('should call next when archived product cannot be reactivated', async () => {
    const err = Object.assign(new Error('Cannot reactivate'), { code: 'PRODUCT_ARCHIVED_CANNOT_REACTIVATE', status: 422 });
    mockUpdate.mockRejectedValue(err);
    const req = { params: { id: '1' }, body: { status: 'Active' } } as unknown as Request;
    const res = mockRes();
    await updateProduct(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });

  it('should call next when product not found', async () => {
    const err = Object.assign(new Error('not found'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
    mockUpdate.mockRejectedValue(err);
    const req = { params: { id: '99' }, body: {} } as unknown as Request;
    const res = mockRes();
    await updateProduct(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('deleteProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 204 on successful soft-delete', async () => {
    mockSoftDelete.mockResolvedValue(undefined);
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await deleteProduct(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('should call next when product not found', async () => {
    const err = Object.assign(new Error('not found'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
    mockSoftDelete.mockRejectedValue(err);
    const req = { params: { id: '99' } } as unknown as Request;
    const res = mockRes();
    await deleteProduct(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});
