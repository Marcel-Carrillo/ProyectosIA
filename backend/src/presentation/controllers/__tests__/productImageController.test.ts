import { Request, Response, NextFunction } from 'express';
import { ProductImage } from '../../../domain/models/productImage';

const mockListByProduct = jest.fn();
const mockFindById = jest.fn();
const mockAdd = jest.fn();
const mockUpdate = jest.fn();
const mockRemove = jest.fn();

jest.mock('../../../application/services/productImageService', () => ({
  ProductImageService: jest.fn().mockImplementation(() => ({
    listByProduct: mockListByProduct,
    findById: mockFindById,
    add: mockAdd,
    update: mockUpdate,
    remove: mockRemove,
  })),
}));

jest.mock('../../../infrastructure/repositories/productImageRepository', () => ({
  ProductImageRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../infrastructure/repositories/productRepository', () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));

import {
  listImages,
  addImage,
  deleteImage,
} from '../productImageController';

const makeImage = (overrides: Partial<ConstructorParameters<typeof ProductImage>[0]> = {}) =>
  new ProductImage({ id: 1, productId: 1, url: 'https://example.com/img.jpg', sortOrder: 0, ...overrides });

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('listImages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 200 with image list ordered by sortOrder', async () => {
    const images = [makeImage({ sortOrder: 0 }), makeImage({ id: 2, sortOrder: 1 })];
    mockListByProduct.mockResolvedValue(images);
    const req = { params: { id: '1' } } as unknown as Request;
    const res = mockRes();
    await listImages(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: images,
      message: 'Images retrieved successfully',
    });
  });

  it('should call next when product not found', async () => {
    const err = Object.assign(new Error('not found'), { code: 'PRODUCT_NOT_FOUND', status: 404 });
    mockListByProduct.mockRejectedValue(err);
    const req = { params: { id: '99' } } as unknown as Request;
    const res = mockRes();
    await listImages(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('addImage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 201 with added image', async () => {
    const img = makeImage();
    mockAdd.mockResolvedValue(img);
    const req = { params: { id: '1' }, body: { url: 'https://example.com/img.jpg' } } as unknown as Request;
    const res = mockRes();
    await addImage(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: img,
      message: 'Image added successfully',
    });
  });

  it('should inject productId from route param', async () => {
    const img = makeImage();
    mockAdd.mockResolvedValue(img);
    const req = { params: { id: '7' }, body: { url: 'https://example.com/img.jpg' } } as unknown as Request;
    const res = mockRes();
    await addImage(req, res, mockNext);
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ productId: 7 }));
  });

  it('should call next on validation error', async () => {
    const err = new Error("Field 'url' is required");
    mockAdd.mockRejectedValue(err);
    const req = { params: { id: '1' }, body: {} } as unknown as Request;
    const res = mockRes();
    await addImage(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('deleteImage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 204 on successful hard-delete', async () => {
    mockRemove.mockResolvedValue(undefined);
    const req = { params: { id: '1', imageId: '1' } } as unknown as Request;
    const res = mockRes();
    await deleteImage(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('should call next when image not found', async () => {
    const err = Object.assign(new Error('not found'), { code: 'IMAGE_NOT_FOUND', status: 404 });
    mockRemove.mockRejectedValue(err);
    const req = { params: { id: '1', imageId: '99' } } as unknown as Request;
    const res = mockRes();
    await deleteImage(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});
