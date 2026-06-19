import { Router } from 'express';
import { getConfig, handleWebhook } from '../../presentation/controllers/paymentController';

const router = Router();

router.get('/config', getConfig);
// express.raw() body parser is applied in index.ts BEFORE express.json(), scoped to this path
router.post('/webhook', handleWebhook);

export default router;
