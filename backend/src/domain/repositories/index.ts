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
}
