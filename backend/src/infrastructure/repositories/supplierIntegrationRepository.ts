import { prisma } from '../prismaClient';
import { SupplierIntegration } from '../../domain/models/supplierIntegration';
import {
  ISupplierIntegrationRepository,
  SupplierIntegrationUpsertData,
} from '../../domain/repositories/supplierIntegrationRepository';

export class SupplierIntegrationNotFoundError extends Error {
  readonly code = 'SPOCKET_CONNECTION_NOT_FOUND' as const;
  readonly status = 404;

  constructor() {
    super('Spocket connection not found');
    this.name = 'SupplierIntegrationNotFoundError';
    Object.setPrototypeOf(this, SupplierIntegrationNotFoundError.prototype);
  }
}

export class SupplierIntegrationRepository implements ISupplierIntegrationRepository {
  async findBySupplierId(supplierId: number): Promise<SupplierIntegration | null> {
    const row = await prisma.supplierIntegration.findUnique({ where: { supplierId } });
    return row ? new SupplierIntegration(row) : null;
  }

  async upsert(
    supplierId: number,
    data: SupplierIntegrationUpsertData
  ): Promise<{ integration: SupplierIntegration; created: boolean }> {
    // A single atomic Prisma upsert (rather than findUnique + create/update)
    // avoids a race where two concurrent requests for the same supplier both
    // observe "no existing connection" and both attempt to create, tripping the
    // unique constraint on supplierId.
    const row = await prisma.supplierIntegration.upsert({
      where: { supplierId },
      update: { externalAccountRef: data.externalAccountRef ?? null },
      create: {
        supplierId,
        provider: 'Spocket',
        status: 'Disconnected',
        externalAccountRef: data.externalAccountRef ?? null,
      },
    });
    // Prisma's upsert does not report whether it created or updated; createdAt
    // and updatedAt are set to the same instant only on creation (updatedAt
    // always moves forward on a genuine update).
    const created = row.createdAt.getTime() === row.updatedAt.getTime();
    return { integration: new SupplierIntegration(row), created };
  }

  async updateStatus(
    id: number,
    data: { status: 'Connected' | 'Error'; lastVerifiedAt: Date }
  ): Promise<SupplierIntegration> {
    const row = await prisma.supplierIntegration.update({
      where: { id },
      data: { status: data.status, lastVerifiedAt: data.lastVerifiedAt },
    });
    return new SupplierIntegration(row);
  }

  async updateLastSyncedAt(id: number, lastSyncedAt: Date): Promise<SupplierIntegration> {
    const row = await prisma.supplierIntegration.update({
      where: { id },
      data: { lastSyncedAt },
    });
    return new SupplierIntegration(row);
  }
}
