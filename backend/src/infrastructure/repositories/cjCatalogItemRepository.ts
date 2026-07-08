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
    });
    return { upserted: items.length };
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
        orderBy: { createdAt: 'desc' },
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
