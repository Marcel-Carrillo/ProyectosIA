import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import { SupplierFeedProduct, SupplierFeedSource } from '../external/supplierFeedTypes';
import { generateSlug, mapSupplierFeedProduct, MappedSupplierFeedProduct } from './mapSupplierFeedProduct';

// suppliersUpserted/categoriesUpserted: count of distinct names touched in this run
// (create or update both count). productsCreated: count of Product rows newly
// inserted (re-imports that hit the update branch do not increment it).
// variantsCreated: total variant rows written this run (the update branch always
// deletes-then-recreates variants, mirroring escuelaJsProductImporter.ts).
export interface ImportSupplierFeedResult {
  suppliersUpserted: number;
  categoriesUpserted: number;
  productsCreated: number;
  variantsCreated: number;
  imagesCreated: 0;
}

// --- Fixture read + validation (runs BEFORE any Prisma call, so a malformed
// fixture leaves the database untouched — see supplier-feed-sample-import spec.md
// "Fixture is malformed" scenario). ---

function assertIsSupplierFeedProduct(raw: unknown, index: number): asserts raw is SupplierFeedProduct {
  const p = raw as Partial<SupplierFeedProduct> | null;
  if (!p || typeof p !== 'object') {
    throw new Error(`Supplier feed fixture: entry at index ${index} is not an object`);
  }
  if (!p.title?.trim()) {
    throw new Error(`Supplier feed fixture: entry at index ${index} is missing "title"`);
  }
  if (!p.category?.trim()) {
    throw new Error(`Supplier feed fixture: entry at index ${index} is missing "category"`);
  }
  if (!p.supplier?.name?.trim()) {
    throw new Error(`Supplier feed fixture: entry at index ${index} is missing "supplier.name"`);
  }
  if (!Array.isArray(p.variants) || p.variants.length === 0) {
    throw new Error(`Supplier feed fixture: entry at index ${index} must have at least one variant`);
  }
  for (const [variantIndex, variant] of p.variants.entries()) {
    if (!variant.sku?.trim()) {
      throw new Error(`Supplier feed fixture: entry ${index}, variant ${variantIndex} is missing "sku"`);
    }
    if (!Number.isFinite(variant.publicPrice) || variant.publicPrice <= 0) {
      throw new Error(
        `Supplier feed fixture: entry ${index}, variant ${variantIndex} has an invalid "publicPrice"`,
      );
    }
  }
}

