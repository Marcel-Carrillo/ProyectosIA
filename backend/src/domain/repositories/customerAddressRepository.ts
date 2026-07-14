import { CustomerAddress } from '../models/customer';

export interface CustomerAddressCreateData {
  type: 'Shipping' | 'Billing';
  isDefault?: boolean;
  fullName: string;
  phone?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export type CustomerAddressUpdateData = Partial<CustomerAddressCreateData>;

export interface ICustomerAddressRepository {
  findAllByCustomerId(customerId: number): Promise<CustomerAddress[]>;
  findById(id: number, customerId: number): Promise<CustomerAddress | null>;
  create(customerId: number, data: CustomerAddressCreateData): Promise<CustomerAddress>;
  update(id: number, customerId: number, data: CustomerAddressUpdateData): Promise<CustomerAddress>;
  delete(id: number, customerId: number): Promise<void>;
}
