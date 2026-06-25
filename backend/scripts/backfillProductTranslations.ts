/**
 * Backfill ProductTranslation rows from existing Product data.
 *
 * For each product that has no EN translation, copies Product.name + Product.description
 * into a translation row with source='import'.
 *
 * Run with: npx ts-node scripts/backfillProductTranslations.ts
 *
 * Optional: set LIBRETRANSLATE_URL env var to auto-translate EN→ES (e.g. http://localhost:5000).
 * If LIBRETRANSLATE_URL is not set, the script skips the ES translation step.
 */
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const LIBRETRANSLATE_URL = process.env['LIBRETRANSLATE_URL'];

async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  if (!LIBRETRANSLATE_URL) return null;
  try {
    const res = await axios.post<{ translatedText: string }>(`${LIBRETRANSLATE_URL}/translate`, {
      q: text,
      source: sourceLang,
      target: targetLang,
      format: 'text',
    });
    return res.data.translatedText;
  } catch {
    console.warn(`[backfill] Translation failed for "${text.slice(0, 40)}..."`);
    return null;
  }
}

async function main() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { translations: true },
  });

  console.log(`[backfill] Processing ${products.length} products...`);
  let enCreated = 0;
  let esCreated = 0;

  for (const product of products) {
    const hasEn = product.translations.some((t) => t.locale === 'en');
    const hasEs = product.translations.some((t) => t.locale === 'es');

    if (!hasEn) {
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: product.id, locale: 'en' } },
        create: {
          productId: product.id,
          locale: 'en',
          name: product.name,
          description: product.description,
          source: 'import',
        },
        update: {},
      });
      enCreated++;
      console.log(`[backfill] EN created for product ${product.id}: "${product.name}"`);
    }

    if (!hasEs && LIBRETRANSLATE_URL) {
      const nameEs = await translateText(product.name, 'en', 'es');
      const descriptionEs = product.description
        ? await translateText(product.description, 'en', 'es')
        : null;

      if (nameEs) {
        await prisma.productTranslation.upsert({
          where: { productId_locale: { productId: product.id, locale: 'es' } },
          create: {
            productId: product.id,
            locale: 'es',
            name: nameEs,
            description: descriptionEs,
            source: 'machine',
          },
          update: {},
        });
        esCreated++;
        console.log(`[backfill] ES created for product ${product.id}: "${nameEs}"`);
      }
    }
  }

  console.log(`[backfill] Done. EN created: ${enCreated}, ES created: ${esCreated}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
