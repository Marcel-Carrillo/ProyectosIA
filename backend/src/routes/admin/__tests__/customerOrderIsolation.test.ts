import express from 'express';
import request from 'supertest';

const mockFindAll = jest.fn().mockResolvedValue({
  items: [
    {
      id: 1,
      orderNumber: 'ORD-000001',
      customerId: 1,
      status: 'PendingPayment',
      paymentStatus: 'Pending',
      fulfillmentStatus: 'NotStarted',
      subtotalAmount: '10.00',
      shippingAmount: '0.00',
      discountAmount: '0.00',
      totalAmount: '10.00',
      currency: 'EUR',
      shippingAddressSnapshot: { fullName: 'Jane' },
      billingAddressSnapshot: { fullName: 'Jane' },
      customer: { id: 1, firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' },
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
});
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdateStatus = jest.fn();

jest.mock('../../../application/services/customerOrderService', () => ({
  CustomerOrderService: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    create: mockCreate,
    updateStatus: mockUpdateStatus,
  })),
}));

jest.mock('../../../infrastructure/repositories/customerOrderRepository', () => ({
  CustomerOrderRepository: jest.fn().mockImplementation(() => ({})),
}));

import customerOrderRoutes from '../customerOrderRoutes';
import { notFoundHandler, globalErrorHandler } from '../../../middleware/errorHandler';

const SUPPLIER_KEYS = /supplierId|supplierReference|supplierCost/i;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/customer-orders', customerOrderRoutes);
  app.use(notFoundHandler);
  app.use(globalErrorHandler);
  return app;
};

describe('customer order supplier isolation', () => {
  it('list response does not include supplier fields', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/admin/customer-orders');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(SUPPLIER_KEYS);
  });
});
