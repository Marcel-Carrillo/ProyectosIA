import {
  ICustomerRepository,
  CustomerCreateData,
  CustomerUpdateData,
  CustomerListFilters,
  CustomerListResult,
  AddressCreateData,
  AddressUpdateData,
} from '../../domain/repositories/customerRepository';
import { Customer, CustomerAddress } from '../../domain/models/customer';
import { validateCustomerData, validateCustomerAddressData } from '../validator';
import {
  CustomerNotFoundError,
  CustomerEmailConflictError,
  CustomerHasOrdersError,
  AddressNotFoundError,
} from '../../infrastructure/repositories/customerRepository';

const MAX_PAGE_SIZE = 100;

export class CustomerService {
  constructor(private readonly repo: ICustomerRepository) {}

  async findAll(filters: CustomerListFilters = {}): Promise<CustomerListResult> {
    const pageSize =
      filters.pageSize !== undefined
        ? Math.min(Math.max(1, filters.pageSize), MAX_PAGE_SIZE)
        : 20;
    return this.repo.findAll({ ...filters, pageSize });
  }

  async findById(id: number): Promise<Customer> {
    const customer = await this.repo.findById(id);
    if (!customer) throw new CustomerNotFoundError();
    return customer;
  }

  async create(data: CustomerCreateData): Promise<Customer> {
    const normalized: CustomerCreateData = {
      ...data,
      email: data.email.trim().toLowerCase(),
    };
    validateCustomerData(normalized as unknown as Record<string, unknown>);

    const existing = await this.repo.findByEmail(normalized.email);
    if (existing) throw new CustomerEmailConflictError();

    return this.repo.create(normalized);
  }

  async update(id: number, data: CustomerUpdateData): Promise<Customer> {
    const current = await this.repo.findById(id);
    if (!current) throw new CustomerNotFoundError();

    const normalized: CustomerUpdateData = { ...data };
    if (data.email !== undefined) {
      normalized.email = data.email.trim().toLowerCase();
    }

    validateCustomerData(normalized as unknown as Record<string, unknown>, { requireFields: false });

    if (normalized.email !== undefined) {
      const existing = await this.repo.findByEmail(normalized.email);
      if (existing && existing.id !== id) throw new CustomerEmailConflictError();
    }

    return this.repo.update(id, normalized);
  }

  async delete(id: number): Promise<void> {
    const current = await this.repo.findById(id);
    if (!current) throw new CustomerNotFoundError();

    const orderCount = await this.repo.countOrders(id);
    if (orderCount > 0) throw new CustomerHasOrdersError();

    await this.repo.delete(id);
  }

  async findAddressesByCustomerId(customerId: number): Promise<CustomerAddress[]> {
    const customer = await this.repo.findById(customerId);
    if (!customer) throw new CustomerNotFoundError();
    return this.repo.findAddressesByCustomerId(customerId);
  }

  async createAddress(customerId: number, data: AddressCreateData): Promise<CustomerAddress> {
    const customer = await this.repo.findById(customerId);
    if (!customer) throw new CustomerNotFoundError();
    validateCustomerAddressData(data as unknown as Record<string, unknown>);
    return this.repo.createAddress(customerId, data);
  }

  async updateAddress(
    customerId: number,
    addressId: number,
    data: AddressUpdateData
  ): Promise<CustomerAddress> {
    const customer = await this.repo.findById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    const address = await this.repo.findAddressById(addressId, customerId);
    if (!address) throw new AddressNotFoundError();

    validateCustomerAddressData(data as unknown as Record<string, unknown>, { requireAll: false });
    return this.repo.updateAddress(addressId, data);
  }

  async deleteAddress(customerId: number, addressId: number): Promise<void> {
    const customer = await this.repo.findById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    const address = await this.repo.findAddressById(addressId, customerId);
    if (!address) throw new AddressNotFoundError();

    await this.repo.deleteAddress(addressId);
  }
}