export function readSupplierFeedFixture(sourcePath: string = SupplierFeedSource): SupplierFeedProduct[] {
  let raw: string;
  try {
    raw = fs.readFileSync(sourcePath, 'utf-8');
  } catch {
    throw new Error(`Supplier feed fixture not found at ${sourcePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Supplier feed fixture at ${sourcePath} is not valid JSON`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Supplier feed fixture at ${sourcePath} must be a JSON array`);
  }

  parsed.forEach((entry, index) => assertIsSupplierFeedProduct(entry, index));
  const products = parsed as SupplierFeedProduct[];

  assertNoDuplicateSkusOrSlugs(products, sourcePath);
  return products;
}

// Guards against a duplicate SKU or generated slug across fixture entries,
// which would otherwise throw a raw Prisma unique-constraint error mid-import
// — after cleanLocalCatalog has already run inside the same transaction, this
// still rolls back cleanly, but validating up front gives a clearer error.
function assertNoDuplicateSkusOrSlugs(products: SupplierFeedProduct[], sourcePath: string): void {
  const seenSkus = new Set<string>();
  const seenSlugs = new Set<string>();

  for (const product of products) {
    const slug = generateSlug(product.title);
    if (seenSlugs.has(slug)) {
      throw new Error(
        `Supplier feed fixture at ${sourcePath} has a duplicate product title/slug: "${product.title}" (slug "${slug}")`,
      );
    }
    seenSlugs.add(slug);

    for (const variant of product.variants) {
      const sku = variant.sku.trim();
      if (seenSkus.has(sku)) {
        throw new Error(`Supplier feed fixture at ${sourcePath} has a duplicate variant SKU: "${sku}"`);
      }
      seenSkus.add(sku);
    }
  }
}

// --- Clean step ---

// Full FK-safe cascade for a local dev reset, per design.md decision 4 (revised):
// the local database's ProductVariant rows are referenced by order/shipment/return/
// refund/wishlist history, so a real reset must clear all of it, in the order each
// table's foreign keys require. Category, Supplier (both upserted fresh by the
// importer), AdminUser, CustomerAccount/Customer, and Coupon definitions are
// preserved so admin/customer login and coupon codes keep working locally.
export async function cleanLocalCatalog(prisma: Prisma.TransactionClient): Promise<void> {
  await prisma.stripeWebhookEvent.deleteMany({});
  await prisma.couponRedemption.deleteMany({});
  await prisma.refund.deleteMany({});
  await prisma.returnRequest.deleteMany({});
  await prisma.shipment.deleteMany({});
  await prisma.supplierOrderItem.deleteMany({});
  await prisma.supplierOrder.deleteMany({});
  await prisma.customerOrderItem.deleteMany({});
  await prisma.customerOrder.deleteMany({});
  await prisma.wishlistItem.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
}

// --- Upserts ---

async function upsertSupplier(prisma: Prisma.TransactionClient, name: string): Promise<{ id: number }> {
  // Supplier.name has no unique constraint in schema.prisma (unlike Category.name),
  // so a native prisma.supplier.upsert({ where: { name } }) is not available here.
  const existing = await prisma.supplier.findFirst({ where: { name } });
  if (existing) {
    if (existing.status !== 'Active') {
      await prisma.supplier.update({ where: { id: existing.id }, data: { status: 'Active' } });
    }
    return { id: existing.id };
  }
  const created = await prisma.supplier.create({ data: { name, status: 'Active' } });
  return { id: created.id };
}

async function upsertCategory(prisma: Prisma.TransactionClient, name: string): Promise<{ id: number }> {
  const category = await prisma.category.upsert({
    where: { name },
    update: { status: 'Active' },
    create: { name, status: 'Active' },
  });
  return { id: category.id };
}

async function upsertImportedProduct(
  prisma: Prisma.TransactionClient,
  mapped: MappedSupplierFeedProduct,
  categoryId: number,
  supplierId: number,
): Promise<{ created: boolean; variantsCreated: number }> {
  const variantsData = mapped.variants.map((v) => ({ ...v, supplierId }));

  const existing = await prisma.product.findUnique({ where: { slug: mapped.slug }, select: { id: true } });

  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: {
        name: mapped.name,
        description: mapped.description,
        brand: mapped.brand,
        status: mapped.status,
        mainImageUrl: mapped.mainImageUrl,
        categoryId,
        deletedAt: null,
      },
    });
    // ProductImage is never touched here, even on update: this importer must
    // guarantee zero ProductImage writes, and cleanLocalCatalog already clears
    // the table before every real script run.
    await prisma.productVariant.deleteMany({ where: { productId: existing.id } });
    await prisma.productVariant.createMany({
      data: variantsData.map((v) => ({ productId: existing.id, ...v })),
    });
    return { created: false, variantsCreated: variantsData.length };
  }

  await prisma.product.create({
    data: {
      name: mapped.name,
      slug: mapped.slug,
      description: mapped.description,
      brand: mapped.brand,
      status: mapped.status,
      mainImageUrl: mapped.mainImageUrl,
      categoryId,
      variants: { create: variantsData },
    },
  });
  return { created: true, variantsCreated: variantsData.length };
}

export async function importSupplierFeedProducts(
  prisma: Prisma.TransactionClient,
  products: SupplierFeedProduct[],
): Promise<ImportSupplierFeedResult> {
  const suppliersSeen = new Set<string>();
  const categoriesSeen = new Set<string>();
  let productsCreated = 0;
  let variantsCreated = 0;

  for (const product of products) {
    const mapped = mapSupplierFeedProduct(product);

    const supplier = await upsertSupplier(prisma, mapped.supplierName);
    suppliersSeen.add(mapped.supplierName);

    const category = await upsertCategory(prisma, mapped.categoryName);
    categoriesSeen.add(mapped.categoryName);

    const result = await upsertImportedProduct(prisma, mapped, category.id, supplier.id);
    if (result.created) productsCreated += 1;
    variantsCreated += result.variantsCreated;
  }

  return {
    suppliersUpserted: suppliersSeen.size,
    categoriesUpserted: categoriesSeen.size,
    productsCreated,
    variantsCreated,
    imagesCreated: 0,
  };
}
