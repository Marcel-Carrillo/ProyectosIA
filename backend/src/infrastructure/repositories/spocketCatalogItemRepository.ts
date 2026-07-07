import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { SpocketCatalogItem } from '../../domain/models/spocketCatalogItem';
import {
  ISpocketCatalogItemRepository,
  SpocketCatalogItemUpsertInput,
  SpocketCatalogItemListFilters,
  SpocketCatalogItemListResult,
} from '../../domain/repositories/spocketCatalogItemRepository';

export class SpocketCatalogItemRepository implements ISpocketCatalogItemRepository {
  async upsertMany(
    supplierIntegrationId: number,
    items: SpocketCatalogItemUpsertInput[]
  ): Promise<{ upserted: number }> {
    // Sequential upserts inside a single transaction: Prisma has no native
    // "upsertMany", and each row's unique key is (supplierIntegrationId, externalRef).
    // Sequential (not Promise.all) avoids opening more concurrent connections
    // than the pool allows during a large catalog sync.
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.spocketCatalogItem.upsert({
          where: {
            supplierIntegrationId_externalRef: {
              supplierIntegrationId,
              externalRef: item.externalRef,
            },
          },
          update: {
            title: item.title,
            size: item.size ?? null,
            color: item.color ?? null,
            supplierCost: item.supplierCost,
            stockQuantity: item.stockQuantity,
            rawPayload: item.rawPayload as Prisma.InputJsonValue,
            syncStatus: item.syncStatus,
            syncError: item.syncError ?? null,
            lastSyncedAt: item.lastSyncedAt,
          },
          create: {
            supplierIntegrationId,
            externalRef: item.externalRef,
            title: item.title,
            size: item.size ?? null,
            color: item.color ?? null,
            supplierCost: item.supplierCost,
            stockQuantity: item.stockQuantity,
            rawPayload: item.rawPayload as Prisma.InputJsonValue,
            syncStatus: item.syncStatus,
            syncError: item.syncError ?? null,
            lastSyncedAt: item.lastSyncedAt,
          },
        });
      }
    });
    return { upserted: items.length };
  }

  async findBySupplierIntegrationId(
    supplierIntegrationId: number,
    filters: SpocketCatalogItemListFilters = {}
  ): Promise<SpocketCatalogItemListResult> {
    const page = filters.page && filters.page >= 1 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize >= 1 ? filters.pageSize : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SpocketCatalogItemWhereInput = { supplierIntegrationId };
    if (filters.syncStatus) where.syncStatus = filters.syncStatus;

    const [rows, total] = await prisma.$transaction([
      prisma.spocketCatalogItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.spocketCatalogItem.count({ where }),
    ]);

    return {
      items: rows.map(
        (r) => new SpocketCatalogItem({ ...r, supplierCost: r.supplierCost.toString() })
      ),
      total,
      page,
      pageSize,
    };
  }
}
