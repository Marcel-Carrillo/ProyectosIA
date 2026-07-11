import request from 'supertest';
import express from 'express';

jest.mock('../../../application/services/categoryService', () => ({
  CategoryService: jest.fn().mockImplementation(() => ({
    findAll: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../../infrastructure/repositories/categoryRepository', () => ({
  CategoryRepository: jest.fn().mockImplementation(() => ({})),
}));

import categoryAdminRoutes from '../categoryRoutes';
import { requireAdminAuth } from '../../../middleware/requireAdminAuth';

// Mirrors the production mounting in src/index.ts: category management lives
// behind requireAdminAuth. This test guards against ever re-exposing category
// writes on an unauthenticated surface.
const app = express();
app.use(express.json());
const adminRouter = express.Router();
adminRouter.use(requireAdminAuth);
adminRouter.use('/categories', categoryAdminRoutes);
app.use('/api/admin', adminRouter);

describe('admin category routes require authentication', () => {
  it.each([
    ['get', '/api/admin/categories'],
    ['post', '/api/admin/categories'],
    ['put', '/api/admin/categories/1'],
    ['delete', '/api/admin/categories/1'],
  ] as const)('%s %s returns 401 without a token', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
