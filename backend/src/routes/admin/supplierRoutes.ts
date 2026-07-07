import { Router } from 'express';
import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../../presentation/controllers/supplierController';
import cjRouter from './cjRoutes';

const supplierRouter = Router();

supplierRouter.get('/', listSuppliers);
supplierRouter.post('/', createSupplier);
supplierRouter.get('/:id', getSupplierById);
supplierRouter.patch('/:id', updateSupplier);
supplierRouter.delete('/:id', deleteSupplier);

// Nested CJ Dropshipping connection/sync routes: /api/admin/suppliers/:supplierId/cj/*
supplierRouter.use('/:supplierId/cj', cjRouter);

export default supplierRouter;
