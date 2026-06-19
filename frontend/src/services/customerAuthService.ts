import axios, { AxiosError } from 'axios';
import { CustomerAccount, CustomerProfile, AuthApiError } from '../types/auth';

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const AUTH_BASE = `${API_BASE}/api/public/auth`;

let customerAccessToken: string | null = null;

export function setCustomerAccessToken(token: string | null) {
  customerAccessToken = token;
}

export function getCustomerAccessToken() {
  return customerAccessToken;
}

function authHeaders() {
  return customerAccessToken ? { Authorization: `Bearer ${customerAccessToken}` } : {};
}

export async function customerRegister(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}) {
  const res = await axios.post<{
    data: { account: CustomerAccount; customer: CustomerProfile; accessToken: string };
  }>(`${AUTH_BASE}/register`, input, { withCredentials: true });
  customerAccessToken = res.data.data.accessToken;
  return res.data.data;
}

export async function customerLogin(email: string, password: string) {
  const res = await axios.post<{
    data:
      | { account: CustomerAccount; customer: CustomerProfile; accessToken: string }
      | { mfaRequired: true; mfaToken: string };
  }>(`${AUTH_BASE}/login`, { email, password }, { withCredentials: true });
  if ('mfaRequired' in res.data.data && res.data.data.mfaRequired) {
    return res.data.data;
  }
  customerAccessToken = (res.data.data as { accessToken: string }).accessToken;
  return res.data.data as { account: CustomerAccount; customer: CustomerProfile; accessToken: string };
}

export async function customerVerify2fa(mfaToken: string, code: string) {
  const res = await axios.post<{
    data: { account: CustomerAccount; customer: CustomerProfile; accessToken: string };
  }>(`${AUTH_BASE}/2fa/verify`, { mfaToken, code }, { withCredentials: true });
  customerAccessToken = res.data.data.accessToken;
  return res.data.data;
}

export async function customerLogout() {
  await axios.post(`${AUTH_BASE}/logout`, {}, { withCredentials: true, headers: authHeaders() });
  customerAccessToken = null;
}

export async function customerMe() {
  const res = await axios.get<{
    data: { account: CustomerAccount; customer: CustomerProfile };
  }>(`${AUTH_BASE}/me`, { withCredentials: true, headers: authHeaders() });
  return res.data.data;
}

export async function customerRefresh() {
  const res = await axios.post<{ data: { accessToken: string } }>(
    `${AUTH_BASE}/refresh`,
    {},
    { withCredentials: true }
  );
  customerAccessToken = res.data.data.accessToken;
  return customerAccessToken;
}

export async function forgotPassword(email: string) {
  await axios.post(`${AUTH_BASE}/forgot-password`, { email });
}

export async function resetPassword(token: string, password: string) {
  await axios.post(`${AUTH_BASE}/reset-password`, { token, password });
}

export async function getProfile() {
  const res = await axios.get<{ data: { customer: CustomerProfile } }>(
    `${API_BASE}/api/public/account/profile`,
    { headers: authHeaders() }
  );
  return res.data.data.customer;
}

export async function updateProfile(data: Partial<Pick<CustomerProfile, 'firstName' | 'lastName' | 'phone'>>) {
  const res = await axios.patch<{ data: { customer: CustomerProfile } }>(
    `${API_BASE}/api/public/account/profile`,
    data,
    { headers: authHeaders() }
  );
  return res.data.data.customer;
}

export async function listMyOrders() {
  const res = await axios.get<{ data: { items: unknown[] } }>(
    `${API_BASE}/api/public/account/orders`,
    { headers: authHeaders() }
  );
  return res.data.data.items;
}

export async function getMyOrder(id: number) {
  const res = await axios.get<{ data: unknown }>(
    `${API_BASE}/api/public/account/orders/${id}`,
    { headers: authHeaders() }
  );
  return res.data.data;
}

export function extractCustomerAuthError(error: unknown): string {
  const code = (error as AxiosError<AuthApiError>).response?.data?.error?.code;
  if (code === 'INVALID_CREDENTIALS') return 'Invalid email or password.';
  if (code === 'ACCOUNT_EMAIL_CONFLICT') return 'An account with this email already exists.';
  if (code === 'VALIDATION_ERROR') return 'Please check your input and try again.';
  return 'An unexpected error occurred.';
}
