import { Prisma } from '@prisma/client';
import {
  extractCjVariantAttributesFromRawPayload,
  VariantAttributes,
} from './cjVariantAttributeExtraction';
import { logger } from '../../infrastructure/logger';

export interface BackfillCandidateRow {
  cjCatalogItemId: number;
  productVariantId: number | null;
  productId: number | null;
  currentSize: string | null;
  currentColor: string | null;
  rawPayload: unknown;
}

export interface PlannedVariantAttributeUpdate {
  cjCatalogItemId: number;
  productVariantId: number | null;
  productId: number | null;
  size: string | null;
  color: string | null;
}

export interface PlanVariantAttributeUpdatesResult {
  updates: PlannedVariantAttributeUpdate[];
  skippedAmbiguous: number;
}

function attributePairKey(size: string | null, color: string | null): string | null {
  if (size === null || color === null) return null;
  return `${size}\0${color}`;
}

function attributesEqual(a: VariantAttributes, b: { size: string | null; color: string | null }): boolean {
  return a.size === b.size && a.color === b.color;
}

export function planVariantAttributeUpdates(rows: BackfillCandidateRow[]): PlanVariantAttributeUpdatesResult {
  const updates: PlannedVariantAttributeUpdate[] = [];
  let skippedAmbiguous = 0;

  const byProduct = new Map<number, BackfillCandidateRow[]>();
  const noProductRows: BackfillCandidateRow[] = [];

  for (const row of rows) {
    if (row.productId == null) {
      noProductRows.push(row);
      continue;
    }
    const list = byProduct.get(row.productId) ?? [];
    list.push(row);
    byProduct.set(row.productId, list);
  }

  for (const row of noProductRows) {
    const derived = extractCjVariantAttributesFromRawPayload(row.rawPayload);
    if (attributesEqual(derived, { size: row.currentSize, color: row.currentColor })) continue;
    updates.push({
      cjCatalogItemId: row.cjCatalogItemId,
      productVariantId: row.productVariantId,
      productId: row.productId,
      size: derived.size,
      color: derived.color,
    });
  }

  for (const [, productRows] of byProduct) {
    const reservedPairs = new Set<string>();
    for (const row of productRows) {
      const key = attributePairKey(row.currentSize, row.currentColor);
      if (key) reservedPairs.add(key);
    }

    for (const row of productRows) {
      const derived = extractCjVariantAttributesFromRawPayload(row.rawPayload);
      if (attributesEqual(derived, { size: row.currentSize, color: row.currentColor })) continue;

      const pairKey = attributePairKey(derived.size, derived.color);
      if (pairKey && reservedPairs.has(pairKey)) {
        skippedAmbiguous += 1;
        logger.warn('Skipping CJ variant attribute backfill due to sibling (size,color) collision', {
          cjCatalogItemId: row.cjCatalogItemId,
          productId: row.productId,
          size: derived.size,
          color: derived.color,
        });
        continue;
      }

      if (pairKey) reservedPairs.add(pairKey);
      updates.push({
        cjCatalogItemId: row.cjCatalogItemId,
        productVariantId: row.productVariantId,
        productId: row.productId,
        size: derived.size,
        color: derived.color,
      });
    }
  }

  return { updates, skippedAmbiguous };
}

export interface BackfillVariantAttributesResult {
  itemsUpdated: number;
  variantsUpdated: number;
}

// Bulk UPDATE ... FROM (VALUES ...) instead of one UPDATE per row: against a
// remote/production DB, thousands of sequential round trips inside a single
// transaction can exceed Prisma's transaction timeout and hold row locks far
// longer than necessary. This does 2 statements total per batch regardless
// of batch size.
export async function backfillVariantAttributes(
  client: Prisma.TransactionClient,
  planned: PlannedVariantAttributeUpdate[]
): Promise<BackfillVariantAttributesResult> {
  if (planned.length === 0) {
    return { itemsUpdated: 0, variantsUpdated: 0 };
  }

  const itemRows = Prisma.join(
    planned.map(
      (u) => Prisma.sql`(${u.cjCatalogItemId}::integer, ${u.size}::varchar(50), ${u.color}::varchar(50))`
    )
  );
  const itemsUpdated = await client.$executeRaw`
    UPDATE "CjCatalogItem" AS t
    SET size = v.size, color = v.color, "updatedAt" = now()
    FROM (VALUES ${itemRows}) AS v(id, size, color)
    WHERE t.id = v.id
  `;

  const variantPlanned = planned.filter((u) => u.productVariantId != null);
  let variantsUpdated = 0;
  if (variantPlanned.length > 0) {
    const variantRows = Prisma.join(
      variantPlanned.map(
        (u) =>
          Prisma.sql`(${u.productVariantId}::integer, ${u.size}::varchar(50), ${u.color}::varchar(50))`
      )
    );
    variantsUpdated = await client.$executeRaw`
      UPDATE "ProductVariant" AS t
      SET size = v.size, color = v.color, "updatedAt" = now()
      FROM (VALUES ${variantRows}) AS v(id, size, color)
      WHERE t.id = v.id
    `;
  }

  return { itemsUpdated, variantsUpdated };
}
