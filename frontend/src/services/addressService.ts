import axios, { AxiosError } from 'axios';
import { getCustomerAccessToken } from './customerAuthService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const ACCOUNT_ADDRESSES_BASE = `${API_BASE_URL}/api/public/account/addresses`;

export type SelfServiceAddressType = 'Shipping' | 'Billing';

export interface SelfServiceCustomerAddress {
  id: number;
  type: SelfServiceAddressType;
  isDefault: boolean;
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

export interface CreateSelfServiceAddressInput {
  type: SelfServiceAddressType;
  fullName: string;
  phone?: string;
  streetLine1: string;
  streetLine2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export type UpdateSelfServiceAddressInput = Partial<CreateSelfServiceAddressInput>;

interface SelfServiceAddressListResponse {
  success: boolean;
  data: SelfServiceCustomerAddress[];
  message: string;
}

interface SelfServiceAddressResponse {
  success: boolean;
  data: SelfServiceCustomerAddress;
  message: string;
}

function authHeaders() {
  const token = getCustomerAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function mapAddressError(code: string): string {
  switch (code) {
    case 'ADDRESS_NOT_FOUND':
      return 'Address not found.';
    case 'ADDRESS_DEFAULT_CONFLICT':
      return 'Could not set this address as default, please try again.';
    case 'VALIDATION_ERROR':
      return 'Please check the address fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export function extractAddressErrorCode(error: unknown): string {
  return (error as AxiosError<{ error?: { code?: string } }>).response?.data?.error?.code ?? 'UNKNOWN_ERROR';
}

export const addressService = {
  /** GET /api/public/account/addresses — requires customer auth. */
  list: async (): Promise<SelfServiceCustomerAddress[]> => {
    try {
      const response = await axios.get<SelfServiceAddressListResponse>(ACCOUNT_ADDRESSES_BASE, {
        headers: authHeaders(),
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching saved addresses:', error);
      throw error;
    }
  },

  /** POST /api/public/account/addresses — requires customer auth. */
  create: async (input: CreateSelfServiceAddressInput): Promise<SelfServiceCustomerAddress> => {
    try {
      const response = await axios.post<SelfServiceAddressResponse>(ACCOUNT_ADDRESSES_BASE, input, {
        headers: authHeaders(),
      });
      return response.data.data;
    } catch (error) {
      console.error('Error creating saved address:', error);
      throw error;
    }
  },

  /** PATCH /api/public/account/addresses/:id — requires customer auth. */
  update: async (id: number, input: UpdateSelfServiceAddressInput): Promise<SelfServiceCustomerAddress> => {
    try {
      const response = await axios.patch<SelfServiceAddressResponse>(
        `${ACCOUNT_ADDRESSES_BASE}/${id}`,
        input,
        { headers: authHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error updating saved address:', error);
      throw error;
    }
  },

  /** DELETE /api/public/account/addresses/:id — requires customer auth. */
  remove: async (id: number): Promise<void> => {
    try {
      await axios.delete(`${ACCOUNT_ADDRESSES_BASE}/${id}`, { headers: authHeaders() });
    } catch (error) {
      console.error('Error deleting saved address:', error);
      throw error;
    }
  },
};
