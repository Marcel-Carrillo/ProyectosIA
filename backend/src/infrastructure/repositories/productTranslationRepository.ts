import { prisma } from '../prismaClient';
import { ProductTranslation } from '../../domain/models/productTranslation';
import {
  IProductTranslationRepository,
  TranslationUpsertData,
} from '../../domain/repositories/productTranslationRepository';

export class TranslationNotFoundError extends Error {
  readonly code = 'TRANSLATION_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Translation not found for this product and locale');
    this.name = 'TranslationNotFoundError';
    Object.setPrototypeOf(this, TranslationNotFoundError.prototype);
  }
}

export class ProductTranslationRepository implements IProductTranslationRepository {
  async upsert(productId: number, locale: string, data: TranslationUpsertData): Promise<ProductTranslation> {
    const row = await prisma.productTranslation.upsert({
      where: { productId_locale: { productId, locale } },
      create: {
        productId,
        locale,
        name: data.name,
        description: data.description ?? null,
        source: data.source ?? 'manual',
      },
      update: {
        name: data.name,
        description: data.description ?? null,
        source: data.source ?? 'manual',
      },
    });
    return new ProductTranslation(row);
  }

  async findByProduct(productId: number): Promise<ProductTranslation[]> {
    const rows = await prisma.productTranslation.findMany({
      where: { productId },
      orderBy: { locale: 'asc' },
    });
    return rows.map((r) => new ProductTranslation(r));
  }

  async findByProductAndLocale(productId: number, locale: string): Promise<ProductTranslation | null> {
    const row = await prisma.productTranslation.findUnique({
      where: { productId_locale: { productId, locale } },
    });
    return row ? new ProductTranslation(row) : null;
  }

  async delete(productId: number, locale: string): Promise<void> {
    await prisma.productTranslation.delete({
      where: { productId_locale: { productId, locale } },
    });
  }
}
