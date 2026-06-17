import { Router } from 'express';
import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../../presentation/controllers/supplierController';

const supplierRouter = Router();

supplierRouter.get('/', listSuppliers);
supplierRouter.post('/', createSupplier);
supplierRouter.get('/:id', getSupplierById);
supplierRouter.patch('/:id', updateSupplier);
supplierRouter.delete('/:id', deleteSupplier);

export default supplierRouter;
