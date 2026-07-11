import axios, { AxiosError } from 'axios';
import {
  CjConnectionResponse,
  CjConfigureConnectionRequest,
  CjVerifyResponse,
  CjSyncResponse,
  CjConnectionApiError,
} from '../types/cjConnection';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const cjBase = (supplierId: number) => `${API_BASE_URL}/api/admin/suppliers/${supplierId}/cj`;

// ─── Error-code → UI-message mapping ─────────────────────────────────────────

export function mapCjConnectionError(code: string, httpStatus?: number): string {
  // express-rate-limit's default 429 response has no app error-code body (it's
  // plain text, not `{ error: { code } }`), so 429 must be detected via HTTP
  // status, checked before the code switch.
  if (httpStatus === 429) {
    return 'Too many verification attempts. Please wait a few minutes and try again.';
  }
  switch (code) {
    case 'CJ_CONNECTION_NOT_FOUND':
      return 'No CJ Dropshipping connection is configured for this supplier yet.';
    case 'CJ_CONNECTION_NOT_READY':
      return 'The CJ Dropshipping connection is not ready. Verify the connection first.';
    case 'VALIDATION_ERROR':
      return 'Please check the form fields and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export function extractCjConnectionErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<CjConnectionApiError>;
  const httpStatus = axiosError.response?.status;
  const code = axiosError.response?.data?.error?.code;
  return mapCjConnectionError(code ?? '', httpStatus);
}

export function extractCjConnectionErrorCode(error: unknown): string {
  return (error as AxiosError<CjConnectionApiError>).response?.data?.error?.code ?? '';
}

// ─── Admin CJ connection lifecycle ───────────────────────────────────────────
// Security invariant: `externalAccountRef` is the only writable/readable
// connection field from this file — never send or read a credential/API-key.

export const cjConnectionService = {
  getConnection: async (supplierId: number): Promise<CjConnectionResponse> => {
    try {
      const response = await axios.get<CjConnectionResponse>(`${cjBase(supplierId)}/connection`);
      return response.data;
    } catch (error) {
      console.error('Error fetching CJ connection:', error);
      throw error;
    }
  },

  configureConnection: async (
    supplierId: number,
    payload: CjConfigureConnectionRequest
  ): Promise<CjConnectionResponse> => {
    try {
      const response = await axios.post<CjConnectionResponse>(`${cjBase(supplierId)}/connection`, payload);
      return response.data;
    } catch (error) {
      console.error('Error configuring CJ connection:', error);
      throw error;
    }
  },

  verifyConnection: async (supplierId: number): Promise<CjVerifyResponse> => {
    try {
      const response = await axios.post<CjVerifyResponse>(`${cjBase(supplierId)}/connection/verify`);
      return response.data;
    } catch (error) {
      console.error('Error verifying CJ connection:', error);
      throw error;
    }
  },

  sync: async (supplierId: number): Promise<CjSyncResponse> => {
    try {
      const response = await axios.post<CjSyncResponse>(`${cjBase(supplierId)}/sync`);
      return response.data;
    } catch (error) {
      console.error('Error syncing CJ catalog:', error);
      throw error;
    }
  },
};
