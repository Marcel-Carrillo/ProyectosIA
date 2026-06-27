import { PrismaClient } from '@prisma/client';
import {
  fetchCatalogProductDetail,
  fetchCatalogProductList,
  fetchSyncProductList,
  fetchSyncProductDetail,
} from '../external/printfulClient';
import {
  isImportablePrintfulSyncProduct,
  isImportableCatalogProduct,
  mapPrintfulProduct,
  mapCatalogProduct,
  MappedPrintfulProductImport,
} from './mapPrintfulProduct';

export interface ImportPrintfulOptions {
  limit?: number;
}

export interface ImportPrintfulResult {
  fetched: number;
  imported: number;
  skipped: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertPrintfulSupplier(prisma: PrismaClient): Promise<number> {
  const existing = await prisma.supplier.findFirst({ where: { name: 'Printful' } });
  if (existing) {
    await prisma.supplier.update({
      where: { id: existing.id },
      data: { website: 'https://www.printful.com', status: 'Active' },
    });
    return existing.id;
  }
  const created = await prisma.supplier.create({
    data: { name: 'Printful', website: 'https://www.printful.com', status: 'Active' },
  });
  return created.id;
}

async function upsertCategory(
  prisma: PrismaClient,
  mapped: MappedPrintfulProductImport,
): Promise<number> {
  const category = await prisma.category.upsert({
    where: { name: mapped.categoryName },
    update: { imageUrl: mapped.categoryImageUrl, status: 'Active' },
    create: {
      name: mapped.categoryName,
      description: mapped.categoryDescription,
      imageUrl: mapped.categoryImageUrl,
      status: 'Active',
    },
  });
  return category.id;
}

async function upsertPrintfulProduct(
  prisma: PrismaClient,
  mapped: MappedPrintfulProductImport,
  categoryId: number,
  supplierId: number,
): Promise<void> {
  const existing = await prisma.product.findUnique({
    where: { slug: mapped.slug },
    select: { id: true },
  });

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

    await prisma.productVariant.deleteMany({ where: { productId: existing.id } });
    await prisma.productImage.deleteMany({ where: { productId: existing.id } });

    await prisma.productVariant.createMany({
      data: mapped.variants.map((v) => ({ productId: existing.id, supplierId, ...v })),
    });

    if (mapped.images.length > 0) {
      await prisma.productImage.createMany({
        data: mapped.images.map((img) => ({ productId: existing.id, ...img })),
      });
    }

    return;
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
      variants: {
        create: mapped.variants.map((v) => ({ supplierId, ...v })),
      },
      images: {
        create: mapped.images,
      },
    },
  });
}

export async function importPrintfulProducts(
  prisma: PrismaClient,
  options: ImportPrintfulOptions = {},
): Promise<ImportPrintfulResult> {
  const markupRaw = parseFloat(process.env.PRINTFUL_PRICE_MARKUP ?? '');
  const markup = Number.isFinite(markupRaw) && markupRaw > 0 ? markupRaw : 1.6;
  if (!process.env.PRINTFUL_PRICE_MARKUP) {
    console.log('[printful] PRINTFUL_PRICE_MARKUP not set, using default 1.6');
  }

  const throttleMs = parseInt(process.env.PRINTFUL_THROTTLE_MS ?? '600', 10);
  const supplierId = await upsertPrintfulSupplier(prisma);

  const { limit } = options;
  const PAGE_SIZE = 20;
  let offset = 0;
  let fetched = 0;
  let imported = 0;
  let skipped = 0;

  while (true) {
    const pageLimit = limit ? Math.min(PAGE_SIZE, limit - fetched) : PAGE_SIZE;
    if (pageLimit <= 0) break;

    const { items, paging } = await fetchSyncProductList(offset, pageLimit);
    if (items.length === 0) break;

    for (const listItem of items) {
      if (limit !== undefined && fetched >= limit) break;

      await sleep(throttleMs);

      const { syncProduct, syncVariants } = await fetchSyncProductDetail(listItem.id);
      fetched += 1;

      if (!isImportablePrintfulSyncProduct(syncVariants)) {
        console.log(`[printful] skipped product ${listItem.id}: no importable variants`);
        skipped += 1;
        continue;
      }

      const mapped = mapPrintfulProduct(syncProduct, syncVariants, markup);
      const categoryId = await upsertCategory(prisma, mapped);
      await upsertPrintfulProduct(prisma, mapped, categoryId, supplierId);
      imported += 1;
    }

    if (offset + items.length >= paging.total) break;
    if (limit !== undefined && fetched >= limit) break;

    offset += items.length;
  }

  const result: ImportPrintfulResult = { fetched, imported, skipped };
  console.log('[printful] import result:', JSON.stringify(result));
  return result;
}

// ── Catalog import (no store required) ───────────────────────────────────────

export async function importPrintfulCatalogProducts(
  prisma: PrismaClient,
  options: ImportPrintfulOptions = {},
): Promise<ImportPrintfulResult> {
  const markupRaw = parseFloat(process.env.PRINTFUL_PRICE_MARKUP ?? '');
  const markup = Number.isFinite(markupRaw) && markupRaw > 0 ? markupRaw : 1.6;
  if (!process.env.PRINTFUL_PRICE_MARKUP) {
    console.log('[printful-catalog] PRINTFUL_PRICE_MARKUP not set, using default 1.6');
  }

  const throttleMs = parseInt(process.env.PRINTFUL_THROTTLE_MS ?? '600', 10);
  const supplierId = await upsertPrintfulSupplier(prisma);

  const { limit } = options;
  const PAGE_SIZE = 20;
  let offset = 0;
  let fetched = 0;
  let imported = 0;
  let skipped = 0;

  while (true) {
    const pageLimit = limit ? Math.min(PAGE_SIZE, limit - fetched) : PAGE_SIZE;
    if (pageLimit <= 0) break;

    const { items, paging } = await fetchCatalogProductList(offset, pageLimit);
    if (items.length === 0) break;

    for (const listItem of items) {
      if (limit !== undefined && fetched >= limit) break;

      await sleep(throttleMs);

      const { catalogProduct, catalogVariants } = await fetchCatalogProductDetail(listItem.id);
      fetched += 1;

      if (!isImportableCatalogProduct(catalogVariants)) {
        console.log(`[printful-catalog] skipped product ${listItem.id}: no importable variants`);
        skipped += 1;
        continue;
      }

      const mapped = mapCatalogProduct(catalogProduct, catalogVariants, markup);
      const categoryId = await upsertCategory(prisma, mapped);
      await upsertPrintfulProduct(prisma, mapped, categoryId, supplierId);
      imported += 1;
    }

    // /products endpoint returns all results without paging — stop after first batch
    if (!paging || offset + items.length >= paging.total) break;
    if (limit !== undefined && fetched >= limit) break;

    offset += items.length;
  }

  const result: ImportPrintfulResult = { fetched, imported, skipped };
  console.log('[printful-catalog] import result:', JSON.stringify(result));
  return result;
}
