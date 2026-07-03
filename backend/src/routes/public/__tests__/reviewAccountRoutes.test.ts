import request from 'supertest';
import express from 'express';

jest.mock('../../../application/services/reviewService', () => ({
  ReviewService: jest.fn().mockImplementation(() => ({
    checkEligibility: jest.fn(),
    submitReview: jest.fn(),
    listOwnReviews: jest.fn(),
  })),
}));
jest.mock('../../../infrastructure/repositories/reviewRepository', () => ({
  ReviewRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/customerRepository', () => ({
  CustomerRepository: jest.fn().mockImplementation(() => ({})),
}));

import accountRoutes from '../accountRoutes';
import { notFoundHandler, globalErrorHandler } from '../../../middleware/errorHandler';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/public/account', accountRoutes);
  app.use(notFoundHandler);
  app.use(globalErrorHandler);
  return app;
};

describe('review account routes — auth gating', () => {
  it('GET /products/:productId/review-eligibility without token returns 401', async () => {
    const res = await request(buildApp()).get('/api/public/account/products/1/review-eligibility');
    expect(res.status).toBe(401);
  });

  it('POST /reviews without token returns 401', async () => {
    const res = await request(buildApp()).post('/api/public/account/reviews').send({ productId: 1, rating: 5 });
    expect(res.status).toBe(401);
  });

  it('GET /reviews without token returns 401', async () => {
    const res = await request(buildApp()).get('/api/public/account/reviews');
    expect(res.status).toBe(401);
  });
});
