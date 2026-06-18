import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../../application/services/customerService';
import { CustomerRepository } from '../../infrastructure/repositories/customerRepository';
import { logger } from '../../infrastructure/logger';
import { ValidationError } from '../../application/validator';

function parseIdParam(value: string, paramName = 'id'): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) {
    throw new ValidationError(`Parameter '${paramName}' must be a valid integer`);
  }
  return id;
}

const customerService = new CustomerService(new CustomerRepository());

// ─── Customer CRUD ───────────────────────────────────────────────────────────

export async function listCustomers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, page, pageSize } = req.query;
    const result = await customerService.findAll({
      search: search as string | undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : undefined,
    });
    logger.info('Customers listed', { total: result.total, page: result.page });
    res.json({ success: true, data: result, message: 'Customers retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getCustomerById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const customer = await customerService.findById(id);
    res.json({ success: true, data: customer, message: 'Customer retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customer = await customerService.create(req.body);
    logger.info('Customer created', { customerId: customer.id });
    res.status(201).json({ success: true, data: customer, message: 'Customer created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    const customer = await customerService.update(id, req.body);
    logger.info('Customer updated', { customerId: id });
    res.json({ success: true, data: customer, message: 'Customer updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] as string);
    await customerService.delete(id);
    logger.info('Customer deleted', { customerId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── Address sub-resource ────────────────────────────────────────────────────

export async function listAddresses(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId = parseIdParam(req.params['customerId'] as string, 'customerId');
    const addresses = await customerService.findAddressesByCustomerId(customerId);
    res.json({ success: true, data: addresses, message: 'Addresses retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId = parseIdParam(req.params['customerId'] as string, 'customerId');
    const address = await customerService.createAddress(customerId, req.body);
    logger.info('Customer address created', { customerId, addressId: address.id });
    res.status(201).json({ success: true, data: address, message: 'Address created successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId = parseIdParam(req.params['customerId'] as string, 'customerId');
    const addressId = parseIdParam(req.params['addressId'] as string, 'addressId');
    const address = await customerService.updateAddress(customerId, addressId, req.body);
    logger.info('Customer address updated', { customerId, addressId });
    res.json({ success: true, data: address, message: 'Address updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deleteAddress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId = parseIdParam(req.params['customerId'] as string, 'customerId');
    const addressId = parseIdParam(req.params['addressId'] as string, 'addressId');
    await customerService.deleteAddress(customerId, addressId);
    logger.info('Customer address deleted', { customerId, addressId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
