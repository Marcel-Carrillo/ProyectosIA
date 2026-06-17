import { PrismaClient } from '@prisma/client';
import {
  ESCUELAJS_PRODUCTS_URL,
  EscuelaJsProduct,
} from '../external/escuelaJsTypes';
import {
  isImportableEscuelaJsProduct,
  mapEscuelaJsProduct,
  MappedProductImport,
} from './mapEscuelaJsProduct';

export interface ImportEscuelaJsOptions {
  apiUrl?: string;
  limit?: number;
}

export interface ImportEscuelaJsResult {
  fetched: number;
  imported: number;
  skipped: number;
}

export async function fetchEscuelaJsProducts(
  apiUrl = ESCUELAJS_PRODUCTS_URL,
): Promise<EscuelaJsProduct[]> {
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch EscuelaJS products: HTTP ${response.status}`);
  }

  const data = (await response.json()) as EscuelaJsProduct[];
  if (!Array.isArray(data)) {
    throw new Error('EscuelaJS products response is not an array');
  }

  return data;
}

async function upsertCategory(
  prisma: PrismaClient,
  mapped: MappedProductImport,
): Promise<number> {
  const category = await prisma.category.upsert({
    where: { name: mapped.categoryName },
    update: {
      imageUrl: mapped.categoryImageUrl,
      status: 'Active',
    },
    create: {
      name: mapped.categoryName,
      description: mapped.categoryDescription,
      imageUrl: mapped.categoryImageUrl,
      status: 'Active',
    },
  });

  return category.id;
}

async function upsertImportedProduct(
  prisma: PrismaClient,
  mapped: MappedProductImport,
  categoryId: number,
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

    await prisma.productVariant.create({
      data: {
        productId: existing.id,
        ...mapped.variant,
      },
    });

    await prisma.productImage.createMany({
      data: mapped.images.map((image) => ({
        productId: existing.id,
        ...image,
      })),
    });

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
        create: [mapped.variant],
      },
      images: {
        create: mapped.images,
      },
    },
  });
}

export async function importEscuelaJsProducts(
  prisma: PrismaClient,
  options: ImportEscuelaJsOptions = {},
): Promise<ImportEscuelaJsResult> {
  const products = await fetchEscuelaJsProducts(options.apiUrl);
  const limit = options.limit ?? products.length;
  const slice = products.slice(0, limit);

  let imported = 0;
  let skipped = 0;

  for (const product of slice) {
    if (!isImportableEscuelaJsProduct(product)) {
      skipped += 1;
      continue;
    }

    const mapped = mapEscuelaJsProduct(product);
    const categoryId = await upsertCategory(prisma, mapped);
    await upsertImportedProduct(prisma, mapped, categoryId);
    imported += 1;
  }

  return {
    fetched: slice.length,
    imported,
    skipped,
  };
}
