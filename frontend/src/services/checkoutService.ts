import axios from 'axios';
import { getCustomerAccessToken } from './customerAuthService';
import { PublicOrder } from '../types/auth';

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';

export interface CheckoutPayload {
  items: Array<{ productVariantId: number; quantity: number }>;
  shippingAddressSnapshot: Record<string, string>;
  billingAddressSnapshot: Record<string, string>;
  shippingAmount?: string;
  couponCode?: string;
}

export async function validateCoupon(code: string, subtotalAmount: string) {
  const res = await axios.post<{ data: { valid: boolean; discountAmount?: string; reason?: string } }>(
    `${API_BASE}/api/public/coupons/validate`,
    { code, subtotalAmount }
  );
  return res.data.data;
}

export async function guestCheckout(payload: CheckoutPayload & {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}) {
  const res = await axios.post<{ data: PublicOrder }>(
    `${API_BASE}/api/public/checkout/guest`,
    payload,
    { withCredentials: true }
  );
  return res.data.data;
}

export async function authenticatedCheckout(payload: CheckoutPayload) {
  const token = getCustomerAccessToken();
  const res = await axios.post<{ data: PublicOrder }>(
    `${API_BASE}/api/public/checkout`,
    payload,
    {
      withCredentials: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  return res.data.data;
}
