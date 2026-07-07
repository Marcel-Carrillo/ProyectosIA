import { Router } from 'express';
import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../../presentation/controllers/supplierController';
import spocketRouter from './spocketRoutes';

const supplierRouter = Router();

supplierRouter.get('/', listSuppliers);
supplierRouter.post('/', createSupplier);
supplierRouter.get('/:id', getSupplierById);
supplierRouter.patch('/:id', updateSupplier);
supplierRouter.delete('/:id', deleteSupplier);

// Nested Spocket connection/sync routes: /api/admin/suppliers/:supplierId/spocket/*
supplierRouter.use('/:supplierId/spocket', spocketRouter);

export default supplierRouter;
