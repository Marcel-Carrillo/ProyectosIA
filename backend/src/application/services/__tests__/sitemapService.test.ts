import { SitemapService } from '../sitemapService';
import { STATIC_CONTENT_PAGE_SLUGS } from '../sitemapService';
import { Product } from '../../../domain/models/product';
import { Category } from '../../../domain/models';
import { ProductService } from '../productService';
import { CategoryService } from '../categoryService';

const mockProductFindAll = jest.fn();
const mockCategoryFindAll = jest.fn();

const productService = { findAll: mockProductFindAll } as unknown as ProductService;
const categoryService = { findAll: mockCategoryFindAll } as unknown as CategoryService;

const ORIGINAL_FRONTEND_URL = process.env['FRONTEND_URL'];

describe('SitemapService - buildEntries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env['FRONTEND_URL'] = 'https://mavile.es';
    mockProductFindAll.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 5000 });
    mockCategoryFindAll.mockResolvedValue([]);
  });

  afterAll(() => {
    process.env['FRONTEND_URL'] = ORIGINAL_FRONTEND_URL;
  });

  it('should_include_catalog_root_entry_always', async () => {
    const service = new SitemapService(productService, categoryService);
    const entries = await service.buildEntries();
    expect(entries).toContainEqual({ loc: 'https://mavile.es/catalog' });
  });

  it('should_include_one_entry_per_active_product_with_lastmod_from_updatedAt', async () => {
    const updatedAt = new Date('2026-05-01T10:00:00Z');
    mockProductFindAll.mockResolvedValue({
      items: [new Product({ id: 1, name: 'Dress', slug: 'dress', status: 'Active', updatedAt })],
      total: 1,
      page: 1,
      pageSize: 5000,
    });
    const service = new SitemapService(productService, categoryService);
    const entries = await service.buildEntries();
    expect(entries).toContainEqual({
      loc: 'https://mavile.es/catalog/1',
      lastmod: updatedAt.toISOString(),
    });
  });

  it('should_call_productService_findAll_with_status_Active', async () => {
    const service = new SitemapService(productService, categoryService);
    await service.buildEntries();
    expect(mockProductFindAll).toHaveBeenCalledWith(expect.objectContaining({ status: 'Active' }));
  });

  it('should_include_one_entry_per_category_with_lastmod_from_updatedAt', async () => {
    const updatedAt = new Date('2026-04-15T08:00:00Z');
    mockCategoryFindAll.mockResolvedValue([
      new Category({ id: 5, name: 'Women', status: 'Active', updatedAt }),
    ]);
    const service = new SitemapService(productService, categoryService);
    const entries = await service.buildEntries();
    expect(entries).toContainEqual({
      loc: 'https://mavile.es/catalog?categoryId=5',
      lastmod: updatedAt.toISOString(),
    });
  });

  it('should_include_all_static_content_page_slugs_with_no_lastmod', async () => {
    const service = new SitemapService(productService, categoryService);
    const entries = await service.buildEntries();
    for (const slug of STATIC_CONTENT_PAGE_SLUGS) {
      expect(entries).toContainEqual({ loc: `https://mavile.es/pages/${slug}` });
    }
  });

  it('should_use_FRONTEND_URL_env_var_as_base_url', async () => {
    process.env['FRONTEND_URL'] = 'https://example.test';
    const service = new SitemapService(productService, categoryService);
    const entries = await service.buildEntries();
    entries.forEach((entry) => expect(entry.loc.startsWith('https://example.test')).toBe(true));
  });

  it('should_never_include_supplier_fields_in_any_entry', async () => {
    mockProductFindAll.mockResolvedValue({
      items: [new Product({ id: 1, name: 'Dress', slug: 'dress', status: 'Active' })],
      total: 1,
      page: 1,
      pageSize: 5000,
    });
    const service = new SitemapService(productService, categoryService);
    const entries = await service.buildEntries();
    expect(JSON.stringify(entries)).not.toMatch(/supplierId|supplierReference|supplierCost/i);
  });
});
