import { Router } from 'express';
import {
  listCustomerOrders,
  getCustomerOrderById,
  createCustomerOrder,
  updateCustomerOrderStatus,
} from '../../presentation/controllers/customerOrderController';
import { generateSupplierOrdersFromCustomerOrder } from '../../presentation/controllers/supplierOrderController';

const customerOrderRouter = Router();

customerOrderRouter.get('/', listCustomerOrders);
customerOrderRouter.post('/', createCustomerOrder);
customerOrderRouter.get('/:id', getCustomerOrderById);
customerOrderRouter.patch('/:id/status', updateCustomerOrderStatus);
customerOrderRouter.post('/:id/supplier-orders', generateSupplierOrdersFromCustomerOrder);

export default customerOrderRouter;
