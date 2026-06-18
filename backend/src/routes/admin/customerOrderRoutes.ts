import { Router } from 'express';
import {
  listCustomerOrders,
  getCustomerOrderById,
  createCustomerOrder,
  updateCustomerOrderStatus,
} from '../../presentation/controllers/customerOrderController';

const customerOrderRouter = Router();

customerOrderRouter.get('/', listCustomerOrders);
customerOrderRouter.post('/', createCustomerOrder);
customerOrderRouter.get('/:id', getCustomerOrderById);
customerOrderRouter.patch('/:id/status', updateCustomerOrderStatus);

export default customerOrderRouter;
