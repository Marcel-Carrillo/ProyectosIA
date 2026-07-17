import { Product } from '../models/product';
import { ProductVariant } from '../models/productVariant';
import { ProductImage } from '../models/productImage';

export interface ProductCreateData {
  name: string;
  slug: string;
  description?: string | null;
  brand?: string | null;
  gtin?: string | null;
  status?: string;
  mainImageUrl?: string | null;
  categoryId?: number | null;
}

export interface ProductUpdateData {
  name?: string;
  slug?: string;
  description?: string | null;
  brand?: string | null;
  gtin?: string | null;
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
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
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
  // Internal-only, admin-maintenance use (CJ category backfill). Atomic
  // conditional reassignment: only writes if the product's categoryId is
  // STILL `fromCategoryId` at the moment of the write, not just when read
  // earlier — this is what makes the backfill idempotent and safe against a
  // concurrent admin manually re-categorizing the same product. Returns
  // false (no-op) if the product no longer matches.
  reassignCategoryIfCurrentlyCategory(
    productId: number,
    fromCategoryId: number,
    toCategoryId: number
  ): Promise<boolean>;
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
  cjCatalogItemId?: number | null;
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
  findByCjCatalogItemId(cjCatalogItemId: number): Promise<ProductVariant | null>;
  countActiveByProduct(productId: number): Promise<number>;
  create(data: ProductVariantCreateData): Promise<ProductVariant>;
  update(id: number, data: ProductVariantUpdateData): Promise<ProductVariant>;
  softDelete(id: number): Promise<ProductVariant>;
  // Narrow, response-DTO-invisible: never merged into adminVariantSelect, so
  // cjCatalogItemId cannot leak into any variant API response (see
  // productVariantRepository.ts comments on the internal-only convention).
  findCjCatalogItemId(id: number): Promise<number | null>;
  updateShippingCostEstimate(id: number, shippingCostEstimate: number): Promise<ProductVariant>;
  // Internal-only, admin-maintenance use (CJ category backfill). Returns
  // every non-deleted variant belonging to up to `limit` non-deleted Products
  // currently in `categoryId` (bounded — NOT every matching product; a
  // production incident showed an unbounded version times out the `app`
  // Lambda's 6s default timeout when thousands of products share the
  // fallback category), with each variant's cjCatalogItemId — deliberately
  // bypasses the customer-safe variantSelect the same way findCjCatalogItemId
  // does.
  findManyByProductCategoryId(
    categoryId: number,
    limit: number
  ): Promise<{ productId: number; variantId: number; cjCatalogItemId: number | null }[]>;
}

export interface ProductImageCreateData {
  productId: number;
  url: string;
  altText?: string | null;
  sortOrder?: number;
  color?: string | null;
}

export interface ProductImageUpdateData {
  url?: string;
  altText?: string | null;
  sortOrder?: number;
  color?: string | null;
}

export interface IProductImageRepository {
  findByProduct(productId: number): Promise<ProductImage[]>;
  findById(id: number): Promise<ProductImage | null>;
  create(data: ProductImageCreateData): Promise<ProductImage>;
  update(id: number, data: ProductImageUpdateData): Promise<ProductImage>;
  remove(id: number): Promise<void>;
}
