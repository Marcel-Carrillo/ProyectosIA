/**
 * CJ Dropshipping data isolation regression test (spec requirement "CJ
 * connection/order-push endpoints are admin-only" / "Staged CJ data ... never
 * exposed on customer-facing APIs"). Mirrors supplierIsolation.test.ts: mounts a
 * REAL public router (productPublicRoutes) so the app has genuine routing
 * behavior, rather than an empty app where every path would 404 regardless of
 * whether isolation is actually correct.
 */
import request from 'supertest';
import express from 'express';
import { notFoundHandler, globalErrorHandler } from '../../../middleware/errorHandler';

const mockFindAll = jest.fn();
const mockFindById = jest.fn();

jest.mock('../../../application/services/productService', () => ({
  ProductService: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
  })),
}));

import productPublicRoutes from '../productRoutes';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  // Real public router mounted at its real path, exactly as in index.ts.
  app.use('/api/public/products', productPublicRoutes);
  // CJ endpoints only exist under /api/admin/suppliers/:supplierId/cj/* and
  // /api/admin/supplier-orders/:id/cj/* — intentionally not mounted anywhere
  // under /api/public/*.
  app.use(notFoundHandler);
  app.use(globalErrorHandler);
  return app;
};

describe('CJ Dropshipping data isolation — /api/public/* routes', () => {
  beforeEach(() => jest.clearAllMocks());

  const candidatePaths = [
    '/api/public/suppliers/1/cj/connection',
    '/api/public/suppliers/1/cj/connection/verify',
    '/api/public/suppliers/1/cj/sync',
    '/api/public/suppliers/1/cj/catalog',
    '/api/public/suppliers/1/cj/catalog/promote',
    '/api/public/suppliers/1/cj/catalog/1/activate',
    '/api/public/suppliers/1/cj/catalog/1/deactivate',
    '/api/public/supplier-orders/1/cj/freight-quote',
    '/api/public/supplier-orders/1/cj/order',
    '/api/public/products/1/cj/connection',
    '/api/public/cj/catalog',
  ];

  it.each(candidatePaths)('GET %s returns 404 (route does not exist)', async (path) => {
    const res = await request(buildApp()).get(path);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/public/suppliers/1/cj/sync returns 404', async () => {
    const res = await request(buildApp()).post('/api/public/suppliers/1/cj/sync');
    expect(res.status).toBe(404);
  });

  it('POST /api/public/suppliers/1/cj/catalog/promote returns 404', async () => {
    const res = await request(buildApp()).post('/api/public/suppliers/1/cj/catalog/promote');
    expect(res.status).toBe(404);
  });

  it('POST /api/public/suppliers/1/cj/catalog/1/activate returns 404', async () => {
    const res = await request(buildApp()).post('/api/public/suppliers/1/cj/catalog/1/activate');
    expect(res.status).toBe(404);
  });

  it('POST /api/public/supplier-orders/1/cj/push returns 404', async () => {
    const res = await request(buildApp()).post('/api/public/supplier-orders/1/cj/push');
    expect(res.status).toBe(404);
  });

  it('the real public product router still serves its own routes (sanity check that the app is genuinely wired up)', async () => {
    mockFindAll.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    const res = await request(buildApp()).get('/api/public/products');
    expect(res.status).toBe(200);
  });

  it('public product detail response never leaks cjCatalogItemId even when the underlying variant carries one', async () => {
    // ProductVariant.cjCatalogItemId is a real field on the domain model (needed
    // so the admin promotion flow can persist/read the link); this proves the
    // *public* serializer's allow-list keeps it out regardless, independent of
    // the admin-only variantSelect DB-level omission tested elsewhere.
    mockFindById.mockResolvedValue({
      id: 1,
      name: 'Promoted Dress',
      slug: 'promoted-dress',
      status: 'Active',
      mainImageUrl: null,
      category: null,
      images: [],
      translations: [],
      variants: [
        {
          id: 50,
          productId: 1,
          sku: 'CJ-vid-1',
          size: 'M',
          color: 'Black',
          publicPrice: 39.99,
          compareAtPrice: null,
          status: 'Active',
          cjCatalogItemId: 7,
        },
      ],
    });
    const res = await request(buildApp()).get('/api/public/products/1');

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/cjCatalogItemId/);
  });
});
