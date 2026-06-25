import { ProductVariant } from './productVariant';
import { ProductImage } from './productImage';
import { ProductTranslation } from './productTranslation';

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
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  variants?: ProductVariant[];
  images?: ProductImage[];
  translations?: ProductTranslation[];

  constructor(data: {
    id?: number;
    name: string;
    slug: string;
    description?: string | null;
    brand?: string | null;
    status?: string;
    mainImageUrl?: string | null;
    categoryId?: number | null;
    deletedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    variants?: ConstructorParameters<typeof ProductVariant>[0][];
    images?: ConstructorParameters<typeof ProductImage>[0][];
    translations?: ConstructorParameters<typeof ProductTranslation>[0][];
  }) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.description = data.description ?? null;
    this.brand = data.brand ?? null;
    this.status = (data.status as ProductStatus) ?? 'Draft';
    this.mainImageUrl = data.mainImageUrl ?? null;
    this.categoryId = data.categoryId ?? null;
    this.deletedAt = data.deletedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    if (data.variants) {
      this.variants = data.variants.map((v) => new ProductVariant(v));
    }
    if (data.images) {
      this.images = data.images.map((i) => new ProductImage(i));
    }
    if (data.translations) {
      this.translations = data.translations.map((t) => new ProductTranslation(t));
    }
  }
}
