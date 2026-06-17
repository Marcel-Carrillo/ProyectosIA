import { EscuelaJsProduct } from '../external/escuelaJsTypes';

export interface MappedProductImport {
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  status: 'Active';
  mainImageUrl: string | null;
  categoryName: string;
  categoryDescription: string | null;
  categoryImageUrl: string | null;
  variant: {
    sku: string;
    publicPrice: number;
    stockPolicy: 'SupplierManaged';
    status: 'Active';
  };
  images: { url: string; altText: string | null; sortOrder: number }[];
}

export function isImportableEscuelaJsProduct(product: EscuelaJsProduct): boolean {
  const title = product.title.trim().toLowerCase();
  const slug = product.slug.trim().toLowerCase();
  const categoryName = product.category?.name?.trim().toLowerCase() ?? '';

  if (!title || !slug) return false;
  if (title.startsWith('test_') || slug.startsWith('test-')) return false;
  if (categoryName.startsWith('test_')) return false;
  if (!Array.isArray(product.images) || product.images.length === 0) return false;
  if (!Number.isFinite(product.price) || product.price <= 0) return false;

  return true;
}

export function mapEscuelaJsProduct(product: EscuelaJsProduct): MappedProductImport {
  const mainImageUrl = product.images[0] ?? null;

  return {
    name: product.title.trim(),
    slug: product.slug.trim(),
    description: product.description?.trim() || null,
    brand: null,
    status: 'Active',
    mainImageUrl,
    categoryName: product.category.name.trim(),
    categoryDescription: null,
    categoryImageUrl: product.category.image?.trim() || null,
    variant: {
      sku: `EJS-${product.id}`,
      publicPrice: product.price,
      stockPolicy: 'SupplierManaged',
      status: 'Active',
    },
    images: product.images.map((url, index) => ({
      url: url.trim(),
      altText: `${product.title.trim()} image ${index + 1}`,
      sortOrder: index,
    })),
  };
}
