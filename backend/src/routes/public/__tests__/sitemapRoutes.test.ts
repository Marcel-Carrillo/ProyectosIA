import request from 'supertest';
import express from 'express';

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

import sitemapPublicRoutes from '../sitemapRoutes';

const app = express();
app.use('/api/public/sitemap.xml', sitemapPublicRoutes);

describe('GET /api/public/sitemap.xml', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should_return_200_and_application_xml_for_GET_sitemap_xml', async () => {
    mockBuildEntries.mockResolvedValue([{ loc: 'https://mavile.es/catalog' }]);
    const res = await request(app).get('/api/public/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
  });

  it('should_include_catalog_url_and_at_least_one_product_and_content_page_entry_in_body', async () => {
    mockBuildEntries.mockResolvedValue([
      { loc: 'https://mavile.es/catalog' },
      { loc: 'https://mavile.es/catalog/1', lastmod: '2026-05-01T10:00:00.000Z' },
      { loc: 'https://mavile.es/catalog?categoryId=5' },
      { loc: 'https://mavile.es/pages/shipping' },
    ]);
    const res = await request(app).get('/api/public/sitemap.xml');
    expect(res.text).toContain('https://mavile.es/catalog<');
    expect(res.text).toContain('https://mavile.es/catalog/1<');
    expect(res.text).toContain('https://mavile.es/pages/shipping<');
  });

  it('should_not_contain_supplier_fields_in_response_body', async () => {
    mockBuildEntries.mockResolvedValue([{ loc: 'https://mavile.es/catalog' }]);
    const res = await request(app).get('/api/public/sitemap.xml');
    expect(res.text).not.toMatch(/supplierId|supplierReference|supplierCost/i);
  });
});
