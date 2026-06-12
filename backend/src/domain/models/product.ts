import { ProductVariant } from './productVariant';
import { ProductImage } from './productImage';

export type ProductStatus = 'Draft' | 'Active' | 'Inactive' | 'Archived';

export class Product {
  id?: number;
  name: string;
  slug: string;
  description?: string | null;
  brand?: string | null;
  status: ProductStatus;
  mainImageUrl?: string | null;
  categoryId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  variants?: ProductVariant[];
  images?: ProductImage[];

  constructor(data: {
    id?: number;
    name: string;
    slug: string;
    description?: string | null;
    brand?: string | null;
    status?: string;
    mainImageUrl?: string | null;
    categoryId?: number | null;
    createdAt?: Date;
    updatedAt?: Date;
    variants?: ConstructorParameters<typeof ProductVariant>[0][];
    images?: ConstructorParameters<typeof ProductImage>[0][];
  }) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.description = data.description ?? null;
    this.brand = data.brand ?? null;
    this.status = (data.status as ProductStatus) ?? 'Draft';
    this.mainImageUrl = data.mainImageUrl ?? null;
    this.categoryId = data.categoryId ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    if (data.variants) {
      this.variants = data.variants.map((v) => new ProductVariant(v));
    }
    if (data.images) {
      this.images = data.images.map((i) => new ProductImage(i));
    }
  }
}
