import axios from 'axios';
import { getCustomerAccessToken } from './customerAuthService';

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';

function authHeaders() {
  const token = getCustomerAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listWishlist() {
  const res = await axios.get<{ data: { items: unknown[] } }>(
    `${API_BASE}/api/public/account/wishlist`,
    { headers: authHeaders() }
  );
  return res.data.data.items;
}

export async function addToWishlist(productVariantId: number) {
  const res = await axios.post(`${API_BASE}/api/public/account/wishlist`, { productVariantId }, {
    headers: authHeaders(),
  });
  return res.data.data;
}

export async function removeFromWishlist(productVariantId: number) {
  await axios.delete(`${API_BASE}/api/public/account/wishlist/${productVariantId}`, {
    headers: authHeaders(),
  });
}
