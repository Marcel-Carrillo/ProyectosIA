import { Request, Response, NextFunction } from 'express';
import { Product } from '../../../domain/models/product';
import { ProductListResult } from '../../../domain/repositories/productRepository';

const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockSoftDelete = jest.fn();
const mockListTranslations = jest.fn();
const mockUpsertTranslation = jest.fn();
const mockDeleteTranslation = jest.fn();

jest.mock('../../../application/services/productService', () => ({
  ProductService: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    create: mockCreate,
    update: mockUpdate,
    softDelete: mockSoftDelete,
    listTranslations: mockListTranslations,
    upsertTranslation: mockUpsertTranslation,
    deleteTranslation: mockDeleteTranslation,
  })),
}));

jest.mock('../../../infrastructure/repositories/productRepository', () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../infrastructure/repositories/productVariantRepository', () => ({
  ProductVariantRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../infrastructure/repositories/productTranslationRepository', () => {
  const actual = jest.requireActual('../../../infrastructure/repositories/productTranslationRepository');
  return {
    ...actual,
    ProductTranslationRepository: jest.fn().mockImplementation(() => ({})),
  };
});

import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  listProductTranslations,
  upsertProductTranslation,
  deleteProductTranslation,
} from '../productController';
import { TranslationLocaleInvalidError } from '../../../application/validator';
import { TranslationNotFoundError } from '../../../infrastructure/repositories/productTranslationRepository';
import { ProductTranslation } from '../../../domain/models/productTranslation';

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

  it('should return 201 with created product including translations', async () => {
    const p = makeProduct({ translations: [new ProductTranslation({ productId: 1, locale: 'es', name: 'Vestido', source: 'manual' })] });
    mockCreate.mockResolvedValue(p);
    mockFindById.mockResolvedValue(p);
    const req = { body: { name: 'Summer Dress', translations: [{ locale: 'es', name: 'Vestido' }] } } as Request;
    const res = mockRes();
    await createProduct(req, res, mockNext);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      translations: [{ locale: 'es', name: 'Vestido' }],
    }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: p,
      message: 'Product created successfully',
    });
  });

  it('should call next on invalid translation locale', async () => {
    const req = { body: { name: 'Summer Dress', translations: [{ locale: 'fr', name: 'Robe' }] } } as Request;
    const res = mockRes();
    await createProduct(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(TranslationLocaleInvalidError));
    expect(mockCreate).not.toHaveBeenCalled();
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

  it('should return 200 with updated product and forward translations', async () => {
    const updated = makeProduct({ name: 'Updated', translations: [new ProductTranslation({ productId: 1, locale: 'es', name: 'Actualizado', source: 'manual' })] });
    mockUpdate.mockResolvedValue(updated);
    const req = { params: { id: '1' }, body: { name: 'Updated', translations: [{ locale: 'es', name: 'Actualizado' }] } } as unknown as Request;
    const res = mockRes();
    await updateProduct(req, res, mockNext);
    expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({
      translations: [{ locale: 'es', name: 'Actualizado' }],
    }));
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: updated,
      message: 'Product updated successfully',
    });
  });

  it('should call next on invalid translation locale', async () => {
    const req = { params: { id: '1' }, body: { translations: [{ locale: 'fr', name: 'Robe' }] } } as unknown as Request;
    const res = mockRes();
    await updateProduct(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(TranslationLocaleInvalidError));
    expect(mockUpdate).not.toHaveBeenCalled();
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

describe('listProductTranslations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns translation rows', async () => {
    const rows = [new ProductTranslation({ productId: 1, locale: 'es', name: 'Vestido', source: 'manual' })];
    mockListTranslations.mockResolvedValue(rows);
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await listProductTranslations(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: rows,
      message: 'Translations retrieved successfully',
    });
  });
});

describe('upsertProductTranslation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts a translation', async () => {
    const row = new ProductTranslation({ productId: 1, locale: 'es', name: 'Vestido', source: 'manual' });
    mockUpsertTranslation.mockResolvedValue(row);
    const req = { params: { id: '1', locale: 'es' }, body: { name: 'Vestido' } } as unknown as Request;
    const res = mockRes();
    await upsertProductTranslation(req, res, mockNext);
    expect(mockUpsertTranslation).toHaveBeenCalledWith(1, 'es', { name: 'Vestido' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('calls next on invalid locale', async () => {
    mockUpsertTranslation.mockRejectedValue(new TranslationLocaleInvalidError());
    const req = { params: { id: '1', locale: 'fr' }, body: { name: 'Robe' } } as unknown as Request;
    const res = mockRes();
    await upsertProductTranslation(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(TranslationLocaleInvalidError));
  });
});

describe('deleteProductTranslation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 204 on success', async () => {
    mockDeleteTranslation.mockResolvedValue(undefined);
    const req = { params: { id: '1', locale: 'es' } } as unknown as Request;
    const res = mockRes();
    await deleteProductTranslation(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('calls next when translation not found', async () => {
    mockDeleteTranslation.mockRejectedValue(new TranslationNotFoundError());
    const req = { params: { id: '1', locale: 'xx' } } as unknown as Request;
    const res = mockRes();
    await deleteProductTranslation(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(TranslationNotFoundError));
  });
});
