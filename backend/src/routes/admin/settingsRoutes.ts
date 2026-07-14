import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getAutomationSettings,
  updateAutomationSettings,
} from '../../presentation/controllers/automationSettingsController';

// Mirrors adminAuthRoutes.ts/cjRoutes.ts's rate-limit convention (added after a
// CodeQL missing-rate-limiting finding): these routes are authenticated-admin
// only, but PATCH writes to a global singleton config row, so still worth
// bounding against a compromised/misbehaving admin session.
const settingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const settingsRouter = Router();

settingsRouter.use(settingsLimiter);

settingsRouter.get('/automation', getAutomationSettings);
settingsRouter.patch('/automation', updateAutomationSettings);

export default settingsRouter;
