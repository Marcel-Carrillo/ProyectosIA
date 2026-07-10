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
  cjCatalogItemId?: number | null;
  // Supplier sourcing data — populated only when the variant was read through
  // an admin select. Public serializers allow-list their own fields, so these
  // never reach customer-facing responses.
  supplierId?: number | null;
  supplierReference?: string | null;
  supplierCost?: number | null;
  supplierName?: string | null;
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
    cjCatalogItemId?: number | null;
    supplierId?: number | null;
    supplierReference?: string | null;
    supplierCost?: unknown;
    supplier?: { name: string } | null;
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
    this.cjCatalogItemId = data.cjCatalogItemId ?? null;
    this.supplierId = data.supplierId ?? null;
    this.supplierReference = data.supplierReference ?? null;
    this.supplierCost = data.supplierCost != null ? Number(data.supplierCost) : null;
    this.supplierName = data.supplier?.name ?? null;
    this.deletedAt = data.deletedAt ?? null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
