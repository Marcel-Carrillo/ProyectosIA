import { Router } from 'express';
import { configure, get, verify } from '../../presentation/controllers/spocketConnectionController';
import { sync, listCatalog } from '../../presentation/controllers/spocketCatalogSyncController';

const spocketRouter = Router({ mergeParams: true });

spocketRouter.post('/connection', configure);
spocketRouter.get('/connection', get);
spocketRouter.post('/connection/verify', verify);
spocketRouter.post('/sync', sync);
spocketRouter.get('/catalog', listCatalog);

export default spocketRouter;
