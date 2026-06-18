import { Router } from 'express';
import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../../presentation/controllers/customerController';

const customerRouter = Router();

customerRouter.get('/', listCustomers);
customerRouter.post('/', createCustomer);
customerRouter.get('/:id', getCustomerById);
customerRouter.patch('/:id', updateCustomer);
customerRouter.delete('/:id', deleteCustomer);

customerRouter.get('/:customerId/addresses', listAddresses);
customerRouter.post('/:customerId/addresses', createAddress);
customerRouter.patch('/:customerId/addresses/:addressId', updateAddress);
customerRouter.delete('/:customerId/addresses/:addressId', deleteAddress);

export default customerRouter;
