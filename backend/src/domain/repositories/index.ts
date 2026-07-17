export {
  IProductRepository,
  IProductVariantRepository,
  IProductImageRepository,
} from './productRepository';
export type {
  ProductCreateData,
  ProductUpdateData,
  ProductListFilters,
  ProductVariantCreateData,
  ProductVariantUpdateData,
  ProductImageCreateData,
  ProductImageUpdateData,
} from './productRepository';
export { IProductTranslationRepository } from './productTranslationRepository';
export type { TranslationUpsertData } from './productTranslationRepository';
export { ISupplierRepository } from './supplierRepository';
export type {
  SupplierCreateData,
  SupplierUpdateData,
  SupplierListFilters,
  SupplierListResult,
} from './supplierRepository';

import { Category } from '../models';

export interface CategoryCreateData {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  status?: string;
  parentId?: number | null;
}

export interface CategoryUpdateData {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  status?: string;
  parentId?: number | null;
}

export interface ICategoryRepository {
  findAll(includeInactive?: boolean): Promise<Category[]>;
  findById(id: number): Promise<Category | null>;
  findByName(name: string): Promise<Category | null>;
  create(data: CategoryCreateData): Promise<Category>;
  update(id: number, data: CategoryUpdateData): Promise<Category>;
  softDelete(id: number): Promise<Category>;
  // Resolves a supplier's own taxonomy id to a local Category, auto-creating
  // (Inactive by default) or reusing-by-name when no mapping exists yet.
  // Race-safe under concurrent callers (see cj-category-mapping design.md).
  findOrCreateByExternalRef(provider: string, externalCategoryId: string, name: string): Promise<Category>;
}
