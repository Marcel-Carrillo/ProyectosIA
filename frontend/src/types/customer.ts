export type AddressType = 'Shipping' | 'Billing';

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: number;
  customerId: number;
  type: AddressType;
  fullName: string;
  phone: string | null;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
}

export interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
}

export interface CustomerListResult {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CustomerListResponse {
  success: boolean;
  data: CustomerListResult;
  message: string;
}

export interface CustomerResponse {
  success: boolean;
  data: Customer;
  message: string;
}

export interface CustomerAdminApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface CreateCustomerAddressInput {
  type: AddressType;
  fullName: string;
  phone?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export interface UpdateCustomerAddressInput {
  type?: AddressType;
  fullName?: string;
  phone?: string | null;
  streetLine1?: string;
  streetLine2?: string | null;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

export interface AddressListResponse {
  success: boolean;
  data: CustomerAddress[];
  message: string;
}

export interface AddressResponse {
  success: boolean;
  data: CustomerAddress;
  message: string;
}
