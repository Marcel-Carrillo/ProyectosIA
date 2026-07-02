import { SupplierFeedProduct } from '../external/supplierFeedTypes';

export interface MappedSupplierFeedVariant {
  sku: string;
  size: string | null;
  color: string | null;
  publicPrice: number;
  stockPolicy: 'SupplierManaged';
  status: 'Active';
  supplierReference: string | null;
  supplierCost: number | null;
}

export interface MappedSupplierFeedProduct {
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  status: 'Draft';
  mainImageUrl: null;
  categoryName: string;
  supplierName: string;
  variants: MappedSupplierFeedVariant[];
}

export function generateSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 200);
}

// product.images is intentionally never read here: this importer must guarantee
// zero ProductImage rows, and product.supplier.reference is intentionally unused
// (Supplier has no generic "reference" column; only externalRef/supplierCost map
// onto ProductVariant's internal-only fields).
export function mapSupplierFeedProduct(product: SupplierFeedProduct): MappedSupplierFeedProduct {
  return {
    name: product.title.trim(),
    slug: generateSlug(product.title),
    description: product.description?.trim() || null,
    brand: product.brand?.trim() || null,
    status: 'Draft',
    mainImageUrl: null,
    categoryName: product.category.trim(),
    supplierName: product.supplier.name.trim(),
    variants: product.variants.map((v) => ({
      sku: v.sku.trim(),
      size: v.size?.trim() || null,
      color: v.color?.trim() || null,
      publicPrice: v.publicPrice,
      stockPolicy: 'SupplierManaged',
      status: 'Active',
      supplierReference: product.externalRef?.trim() || null,
      supplierCost: product.supplierCost ?? null,
    })),
  };
}
