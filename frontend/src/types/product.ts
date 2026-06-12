export type ProductStatus = 'Draft' | 'Active' | 'Inactive' | 'Archived';
export type ProductVariantStatus = 'Active' | 'Inactive';
export type StockPolicy = 'TRACK' | 'DONT_TRACK' | 'DENY';

export interface ProductVariant {
  id: number;
  productId: number;
  sku: string;
  size: string | null;
  color: string | null;
  publicPrice: number;
  compareAtPrice: number | null;
  stockPolicy: StockPolicy;
  status: ProductVariantStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: number;
  productId: number;
  url: string;
  altText: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  status: ProductStatus;
  mainImageUrl: string | null;
  categoryId: number | null;
  variants?: ProductVariant[];
  images?: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResult {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductListResponse {
  success: boolean;
  data: ProductListResult;
  message: string;
}

export interface ProductResponse {
  success: boolean;
  data: Product;
  message: string;
}

export interface ProductQueryParams {
  status?: ProductStatus;
  categoryId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}
