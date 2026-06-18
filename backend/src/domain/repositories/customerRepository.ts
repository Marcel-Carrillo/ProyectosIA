import { Customer, CustomerAddress } from '../models/customer';

export interface CustomerCreateData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
}

export interface CustomerUpdateData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
}

export interface CustomerListFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerListResult {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AddressCreateData {
  type: string;
  fullName: string;
  phone?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export interface AddressUpdateData {
  type?: string;
  fullName?: string;
  phone?: string | null;
  streetLine1?: string;
  streetLine2?: string | null;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

export interface ICustomerRepository {
  findAll(filters?: CustomerListFilters): Promise<CustomerListResult>;
  findById(id: number): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  create(data: CustomerCreateData): Promise<Customer>;
  update(id: number, data: CustomerUpdateData): Promise<Customer>;
  countOrders(customerId: number): Promise<number>;
  delete(id: number): Promise<void>;
  findAddressesByCustomerId(customerId: number): Promise<CustomerAddress[]>;
  findAddressById(id: number, customerId: number): Promise<CustomerAddress | null>;
  createAddress(customerId: number, data: AddressCreateData): Promise<CustomerAddress>;
  updateAddress(id: number, data: AddressUpdateData): Promise<CustomerAddress>;
  deleteAddress(id: number): Promise<void>;
}
