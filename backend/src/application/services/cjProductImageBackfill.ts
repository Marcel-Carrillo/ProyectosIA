import { Prisma } from '@prisma/client';
import { extractCjImages, planProductImages } from './cjImageExtraction';
import { setProductMainImage, createProductImageRecord } from './cjProductImageSync';

export interface EligibleVariantRow {
  productId: number;
  rawPayload: unknown;
  title: string;
}

export interface BackfillCandidate {
  productId: number;
  variants: EligibleVariantRow[];
}

export interface BackfillResult {
  imaged: boolean;
}

// Pure grouping — no I/O — fully unit-testable with hand-built fixtures.
export function groupVariantsByProduct(rows: EligibleVariantRow[]): BackfillCandidate[] {
  const byProduct = new Map<number, EligibleVariantRow[]>();
  for (const row of rows) {
    const list = byProduct.get(row.productId) ?? [];
    list.push(row);
    byProduct.set(row.productId, list);
  }
  return Array.from(byProduct.entries()).map(([productId, variants]) => ({ productId, variants }));
}

// Mirrors promote()'s new-product image logic (cjCatalogPromotionService.ts)
// via the same planProductImages helper — a product-level image (from any
// variant's rawPayload) wins as the main image; if none exists, the first
// variant-level image found becomes the main image instead.
export async function backfillProductImages(
  client: Prisma.TransactionClient,
  candidate: BackfillCandidate
): Promise<BackfillResult> {
  if (candidate.variants.length === 0) return { imaged: false };

  const plan = planProductImages(
    candidate.variants.map((v) => ({ ...extractCjImages(v.rawPayload), altText: v.title }))
  );
  if (plan.images.length === 0) return { imaged: false };

  if (plan.mainImageUrl) {
    await setProductMainImage(client, candidate.productId, plan.mainImageUrl);
  }
  for (let i = 0; i < plan.images.length; i++) {
    const image = plan.images[i]!;
    await createProductImageRecord(client, { productId: candidate.productId, url: image.url, altText: image.altText, sortOrder: i });
  }

  return { imaged: true };
}
