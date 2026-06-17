/**
 * Supplier-data isolation regression tests (design decision D5 / spec requirement
 * "Supplier data is never exposed on customer-facing APIs").
 *
 * Two layers of protection are asserted:
 *  1. The public product serializer strips supplier fields even when the underlying
 *     domain object carries them.
 *  2. No `/api/public/suppliers` route exists, and no public payload leaks supplier keys.
 */
import request from 'supertest';
import express from 'express';
import { serializePublicProduct } from '../../../presentation/serializers/publicProduct';
import { Product } from '../../../domain/models/product';
import { ProductVariant } from '../../../domain/models/productVariant';

const SUPPLIER_KEYS = /supplierId|supplierReference|supplierCost/i;

const mockFindAll = jest.fn();
const mockFindById = jest.fn();

// Only the service is mocked. The repositories are left real so the typed error
// classes imported by errorHandler.ts (VariantNotFoundError, etc.) stay defined —
// mocking them away makes `err instanceof <undefined>` throw inside the handler.
jest.mock('../../../application/services/productService', () => ({
  ProductService: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
  })),
}));

import productPublicRoutes from '../productRoutes';
import { notFoundHandler, globalErrorHandler } from '../../../middleware/errorHandler';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/public/products', productPublicRoutes);
  app.use(notFoundHandler);
  app.use(globalErrorHandler);
  return app;
};

describe('publicProduct serializer omits supplier fields', () => {
  it('never emits supplierId/supplierReference/supplierCost', () => {
    const variant = new ProductVariant({
      id: 1,
      productId: 1,
      sku: 'SKU-1',
      publicPrice: 19.99,
      status: 'Active',
    });
    // Attach supplier-only fields as if they came from the DB row.
    Object.assign(variant, {
      supplierId: 7,
      supplierReference: 'SUP-REF-XYZ',
      supplierCost: 4.2,
    });
    const product = new Product({
      id: 1,
      name: 'Dress',
      slug: 'dress',
      status: 'Active',
      variants: [variant],
    });

    const dto = serializePublicProduct(product);
    const json = JSON.stringify(dto);
    expect(json).not.toMatch(SUPPLIER_KEYS);
  });
});

describe('Supplier data isolation — /api/public/* routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /api/public/suppliers returns 404 and leaks no supplier data', async () => {
    const res = await request(buildApp()).get('/api/public/suppliers');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(SUPPLIER_KEYS);
  });

  it('GET /api/public/products response contains no supplier fields', async () => {
    const variant = new ProductVariant({
      id: 1,
      productId: 1,
      sku: 'SKU-1',
      publicPrice: 19.99,
      status: 'Active',
    });
    Object.assign(variant, { supplierId: 7, supplierReference: 'SUP-REF', supplierCost: 4.2 });
    const product = new Product({ id: 1, name: 'Dress', slug: 'dress', status: 'Active', variants: [variant] });
    mockFindAll.mockResolvedValue({ items: [product], total: 1, page: 1, pageSize: 20 });

    const res = await request(buildApp()).get('/api/public/products');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(SUPPLIER_KEYS);
  });
});
