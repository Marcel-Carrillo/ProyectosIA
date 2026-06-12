export type ProductVariantStatus = 'Active' | 'Inactive' | 'OutOfStock' | 'Archived';
export type StockPolicy = 'SupplierManaged' | 'InternalStock' | 'Hybrid';

export class ProductVariant {
  id?: number;
  productId: number;
  sku: string;
  size?: string | null;
  color?: string | null;
  publicPrice: number;
  compareAtPrice?: number | null;
  stockPolicy: StockPolicy;
  status: ProductVariantStatus;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    productId: number;
    sku: string;
    size?: string | null;
    color?: string | null;
    publicPrice: unknown;
    compareAtPrice?: unknown;
    stockPolicy?: string;
    status?: string;
    deletedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.productId = data.productId;
    this.sku = data.sku;
    this.size = data.size ?? null;
    this.color = data.color ?? null;
    this.publicPrice = Number(data.publicPrice);
    this.compareAtPrice = data.compareAtPrice != null ? Number(data.compareAtPrice) : null;
    this.stockPolicy = (data.stockPolicy as StockPolicy) ?? 'SupplierManaged';
    this.status = (data.status as ProductVariantStatus) ?? 'Active';
    this.deletedAt = data.deletedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
