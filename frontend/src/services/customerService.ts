import axios, { AxiosError } from 'axios';
import {
  CustomerQueryParams,
  CustomerListResponse,
  CustomerResponse,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerAdminApiError,
  CreateCustomerAddressInput,
  UpdateCustomerAddressInput,
  AddressListResponse,
  AddressResponse,
} from '../types/customer';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/customers`;

export function mapCustomerError(code: string): string {
  switch (code) {
    case 'CUSTOMER_NOT_FOUND':
      return 'Customer not found.';
    case 'CUSTOMER_EMAIL_CONFLICT':
      return 'A customer with this email already exists.';
    case 'CUSTOMER_HAS_ORDERS':
      return 'This customer cannot be deleted because they have orders.';
    case 'ADDRESS_NOT_FOUND':
      return 'Address not found.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export function extractCustomerErrorMessage(error: unknown): string {
  const code = (error as AxiosError<CustomerAdminApiError>).response?.data?.error?.code;
  return mapCustomerError(code ?? '');
}

export function extractCustomerErrorCode(error: unknown): string {
  return (error as AxiosError<CustomerAdminApiError>).response?.data?.error?.code ?? '';
}

export const customerService = {
  list: async (params?: CustomerQueryParams): Promise<CustomerListResponse> => {
    try {
      const response = await axios.get<CustomerListResponse>(ADMIN_BASE, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  },

  getById: async (id: number): Promise<CustomerResponse> => {
    try {
      const response = await axios.get<CustomerResponse>(`${ADMIN_BASE}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw error;
    }
  },

  create: async (data: CreateCustomerInput): Promise<CustomerResponse> => {
    try {
      const response = await axios.post<CustomerResponse>(ADMIN_BASE, data);
      return response.data;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  },

  update: async (id: number, data: UpdateCustomerInput): Promise<CustomerResponse> => {
    try {
      const response = await axios.patch<CustomerResponse>(`${ADMIN_BASE}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  },

  delete: async (id: number): Promise<void> => {
    try {
      await axios.delete(`${ADMIN_BASE}/${id}`);
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  },

  listAddresses: async (customerId: number): Promise<AddressListResponse> => {
    try {
      const response = await axios.get<AddressListResponse>(
        `${ADMIN_BASE}/${customerId}/addresses`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching addresses:', error);
      throw error;
    }
  },

  createAddress: async (
    customerId: number,
    data: CreateCustomerAddressInput
  ): Promise<AddressResponse> => {
    try {
      const response = await axios.post<AddressResponse>(
        `${ADMIN_BASE}/${customerId}/addresses`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Error creating address:', error);
      throw error;
    }
  },

  updateAddress: async (
    customerId: number,
    addressId: number,
    data: UpdateCustomerAddressInput
  ): Promise<AddressResponse> => {
    try {
      const response = await axios.patch<AddressResponse>(
        `${ADMIN_BASE}/${customerId}/addresses/${addressId}`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  },

  deleteAddress: async (customerId: number, addressId: number): Promise<void> => {
    try {
      await axios.delete(`${ADMIN_BASE}/${customerId}/addresses/${addressId}`);
    } catch (error) {
      console.error('Error deleting address:', error);
      throw error;
    }
  },
};
