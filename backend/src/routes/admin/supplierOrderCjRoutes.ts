import { Router } from 'express';
import { freightQuote, push, getOrderStatus, simulateSandboxAdvance } from '../../presentation/controllers/cjOrderPushController';

const supplierOrderCjRouter = Router({ mergeParams: true });

supplierOrderCjRouter.post('/freight-quote', freightQuote);
supplierOrderCjRouter.post('/push', push);
supplierOrderCjRouter.get('/order', getOrderStatus);
supplierOrderCjRouter.post('/sandbox-advance', simulateSandboxAdvance);

export default supplierOrderCjRouter;
