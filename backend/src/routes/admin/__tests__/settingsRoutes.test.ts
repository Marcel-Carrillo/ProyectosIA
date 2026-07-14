import request from 'supertest';
import express from 'express';

jest.mock('../../../infrastructure/repositories/automationSettingsRepository', () => ({
  AutomationSettingsRepository: jest.fn().mockImplementation(() => ({})),
}));

import settingsAdminRoutes from '../settingsRoutes';
import { requireAdminAuth } from '../../../middleware/requireAdminAuth';

// Mirrors the production mounting in src/index.ts: settings management lives
// behind requireAdminAuth.
const app = express();
app.use(express.json());
const adminRouter = express.Router();
adminRouter.use(requireAdminAuth);
adminRouter.use('/settings', settingsAdminRoutes);
app.use('/api/admin', adminRouter);

describe('admin settings routes require authentication', () => {
  it.each([
    ['get', '/api/admin/settings/automation'],
    ['patch', '/api/admin/settings/automation'],
  ] as const)('%s %s returns 401 without a token', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
