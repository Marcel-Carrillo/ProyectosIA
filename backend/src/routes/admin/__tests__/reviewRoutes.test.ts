import request from 'supertest';
import express from 'express';

jest.mock('../../../application/services/reviewService', () => ({
  ReviewService: jest.fn().mockImplementation(() => ({
    listModerationQueue: jest.fn(),
    moderateReview: jest.fn(),
    deleteReview: jest.fn(),
  })),
}));
jest.mock('../../../infrastructure/repositories/reviewRepository', () => ({
  ReviewRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/customerRepository', () => ({
  CustomerRepository: jest.fn().mockImplementation(() => ({})),
}));

import reviewAdminRoutes from '../reviewRoutes';
import { requireAdminAuth } from '../../../middleware/requireAdminAuth';
import { notFoundHandler, globalErrorHandler } from '../../../middleware/errorHandler';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/reviews', requireAdminAuth, reviewAdminRoutes);
  app.use(notFoundHandler);
  app.use(globalErrorHandler);
  return app;
};

describe('admin review routes — auth gating', () => {
  it('GET / without token returns 401', async () => {
    const res = await request(buildApp()).get('/api/admin/reviews');
    expect(res.status).toBe(401);
  });

  it('PATCH /:id/status without token returns 401', async () => {
    const res = await request(buildApp()).patch('/api/admin/reviews/1/status').send({ status: 'Approved' });
    expect(res.status).toBe(401);
  });

  it('DELETE /:id without token returns 401', async () => {
    const res = await request(buildApp()).delete('/api/admin/reviews/1');
    expect(res.status).toBe(401);
  });
});
