import { Request, Response, NextFunction } from 'express';
import { ProductVariant } from '../../../domain/models/productVariant';

const mockListByProduct = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockSoftDelete = jest.fn();

jest.mock('../../../application/services/productVariantService', () => ({
  ProductVariantService: jest.fn().mockImplementation(() => ({
    listByProduct: mockListByProduct,
    findById: mockFindById,
    create: mockCreate,
    update: mockUpdate,
    softDelete: mockSoftDelete,
  })),
}));

jest.mock('../../../infrastructure/repositories/productVariantRepository', () => ({
  ProductVariantRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../infrastructure/repositories/productRepository', () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));

import {
  listVariants,
  getVariantById,
  createVariant,
  updateVariant,
  deleteVariant,
} from '../productVariantController';

const makeVariant = (overrides: Partial<ConstructorParameters<typeof ProductVariant>[0]> = {}) =>
  new ProductVariant({ id: 1, productId: 1, sku: 'SKU-001', publicPrice: 29.99, stockPolicy: 'SupplierManaged', ...overrides });

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('listVariants', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 200 with variant list', async () => {
    const variants = [makeVariant()];
    mockListByProduct.mockResolvedValue(variants);
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await listVariants(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: variants,
      message: 'Variants retrieved successfully',
    });
  });

  it('should call next when product not found', async () => {
    const err = Object.assign(new Error('not found'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
    mockListByProduct.mockRejectedValue(err);
    const req = { params: { id: '99' } } as unknown as Request;
    const res = mockRes();
    await listVariants(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('createVariant', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 201 with created variant', async () => {
    const v = makeVariant();
    mockCreate.mockResolvedValue(v);
    const req = { params: { id: '1' }, body: { sku: 'SKU-001', publicPrice: 29.99, stockPolicy: 'SupplierManaged' } } as unknown as Request;
    const res = mockRes();
    await createVariant(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: v,
      message: 'Variant created successfully',
    });
  });

  it('should inject productId from route param into service call', async () => {
    const v = makeVariant();
    mockCreate.mockResolvedValue(v);
    const req = { params: { id: '5' }, body: { sku: 'SKU-001', publicPrice: 29.99, stockPolicy: 'SupplierManaged' } } as unknown as Request;
    const res = mockRes();
    await createVariant(req, res, mockNext);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ productId: 5 }));
  });

  it('should call next on SKU conflict', async () => {
    const err = Object.assign(new Error('sku conflict'), { code: 'VARIANT_SKU_CONFLICT', status: 409 });
    mockCreate.mockRejectedValue(err);
    const req = { params: { id: '1' }, body: { sku: 'DUPE', publicPrice: 29.99, stockPolicy: 'SupplierManaged' } } as unknown as Request;
    const res = mockRes();
    await createVariant(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });

  it('should call next on compare price invalid', async () => {
    const err = Object.assign(new Error('invalid compare'), { code: 'VARIANT_COMPARE_PRICE_INVALID', status: 422 });
    mockCreate.mockRejectedValue(err);
    const req = { params: { id: '1' }, body: { sku: 'SKU-X', publicPrice: 29.99, compareAtPrice: 10, stockPolicy: 'SupplierManaged' } } as unknown as Request;
    const res = mockRes();
    await createVariant(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('deleteVariant', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 204 on successful delete', async () => {
    mockSoftDelete.mockResolvedValue(undefined);
    const req = { params: { id: '1', variantId: '1' } } as unknown as Request;
    const res = mockRes();
    await deleteVariant(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('should call next when variant not found', async () => {
    const err = Object.assign(new Error('not found'), { code: 'VARIANT_NOT_FOUND', status: 404 });
    mockSoftDelete.mockRejectedValue(err);
    const req = { params: { id: '1', variantId: '99' } } as unknown as Request;
    const res = mockRes();
    await deleteVariant(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('Supplier field leak prevention', () => {
  it('variant model should NOT contain supplier fields', () => {
    const variant = makeVariant();
    const json = JSON.stringify(variant);
    expect(json).not.toContain('supplierId');
    expect(json).not.toContain('supplierReference');
    expect(json).not.toContain('supplierCost');
  });

  it('variant response envelope should NOT contain supplier fields', () => {
    const variant = makeVariant();
    const envelope = { success: true, data: variant, message: 'ok' };
    const json = JSON.stringify(envelope);
    expect(json).not.toContain('supplierId');
    expect(json).not.toContain('supplierReference');
    expect(json).not.toContain('supplierCost');
  });
});
