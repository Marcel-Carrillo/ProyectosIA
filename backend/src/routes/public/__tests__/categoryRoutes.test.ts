import request from 'supertest';
import express from 'express';

const mockFindAll = jest.fn();

jest.mock('../../../application/services/categoryService', () => ({
  CategoryService: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
  })),
}));

jest.mock('../../../infrastructure/repositories/categoryRepository', () => ({
  CategoryRepository: jest.fn().mockImplementation(() => ({})),
}));

import categoryPublicRoutes from '../categoryRoutes';

const app = express();
app.use('/api/public/categories', categoryPublicRoutes);

describe('GET /api/public/categories', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with the standard envelope of categories', async () => {
    mockFindAll.mockResolvedValue([
      { id: 1, name: 'Dresses', status: 'Active' },
      { id: 2, name: 'Shoes', status: 'Active' },
    ]);
    const res = await request(app).get('/api/public/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    // Default call excludes inactive categories.
    expect(mockFindAll).toHaveBeenCalledWith(false);
  });
});
