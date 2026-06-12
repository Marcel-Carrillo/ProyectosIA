import { Product } from '../models/product';
import { ProductVariant } from '../models/productVariant';
import { ProductImage } from '../models/productImage';

export interface ProductCreateData {
  name: string;
  slug: string;
  description?: string | null;
  brand?: string | null;
  status?: string;
  mainImageUrl?: string | null;
  categoryId?: number | null;
}

export interface ProductUpdateData {
  name?: string;
  slug?: string;
  description?: string | null;
  brand?: string | null;
  status?: string;
  mainImageUrl?: string | null;
  categoryId?: number | null;
}

export interface ProductListFilters {
  status?: string;
  categoryId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ProductListResult {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IProductRepository {
  findAll(filters?: ProductListFilters): Promise<ProductListResult>;
  findById(id: number): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  create(data: ProductCreateData): Promise<Product>;
  update(id: number, data: ProductUpdateData): Promise<Product>;
  softDelete(id: number): Promise<void>;
}

export interface ProductVariantCreateData {
  productId: number;
  sku: string;
  size?: string | null;
  color?: string | null;
  publicPrice: number;
  compareAtPrice?: number | null;
  supplierId?: number | null;
  supplierReference?: string | null;
  supplierCost?: number | null;
  stockPolicy: string;
  status?: string;
}

export interface ProductVariantUpdateData {
  sku?: string;
  size?: string | null;
  color?: string | null;
  publicPrice?: number;
  compareAtPrice?: number | null;
  supplierId?: number | null;
  supplierReference?: string | null;
  supplierCost?: number | null;
  stockPolicy?: string;
  status?: string;
}

export interface IProductVariantRepository {
  findByProduct(productId: number): Promise<ProductVariant[]>;
  findById(id: number): Promise<ProductVariant | null>;
  findBySku(sku: string): Promise<ProductVariant | null>;
  countActiveByProduct(productId: number): Promise<number>;
  create(data: ProductVariantCreateData): Promise<ProductVariant>;
  update(id: number, data: ProductVariantUpdateData): Promise<ProductVariant>;
  softDelete(id: number): Promise<ProductVariant>;
}

export interface ProductImageCreateData {
  productId: number;
  url: string;
  altText?: string | null;
  sortOrder?: number;
}

export interface ProductImageUpdateData {
  url?: string;
  altText?: string | null;
  sortOrder?: number;
}

export interface IProductImageRepository {
  findByProduct(productId: number): Promise<ProductImage[]>;
  findById(id: number): Promise<ProductImage | null>;
  create(data: ProductImageCreateData): Promise<ProductImage>;
  update(id: number, data: ProductImageUpdateData): Promise<ProductImage>;
  remove(id: number): Promise<void>;
}
