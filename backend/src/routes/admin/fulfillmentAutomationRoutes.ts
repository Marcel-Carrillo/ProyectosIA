import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { listAlerts } from '../../presentation/controllers/fulfillmentAutomationAlertController';

// Mirrors adminAuthRoutes.ts/cjRoutes.ts's rate-limit convention (added after a
// CodeQL missing-rate-limiting finding): authenticated-admin only, but bounded
// against a compromised/misbehaving admin session hammering the alerts list.
const fulfillmentAutomationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const fulfillmentAutomationRouter = Router();

fulfillmentAutomationRouter.use(fulfillmentAutomationLimiter);

fulfillmentAutomationRouter.get('/alerts', listAlerts);

export default fulfillmentAutomationRouter;
