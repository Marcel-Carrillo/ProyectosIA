import { Router } from 'express';
import { getConfig, getOrderPaymentStatus, handleWebhook } from '../../presentation/controllers/paymentController';

const router = Router();

router.get('/config', getConfig);
router.get('/orders/:orderNumber/payment-status', getOrderPaymentStatus);
// express.raw() body parser is applied in index.ts BEFORE express.json(), scoped to this path
router.post('/webhook', handleWebhook);

export default router;
