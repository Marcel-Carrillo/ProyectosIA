/**
 * Spocket-data isolation regression test (spec requirement "Spocket connection
 * endpoints are admin-only" / "Staged Spocket data ... never exposed on
 * customer-facing APIs"). Mirrors supplierIsolation.test.ts: mounts a REAL
 * public router (productPublicRoutes) so the app has genuine routing behavior,
 * rather than an empty app where every path would 404 regardless of whether
 * isolation is actually correct.
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
  // Spocket endpoints only exist under /api/admin/suppliers/:supplierId/spocket/*
  // — intentionally not mounted anywhere under /api/public/*.
  app.use(notFoundHandler);
  app.use(globalErrorHandler);
  return app;
};

describe('Spocket data isolation — /api/public/* routes', () => {
  beforeEach(() => jest.clearAllMocks());

  const candidatePaths = [
    '/api/public/suppliers/1/spocket/connection',
    '/api/public/suppliers/1/spocket/connection/verify',
    '/api/public/suppliers/1/spocket/sync',
    '/api/public/suppliers/1/spocket/catalog',
    '/api/public/products/1/spocket/connection',
    '/api/public/spocket/catalog',
  ];

  it.each(candidatePaths)('GET %s returns 404 (route does not exist)', async (path) => {
    const res = await request(buildApp()).get(path);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/public/suppliers/1/spocket/sync returns 404', async () => {
    const res = await request(buildApp()).post('/api/public/suppliers/1/spocket/sync');
    expect(res.status).toBe(404);
  });

  it('the real public product router still serves its own routes (sanity check that the app is genuinely wired up)', async () => {
    mockFindAll.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    const res = await request(buildApp()).get('/api/public/products');
    expect(res.status).toBe(200);
  });
});
