import { Router } from 'express';
import {
  listSupplierOrders,
  getSupplierOrderById,
  createSupplierOrder,
  updateSupplierOrderStatus,
} from '../../presentation/controllers/supplierOrderController';
import supplierOrderCjRouter from './supplierOrderCjRoutes';

const supplierOrderRouter = Router();

supplierOrderRouter.get('/', listSupplierOrders);
supplierOrderRouter.post('/', createSupplierOrder);
supplierOrderRouter.get('/:id', getSupplierOrderById);
supplierOrderRouter.patch('/:id/status', updateSupplierOrderStatus);

// Nested CJ Dropshipping order-push routes: /api/admin/supplier-orders/:id/cj/*
supplierOrderRouter.use('/:id/cj', supplierOrderCjRouter);

export default supplierOrderRouter;
