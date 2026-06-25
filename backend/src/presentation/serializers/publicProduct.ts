import { Product } from '../../domain/models/product';
import { ProductVariant } from '../../domain/models/productVariant';
import { ProductImage } from '../../domain/models/productImage';
import { resolveProductLocale } from '../../application/helpers/resolveProductLocale';

/**
 * Customer-safe Data Transfer Objects for the public catalog API.
 *
 * These serializers use an explicit ALLOW-LIST: only the fields listed below are
 * ever emitted. Supplier and internal fields (`supplierId`, `supplierReference`,
 * `supplierCost`, `deletedAt`, internal notes) are never copied, so a future
 * change to the underlying model cannot accidentally leak them to the storefront.
 */

export interface PublicVariantDTO {
  id?: number;
  sku: string;
  size: string | null;
  color: string | null;
  publicPrice: number;
  compareAtPrice: number | null;
  status: string;
}

export interface PublicProductImageDTO {
  id?: number;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface PublicProductDTO {
  id?: number;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  status: string;
  mainImageUrl: string | null;
  categoryId: number | null;
  variants: PublicVariantDTO[];
  images: PublicProductImageDTO[];
  createdAt?: Date;
  updatedAt?: Date;
}

function serializeVariant(variant: ProductVariant): PublicVariantDTO {
  return {
    id: variant.id,
    sku: variant.sku,
    size: variant.size ?? null,
    color: variant.color ?? null,
    publicPrice: variant.publicPrice,
    compareAtPrice: variant.compareAtPrice ?? null,
    status: variant.status,
  };
}

function serializeImage(image: ProductImage): PublicProductImageDTO {
  return {
    id: image.id,
    url: image.url,
    altText: image.altText ?? null,
    sortOrder: image.sortOrder,
  };
}

export function serializePublicProduct(product: Product, locale?: string | null): PublicProductDTO {
  const resolved = resolveProductLocale(product, locale);

  const variants = (product.variants ?? [])
    .filter((v) => v.status === 'Active')
    .map(serializeVariant);

  const images = (product.images ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(serializeImage);

  return {
    id: product.id,
    name: resolved.name,
    slug: product.slug,
    description: resolved.description,
    brand: product.brand ?? null,
    status: product.status,
    mainImageUrl: product.mainImageUrl ?? null,
    categoryId: product.categoryId ?? null,
    variants,
    images,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
