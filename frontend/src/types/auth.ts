export interface AdminUser {
  id: number;
  email: string;
  status: 'Active' | 'Disabled';
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerAccount {
  id: number;
  customerId: number;
  email: string;
  authProvider: 'local' | 'google' | 'apple' | 'facebook';
  status: string;
  totpEnabled: boolean;
  lastLoginAt?: string | null;
}

export interface CustomerProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
}

export interface AuthApiError {
  success: false;
  error: { code: string; message: string };
}

export interface CartLineItem {
  productVariantId: number;
  quantity: number;
  productName: string;
  size?: string | null;
  color?: string | null;
  publicPrice: string;
  imageUrl?: string | null;
}

export interface PublicOrder {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  currency: string;
  items: Array<{
    productNameSnapshot: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }>;
}
