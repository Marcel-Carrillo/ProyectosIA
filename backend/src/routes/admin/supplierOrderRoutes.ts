import { Router } from 'express';
import {
  listSupplierOrders,
  getSupplierOrderById,
  createSupplierOrder,
  updateSupplierOrderStatus,
} from '../../presentation/controllers/supplierOrderController';

const supplierOrderRouter = Router();

supplierOrderRouter.get('/', listSupplierOrders);
supplierOrderRouter.post('/', createSupplierOrder);
supplierOrderRouter.get('/:id', getSupplierOrderById);
supplierOrderRouter.patch('/:id/status', updateSupplierOrderStatus);

export default supplierOrderRouter;
