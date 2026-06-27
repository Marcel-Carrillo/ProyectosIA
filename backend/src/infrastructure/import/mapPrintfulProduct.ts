import {
  CatalogProductDetail,
  CatalogVariant,
  SyncProductDetail,
  SyncVariant,
  VariantOption,
} from '../external/printfulTypes';

export interface MappedPrintfulProductVariant {
  sku: string;
  size: string | null;
  color: string | null;
  publicPrice: number;
  supplierCost: number;
  supplierReference: string;
  stockPolicy: 'SupplierManaged';
  status: 'Active';
}

export interface MappedPrintfulProductImport {
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  status: 'Active';
  mainImageUrl: string | null;
  categoryName: string;
  categoryDescription: string | null;
  categoryImageUrl: string | null;
  variants: MappedPrintfulProductVariant[];
  images: { url: string; altText: string | null; sortOrder: number }[];
}

function toSlug(name: string): string {
  return (
    'pf-' +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

function extractOption(options: VariantOption[], id: string): string | null {
  const match = options.find((o) => o.id.toUpperCase() === id.toUpperCase());
  return match?.value ?? null;
}

function roundToTwoDP(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isImportablePrintfulSyncProduct(syncVariants: SyncVariant[]): boolean {
  return syncVariants.some((v) => !v.is_ignored && parseFloat(v.retail_price) > 0);
}

export function mapPrintfulProduct(
  syncProduct: SyncProductDetail,
  syncVariants: SyncVariant[],
  markup: number,
): MappedPrintfulProductImport {
  const importableVariants = syncVariants.filter(
    (v) => !v.is_ignored && parseFloat(v.retail_price) > 0,
  );

  const mappedVariants: MappedPrintfulProductVariant[] = importableVariants.map((v) => {
    const supplierCost = parseFloat(v.retail_price);
    return {
      sku: `PF-${v.id}`,
      size: extractOption(v.options, 'SIZE'),
      color: extractOption(v.options, 'COLOR'),
      supplierCost,
      publicPrice: roundToTwoDP(supplierCost * markup),
      supplierReference: String(v.id),
      stockPolicy: 'SupplierManaged',
      status: 'Active',
    };
  });

  const previewFile = importableVariants
    .flatMap((v) => v.files)
    .find((f) => f.type === 'preview' && f.preview_url !== null);
  const mainImageUrl = previewFile?.preview_url ?? syncProduct.thumbnail_url ?? null;

  const seenUrls = new Set<string>();
  const images: MappedPrintfulProductImport['images'] = [];
  let sortOrder = 0;
  for (const v of importableVariants) {
    for (const f of v.files) {
      if (f.preview_url && !seenUrls.has(f.preview_url)) {
        seenUrls.add(f.preview_url);
        images.push({
          url: f.preview_url,
          altText: `${syncProduct.name} preview`,
          sortOrder: sortOrder++,
        });
      }
    }
  }

  const firstVariant = importableVariants[0];
  const categoryName = firstVariant?.product?.type?.trim() || 'Apparel';

  return {
    name: syncProduct.name,
    slug: toSlug(syncProduct.name),
    description: null,
    brand: null,
    status: 'Active',
    mainImageUrl,
    categoryName,
    categoryDescription: null,
    categoryImageUrl: null,
    variants: mappedVariants,
    images,
  };
}

// ── Catalog API mapper ────────────────────────────────────────────────────────
// Maps GET /products/{id} (no store required) to the same MappedPrintfulProductImport
// shape. SKUs use the PF-CAT- prefix to distinguish from store sync variants.

export function isImportableCatalogProduct(catalogVariants: CatalogVariant[]): boolean {
  return catalogVariants.some((v) => v.in_stock && parseFloat(v.price) > 0);
}

export function mapCatalogProduct(
  catalogProduct: CatalogProductDetail,
  catalogVariants: CatalogVariant[],
  markup: number,
): MappedPrintfulProductImport {
  const importableVariants = catalogVariants.filter(
    (v) => v.in_stock && parseFloat(v.price) > 0,
  );

  const mappedVariants: MappedPrintfulProductVariant[] = importableVariants.map((v) => {
    const supplierCost = parseFloat(v.price);
    return {
      sku: `PF-CAT-${v.id}`,
      size: v.size ?? null,
      color: v.color ?? null,
      supplierCost,
      publicPrice: roundToTwoDP(supplierCost * markup),
      supplierReference: String(v.id),
      stockPolicy: 'SupplierManaged',
      status: 'Active',
    };
  });

  const seenUrls = new Set<string>();
  const images: MappedPrintfulProductImport['images'] = [];
  let sortOrder = 0;
  for (const v of importableVariants) {
    if (v.image && !seenUrls.has(v.image)) {
      seenUrls.add(v.image);
      images.push({
        url: v.image,
        altText: `${catalogProduct.title} — ${v.color ?? ''} ${v.size ?? ''}`.trim(),
        sortOrder: sortOrder++,
      });
    }
  }

  const categoryName = catalogProduct.type_name?.trim() || catalogProduct.type || 'Apparel';
  const slug = `pf-cat-${catalogProduct.id}-${toSlug(catalogProduct.title).replace(/^pf-/, '')}`;

  return {
    name: catalogProduct.title,
    slug,
    description: null,
    brand: catalogProduct.brand ?? null,
    status: 'Active',
    mainImageUrl: catalogProduct.image ?? null,
    categoryName,
    categoryDescription: null,
    categoryImageUrl: null,
    variants: mappedVariants,
    images,
  };
}
