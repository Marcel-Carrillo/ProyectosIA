import { Router } from 'express';
import { freightQuote, push, getOrderStatus } from '../../presentation/controllers/cjOrderPushController';

const supplierOrderCjRouter = Router({ mergeParams: true });

supplierOrderCjRouter.post('/freight-quote', freightQuote);
supplierOrderCjRouter.post('/push', push);
supplierOrderCjRouter.get('/order', getOrderStatus);

export default supplierOrderCjRouter;
