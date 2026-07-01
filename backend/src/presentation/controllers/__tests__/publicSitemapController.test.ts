import { Request, Response, NextFunction } from 'express';

const mockBuildEntries = jest.fn();

jest.mock('../../../application/services/sitemapService', () => ({
  SitemapService: jest.fn().mockImplementation(() => ({ buildEntries: mockBuildEntries })),
}));
jest.mock('../../../application/services/productService', () => ({
  ProductService: jest.fn().mockImplementation(() => ({})),
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
jest.mock('../../../application/services/categoryService', () => ({
  CategoryService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/categoryRepository', () => ({
  CategoryRepository: jest.fn().mockImplementation(() => ({})),
}));

import { getPublicSitemap } from '../publicSitemapController';

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('getPublicSitemap', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with application/xml content type and an XML body', async () => {
    mockBuildEntries.mockResolvedValue([{ loc: 'https://mavile.es/catalog' }]);
    const req = {} as Request;
    const res = mockRes();
    await getPublicSitemap(req, res, mockNext);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/xml');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<urlset'));
  });

  it('calls next with the error when the service throws', async () => {
    const err = new Error('db error');
    mockBuildEntries.mockRejectedValue(err);
    const req = {} as Request;
    const res = mockRes();
    await getPublicSitemap(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
    expect(res.send).not.toHaveBeenCalled();
  });
});
