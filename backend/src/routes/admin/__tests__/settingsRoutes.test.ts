import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';

jest.mock('../../../infrastructure/repositories/automationSettingsRepository', () => ({
  AutomationSettingsRepository: jest.fn().mockImplementation(() => ({})),
}));

import settingsAdminRoutes from '../settingsRoutes';
import { requireAdminAuth } from '../../../middleware/requireAdminAuth';

// Mirrors the production mounting in src/index.ts: a rate limiter runs ahead
// of requireAdminAuth on this path, so the limiter also protects the
// authorization check itself, not just the handler behind it.
const settingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const app = express();
app.use(express.json());
app.use('/api/admin/settings', settingsLimiter, requireAdminAuth, settingsAdminRoutes);

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
