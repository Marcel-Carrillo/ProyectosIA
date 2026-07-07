import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { CjCatalogItem } from '../../domain/models/cjCatalogItem';
import {
  ICjCatalogItemRepository,
  CjCatalogItemUpsertInput,
  CjCatalogItemListFilters,
  CjCatalogItemListResult,
} from '../../domain/repositories/cjCatalogItemRepository';

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

    const [rows, total] = await prisma.$transaction([
      prisma.cjCatalogItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.cjCatalogItem.count({ where }),
    ]);

    return {
      items: rows.map(
        (r) =>
          new CjCatalogItem({
            ...r,
            supplierCost: r.supplierCost.toString(),
            sellPrice: r.sellPrice?.toString() ?? null,
          })
      ),
      total,
      page,
      pageSize,
    };
  }

  async findByExternalRef(supplierIntegrationId: number, externalRef: string): Promise<CjCatalogItem | null> {
    const row = await prisma.cjCatalogItem.findUnique({
      where: { supplierIntegrationId_externalRef: { supplierIntegrationId, externalRef } },
    });
    return row
      ? new CjCatalogItem({ ...row, supplierCost: row.supplierCost.toString(), sellPrice: row.sellPrice?.toString() ?? null })
      : null;
  }
}
