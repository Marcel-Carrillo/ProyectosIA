import { CustomerAddress } from '../../domain/models/customer';
import {
  ICustomerAddressRepository,
  CustomerAddressCreateData,
  CustomerAddressUpdateData,
} from '../../domain/repositories/customerAddressRepository';
import { AddressNotFoundError } from '../../infrastructure/repositories/customerRepository';
import { validateCustomerAddressData } from '../validator';

export class CustomerAddressService {
  constructor(private readonly repo: ICustomerAddressRepository) {}

  async list(customerId: number): Promise<CustomerAddress[]> {
    return this.repo.findAllByCustomerId(customerId);
  }

  async create(customerId: number, data: Record<string, unknown>): Promise<CustomerAddress> {
    validateCustomerAddressData(data);
    return this.repo.create(customerId, data as unknown as CustomerAddressCreateData);
  }

  async update(customerId: number, addressId: number, data: Record<string, unknown>): Promise<CustomerAddress> {
    const existing = await this.repo.findById(addressId, customerId);
    if (!existing) throw new AddressNotFoundError();
    validateCustomerAddressData(data, { requireAll: false });
    return this.repo.update(addressId, customerId, data as unknown as CustomerAddressUpdateData);
  }

  async delete(customerId: number, addressId: number): Promise<void> {
    const existing = await this.repo.findById(addressId, customerId);
    if (!existing) throw new AddressNotFoundError();
    await this.repo.delete(addressId, customerId);
  }
}
