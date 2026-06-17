export { Product } from './product';
export type { ProductStatus } from './product';
export { ProductVariant } from './productVariant';
export type { ProductVariantStatus, StockPolicy } from './productVariant';
export { ProductImage } from './productImage';
export { Supplier } from './supplier';
export type { SupplierStatus } from './supplier';

export class Category {
  id?: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  status: 'Active' | 'Inactive';
  parentId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    status?: string;
    parentId?: number | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description ?? null;
    this.imageUrl = data.imageUrl ?? null;
    this.status = (data.status as 'Active' | 'Inactive') ?? 'Active';
    this.parentId = data.parentId ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  activate(): void {
    this.status = 'Active';
  }

  deactivate(): void {
    this.status = 'Inactive';
  }
}
