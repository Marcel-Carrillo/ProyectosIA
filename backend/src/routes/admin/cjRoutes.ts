import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { configure, get, verify } from '../../presentation/controllers/cjConnectionController';
import { sync, listCatalog } from '../../presentation/controllers/cjCatalogSyncController';
import { promote, activate, deactivate, freightEstimate, recategorize } from '../../presentation/controllers/cjCatalogPromotionController';

// verify() performs a credential check against the real CJ Dropshipping API on
// every call — rate-limited to prevent it being used to brute-force/enumerate
// upstream credentials or hammer the CJ API, mirroring adminAuthRoutes.ts's
// authLimiter pattern (originally added here after a CodeQL missing-rate-limiting
// finding on the equivalent Spocket placeholder endpoint).
const cjVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Mirrors cjVerifyLimiter: promote is a potentially heavy bulk write against
// the live catalog data, rate-limited to prevent abuse of the bulk-create path.
const cjPromoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Mirrors cjVerifyLimiter: hits the live CJ freight-quote API per call.
const cjFreightEstimateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Mirrors cjPromoteLimiter: a heavy admin maintenance action that can rewrite
// the category of potentially hundreds of products in one call.
const cjRecategorizeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const cjRouter = Router({ mergeParams: true });

cjRouter.post('/connection', configure);
cjRouter.get('/connection', get);
cjRouter.post('/connection/verify', cjVerifyLimiter, verify);
cjRouter.post('/sync', sync);
cjRouter.get('/catalog', listCatalog);
cjRouter.post('/catalog/promote', cjPromoteLimiter, promote);
cjRouter.post('/catalog/:cjCatalogItemId/activate', activate);
cjRouter.post('/catalog/:cjCatalogItemId/deactivate', deactivate);
cjRouter.get('/catalog/:cjCatalogItemId/freight-estimate', cjFreightEstimateLimiter, freightEstimate);
cjRouter.post('/recategorize', cjRecategorizeLimiter, recategorize);

export default cjRouter;
