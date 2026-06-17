import { Request, Response, NextFunction } from 'express';
import { Product } from '../../../domain/models/product';
import { ProductListResult } from '../../../domain/repositories/productRepository';

const mockFindAll = jest.fn();
const mockFindById = jest.fn();

jest.mock('../../../application/services/productService', () => ({
  ProductService: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
  })),
}));

class ProductNotFoundError extends Error {
  readonly code = 'PRODUCT_NOT_FOUND';
  readonly status = 404;
  constructor() {
    super('Product not found');
    this.name = 'ProductNotFoundError';
  }
}

jest.mock('../../../infrastructure/repositories/productRepository', () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
  ProductNotFoundError,
}));

jest.mock('../../../infrastructure/repositories/productVariantRepository', () => ({
  ProductVariantRepository: jest.fn().mockImplementation(() => ({})),
}));

import { listPublicProducts, getPublicProductById } from '../publicProductController';

const makeProduct = (overrides: Partial<ConstructorParameters<typeof Product>[0]> = {}) =>
  new Product({
    id: 1,
    name: 'Summer Dress',
    slug: 'summer-dress',
    status: 'Active',
    variants: [
      { productId: 1, sku: 'EJS-1', publicPrice: 20, status: 'Active', stockPolicy: 'SupplierManaged' },
    ],
    ...overrides,
  });

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
  return res;
};

const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('listPublicProducts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('always forces status=Active and ignores any client-supplied status', async () => {
    mockFindAll.mockResolvedValue(makeListResult([makeProduct()]));
    const req = { query: { status: 'Draft', categoryId: '2', search: 'dress', sort: 'name', order: 'asc' } } as unknown as Request;
    const res = mockRes();
    await listPublicProducts(req, res, mockNext);
    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Active', categoryId: 2, search: 'dress', sort: 'name', order: 'asc' }),
    );
  });

  it('clamps pageSize to the maximum of 100', async () => {
    mockFindAll.mockResolvedValue(makeListResult([]));
    const req = { query: { pageSize: '500' } } as unknown as Request;
    const res = mockRes();
    await listPublicProducts(req, res, mockNext);
    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 }));
  });

  it('returns the standard envelope with serialized items', async () => {
    mockFindAll.mockResolvedValue(makeListResult([makeProduct()]));
    const req = { query: {} } as Request;
    const res = mockRes();
    await listPublicProducts(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Products retrieved successfully',
        data: expect.objectContaining({ total: 1, page: 1, pageSize: 20 }),
      }),
    );
  });

  it('serialized items never expose supplier or internal fields', async () => {
    mockFindAll.mockResolvedValue(makeListResult([makeProduct()]));
    const req = { query: {} } as Request;
    const res = mockRes();
    await listPublicProducts(req, res, mockNext);
    const payload = (res.json as jest.Mock).mock.calls[0][0];
    const json = JSON.stringify(payload);
    expect(json).not.toContain('supplierId');
    expect(json).not.toContain('supplierReference');
    expect(json).not.toContain('supplierCost');
    expect(json).not.toContain('deletedAt');
  });

  it('calls next on error', async () => {
    const err = new Error('db error');
    mockFindAll.mockRejectedValue(err);
    const req = { query: {} } as Request;
    const res = mockRes();
    await listPublicProducts(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('getPublicProductById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with the serialized active product', async () => {
    mockFindById.mockResolvedValue(makeProduct());
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await getPublicProductById(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Product retrieved successfully',
        data: expect.objectContaining({ id: 1, slug: 'summer-dress' }),
      }),
    );
  });

  it('treats a non-active product as not found', async () => {
    mockFindById.mockResolvedValue(makeProduct({ status: 'Inactive' }));
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await getPublicProductById(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'PRODUCT_NOT_FOUND' }));
  });

  it('calls next when the product does not exist', async () => {
    const err = new ProductNotFoundError();
    mockFindById.mockRejectedValue(err);
    const req = { params: { id: '99' } } as unknown as Request;
    const res = mockRes();
    await getPublicProductById(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });

  it('rejects a non-numeric id with a validation error', async () => {
    const req = { params: { id: 'abc' } } as unknown as Request;
    const res = mockRes();
    await getPublicProductById(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
