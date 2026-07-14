import { Response, NextFunction } from 'express';
import { CustomerAuthRequest } from '../../middleware/requireCustomerAuth';
import { CustomerAddressService } from '../../application/services/customerAddressService';
import { CustomerAddressRepository } from '../../infrastructure/repositories/customerAddressRepository';

const customerAddressService = new CustomerAddressService(new CustomerAddressRepository());

export async function listOwnAddresses(req: CustomerAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const addresses = await customerAddressService.list(req.customer!.customerId);
    res.json({ success: true, data: addresses, message: 'Addresses retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createOwnAddress(req: CustomerAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const address = await customerAddressService.create(req.customer!.customerId, req.body);
    res.status(201).json({ success: true, data: address, message: 'Address created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateOwnAddress(req: CustomerAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const addressId = parseInt(req.params['id'] as string, 10);
    const address = await customerAddressService.update(req.customer!.customerId, addressId, req.body);
    res.json({ success: true, data: address, message: 'Address updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteOwnAddress(req: CustomerAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const addressId = parseInt(req.params['id'] as string, 10);
    await customerAddressService.delete(req.customer!.customerId, addressId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
