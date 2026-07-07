import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { configure, get, verify } from '../../presentation/controllers/spocketConnectionController';
import { sync, listCatalog } from '../../presentation/controllers/spocketCatalogSyncController';

// verify() performs a credential check against the external Spocket API on
// every call — rate-limited to prevent it being used to brute-force/enumerate
// upstream credentials or hammer the Spocket API, mirroring adminAuthRoutes.ts's
// authLimiter pattern.
const spocketVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const spocketRouter = Router({ mergeParams: true });

spocketRouter.post('/connection', configure);
spocketRouter.get('/connection', get);
spocketRouter.post('/connection/verify', spocketVerifyLimiter, verify);
spocketRouter.post('/sync', sync);
spocketRouter.get('/catalog', listCatalog);

export default spocketRouter;
