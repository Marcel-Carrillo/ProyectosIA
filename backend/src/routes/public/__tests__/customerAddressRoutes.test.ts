import request from 'supertest';
import express from 'express';

jest.mock('../../../infrastructure/repositories/customerAddressRepository', () => ({
  CustomerAddressRepository: jest.fn().mockImplementation(() => ({})),
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

describe('customer self-service address routes — auth gating', () => {
  it('GET /addresses without token returns 401', async () => {
    const res = await request(buildApp()).get('/api/public/account/addresses');
    expect(res.status).toBe(401);
  });

  it('POST /addresses without token returns 401', async () => {
    const res = await request(buildApp()).post('/api/public/account/addresses').send({});
    expect(res.status).toBe(401);
  });

  it('PATCH /addresses/:id without token returns 401', async () => {
    const res = await request(buildApp()).patch('/api/public/account/addresses/1').send({});
    expect(res.status).toBe(401);
  });

  it('DELETE /addresses/:id without token returns 401', async () => {
    const res = await request(buildApp()).delete('/api/public/account/addresses/1');
    expect(res.status).toBe(401);
  });
});
