import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { CjCatalogItem } from '../../domain/models/cjCatalogItem';
import {
  ICjCatalogItemRepository,
  CjCatalogItemUpsertInput,
  CjCatalogItemListFilters,
  CjCatalogItemListResult,
  CjCatalogItemListItem,
  CjPromotionState,
} from '../../domain/repositories/cjCatalogItemRepository';

// A newly-promoted Product defaults to Draft unless `activate: true` was
// requested (matching this codebase's existing pattern of Draft products
// with Active variants — see ProductService.create()). Draft products are
// never served by any /api/public/* route, so "Active" here must require
// BOTH the variant AND its parent Product to be Active — checking the
// variant alone would misreport a promoted-but-not-yet-activated item as
// live on the storefront.
function derivePromotionState(promotedVariant: { status: string; product: { status: string } } | null): CjPromotionState {
  if (!promotedVariant) return 'NotPromoted';
  return promotedVariant.status === 'Active' && promotedVariant.product.status === 'Active' ? 'Active' : 'Inactive';
}

function promotionStateWhere(
  promotionState: CjPromotionState
): Pick<Prisma.CjCatalogItemWhereInput, 'promotedVariant'> {
  switch (promotionState) {
    case 'NotPromoted':
      return { promotedVariant: null };
    case 'Active':
      return { promotedVariant: { is: { status: 'Active', product: { status: 'Active' } } } };
    case 'Inactive':
      return {
        promotedVariant: {
          is: { OR: [{ status: { not: 'Active' } }, { product: { status: { not: 'Active' } } }] },
        },
      };
  }
}

// DB-only work (no external API calls inside the transaction), so it is safe
// to raise this well above Prisma's 5000ms interactive-transaction default —
// unlike the reverted advisory-lock transaction in supplierAutoProvisionService,
// which spanned external CJ API calls and could leave a Lambda-frozen
// transaction open indefinitely. A large catalog sync window (hundreds of
// sequential upserts) can legitimately exceed 5s; see
// cjCatalogPromotionService.ts's PROMOTE_TRANSACTION_OPTIONS for the sibling
// fix of the same bug class.
const UPSERT_MANY_TRANSACTION_OPTIONS = { timeout: 120_000 };

export class CjCatalogItemRepository implements ICjCatalogItemRepository {
  async upsertMany(
    supplierIntegrationId: number,
    items: CjCatalogItemUpsertInput[]
  ): Promise<{ upserted: number }> {
    // Sequential upserts inside a single transaction: Prisma has no native
    // "upsertMany", and each row's unique key is (supplierIntegrationId, externalRef).
    // Sequential (not Promise.all) avoids opening more concurrent connections
    // than the pool allows during a large catalog sync.
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const data = {
          pid: item.pid ?? null,
          vid: item.vid ?? null,
          sku: item.sku ?? null,
          categoryId: item.categoryId ?? null,
          title: item.title,
          size: item.size ?? null,
          color: item.color ?? null,
          supplierCost: item.supplierCost,
          sellPrice: item.sellPrice ?? null,
          stockQuantity: item.stockQuantity,
          warehouseInventoryNum: item.warehouseInventoryNum ?? null,
          rawPayload: item.rawPayload as Prisma.InputJsonValue,
          syncStatus: item.syncStatus,
          syncError: item.syncError ?? null,
          lastSyncedAt: item.lastSyncedAt,
        };
        await tx.cjCatalogItem.upsert({
          where: {
            supplierIntegrationId_externalRef: {
              supplierIntegrationId,
              externalRef: item.externalRef,
            },
          },
          update: data,
          create: { supplierIntegrationId, externalRef: item.externalRef, ...data },
        });
      }
    }, UPSERT_MANY_TRANSACTION_OPTIONS);
    return { upserted: items.length };
  }

  async reconcilePromotedVariantStock(
    supplierIntegrationId: number
  ): Promise<{ deactivated: number; reactivated: number }> {
    // Only flips Active <-> OutOfStock. Inactive/Archived are admin decisions
    // this sync must never override; soft-deleted variants are skipped.
    const [deactivated, reactivated] = await prisma.$transaction([
      prisma.productVariant.updateMany({
        where: {
          status: 'Active',
          deletedAt: null,
          cjCatalogItem: { supplierIntegrationId, stockQuantity: { lte: 0 } },
        },
        data: { status: 'OutOfStock' },
      }),
      prisma.productVariant.updateMany({
        where: {
          status: 'OutOfStock',
          deletedAt: null,
          cjCatalogItem: { supplierIntegrationId, stockQuantity: { gt: 0 } },
        },
        data: { status: 'Active' },
      }),
    ]);
    return { deactivated: deactivated.count, reactivated: reactivated.count };
  }

  async findBySupplierIntegrationId(
    supplierIntegrationId: number,
    filters: CjCatalogItemListFilters = {}
  ): Promise<CjCatalogItemListResult> {
    const page = filters.page && filters.page >= 1 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize >= 1 ? filters.pageSize : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CjCatalogItemWhereInput = { supplierIntegrationId };
    if (filters.syncStatus) where.syncStatus = filters.syncStatus;
    if (filters.promotionState) Object.assign(where, promotionStateWhere(filters.promotionState));

    const [rows, total] = await prisma.$transaction([
      prisma.cjCatalogItem.findMany({
        where,
        include: {
          promotedVariant: { select: { id: true, productId: true, status: true, product: { select: { status: true } } } },
        },
        // Secondary sort key is required, not cosmetic: every item from one
        // syncCatalog batch shares the same createdAt (upsertMany runs in a
        // single transaction), so createdAt alone is not a stable order
        // across pages — without a tiebreaker, offset pagination over tied
        // rows can skip or repeat items between calls.
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      }),
      prisma.cjCatalogItem.count({ where }),
    ]);

    const items: CjCatalogItemListItem[] = rows.map((r) => {
      const { promotedVariant, ...itemFields } = r;
      return {
        item: new CjCatalogItem({
          ...itemFields,
          supplierCost: itemFields.supplierCost.toString(),
          sellPrice: itemFields.sellPrice?.toString() ?? null,
        }),
        promotionState: derivePromotionState(promotedVariant),
        productId: promotedVariant?.productId ?? null,
        productVariantId: promotedVariant?.id ?? null,
      };
    });

    return { items, total, page, pageSize };
  }

  async findByExternalRef(supplierIntegrationId: number, externalRef: string): Promise<CjCatalogItem | null> {
    const row = await prisma.cjCatalogItem.findUnique({
      where: { supplierIntegrationId_externalRef: { supplierIntegrationId, externalRef } },
    });
    return row
      ? new CjCatalogItem({ ...row, supplierCost: row.supplierCost.toString(), sellPrice: row.sellPrice?.toString() ?? null })
      : null;
  }

  async findById(id: number): Promise<CjCatalogItem | null> {
    const row = await prisma.cjCatalogItem.findUnique({ where: { id } });
    return row
      ? new CjCatalogItem({ ...row, supplierCost: row.supplierCost.toString(), sellPrice: row.sellPrice?.toString() ?? null })
      : null;
  }

  async findManyByIds(ids: number[]): Promise<CjCatalogItem[]> {
    if (ids.length === 0) return [];
    const rows = await prisma.cjCatalogItem.findMany({ where: { id: { in: ids } } });
    return rows.map(
      (row) =>
        new CjCatalogItem({ ...row, supplierCost: row.supplierCost.toString(), sellPrice: row.sellPrice?.toString() ?? null })
    );
  }
}
