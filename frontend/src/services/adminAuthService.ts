import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { AdminUser, AuthApiError } from '../types/auth';

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const AUTH_BASE = `${API_BASE}/api/admin/auth`;

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAdminAccessToken(token: string | null) {
  accessToken = token;
}

export function getAdminAccessToken() {
  return accessToken;
}

axios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && config.url?.includes('/api/admin/') && !config.url.includes('/api/admin/auth/login')) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config;
    if (!original || error.response?.status !== 401 || !original.url?.includes('/api/admin/')) {
      return Promise.reject(error);
    }
    if (original.url.includes('/api/admin/auth/')) {
      return Promise.reject(error);
    }
    if (!refreshPromise) {
      refreshPromise = axios
        .post<{ data: { accessToken: string } }>(`${AUTH_BASE}/refresh`, {}, { withCredentials: true })
        .then((res) => {
          accessToken = res.data.data.accessToken;
          return accessToken;
        })
        .catch(() => {
          accessToken = null;
          return null;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    const newToken = await refreshPromise;
    if (!newToken || !original.headers) return Promise.reject(error);
    original.headers.Authorization = `Bearer ${newToken}`;
    return axios(original);
  }
);

export async function adminLogin(email: string, password: string) {
  const res = await axios.post<{ data: { admin: AdminUser; accessToken: string } }>(
    `${AUTH_BASE}/login`,
    { email, password },
    { withCredentials: true }
  );
  accessToken = res.data.data.accessToken;
  return res.data.data;
}

export async function adminLogout() {
  await axios.post(`${AUTH_BASE}/logout`, {}, { withCredentials: true });
  accessToken = null;
}

export async function adminMe() {
  const res = await axios.get<{ data: { admin: AdminUser } }>(`${AUTH_BASE}/me`, { withCredentials: true });
  return res.data.data.admin;
}

export async function adminRefresh() {
  const res = await axios.post<{ data: { accessToken: string } }>(
    `${AUTH_BASE}/refresh`,
    {},
    { withCredentials: true }
  );
  accessToken = res.data.data.accessToken;
  return accessToken;
}

export function extractAuthError(error: unknown): string {
  const code = (error as AxiosError<AuthApiError>).response?.data?.error?.code;
  if (code === 'INVALID_CREDENTIALS') return 'Invalid email or password.';
  if (code === 'ADMIN_DISABLED') return 'This admin account is disabled.';
  return 'An unexpected error occurred.';
}
