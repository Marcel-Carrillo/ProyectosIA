import request from 'supertest';
import express from 'express';

const mockFindAll = jest.fn();

jest.mock('../../../infrastructure/repositories/automationAlertRepository', () => ({
  AutomationAlertRepository: jest.fn().mockImplementation(() => ({ findAll: mockFindAll })),
}));

import fulfillmentAutomationAdminRoutes from '../fulfillmentAutomationRoutes';
import { requireAdminAuth } from '../../../middleware/requireAdminAuth';
import { notFoundHandler, globalErrorHandler } from '../../../middleware/errorHandler';

const buildApp = (withAuth: boolean) => {
  const app = express();
  app.use(express.json());
  const adminRouter = express.Router();
  if (withAuth) adminRouter.use(requireAdminAuth);
  adminRouter.use('/fulfillment-automation', fulfillmentAutomationAdminRoutes);
  app.use('/api/admin', adminRouter);
  app.use(notFoundHandler);
  app.use(globalErrorHandler);
  return app;
};

describe('admin fulfillment-automation routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /alerts without token returns 401', async () => {
    const res = await request(buildApp(true)).get('/api/admin/fulfillment-automation/alerts');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /alerts returns the paginated alert list', async () => {
    mockFindAll.mockResolvedValue({
      items: [{ id: 1, type: 'CjPushFailed', customerOrderId: 10, supplierOrderId: 5, message: 'x', resolvedAt: null, createdAt: new Date() }],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const res = await request(buildApp(false)).get('/api/admin/fulfillment-automation/alerts');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it('GET /alerts?resolved=false maps to the repository default unresolved-only filter', async () => {
    mockFindAll.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    await request(buildApp(false)).get('/api/admin/fulfillment-automation/alerts?resolved=false');

    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ resolvedOnly: undefined }));
  });

  it('GET /alerts without the resolved param requests all alerts (resolvedOnly: false)', async () => {
    mockFindAll.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    await request(buildApp(false)).get('/api/admin/fulfillment-automation/alerts');

    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ resolvedOnly: false }));
  });
});
