import axios from 'axios';
import { getCustomerAccessToken } from './customerAuthService';

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';

export interface StripeConfig {
  publishableKey: string;
  mode: 'test' | 'live';
}

export async function getStripeConfig(): Promise<StripeConfig> {
  const res = await axios.get<{ data: StripeConfig }>(
    `${API_BASE}/api/public/payments/config`
  );
  return res.data.data;
}

export async function getOrderPaymentStatus(orderNumber: string): Promise<string | null> {
  const token = getCustomerAccessToken();
  if (!token) return null;
  const res = await axios.get<{
    data: { items: Array<{ orderNumber: string; paymentStatus: string }> };
  }>(`${API_BASE}/api/public/account/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    withCredentials: true,
  });
  const found = res.data.data.items.find((o) => o.orderNumber === orderNumber);
  return found?.paymentStatus ?? null;
}
