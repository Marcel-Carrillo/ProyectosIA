import { ISupplierIntegrationRepository } from '../../domain/repositories/supplierIntegrationRepository';
import { ISpocketClient } from '../../infrastructure/external/spocketTypes';
import { SupplierIntegration } from '../../domain/models/supplierIntegration';
import { validateSpocketConnectionData } from '../validator';
import { SupplierIntegrationNotFoundError } from '../../infrastructure/repositories/supplierIntegrationRepository';
import { SupplierNotFoundError } from '../../infrastructure/repositories/supplierRepository';
import { prisma } from '../../infrastructure/prismaClient';
import { logger } from '../../infrastructure/logger';

export class SpocketConnectionService {
  constructor(
    private readonly repo: ISupplierIntegrationRepository,
    private readonly spocketClient: ISpocketClient
  ) {}

  async configureConnection(
    supplierId: number,
    data: Record<string, unknown>
  ): Promise<{ integration: SupplierIntegration; created: boolean }> {
    validateSpocketConnectionData(data);

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new SupplierNotFoundError();

    return this.repo.upsert(supplierId, {
      externalAccountRef: (data['externalAccountRef'] as string | null | undefined) ?? null,
    });
  }

  async getConnection(supplierId: number): Promise<SupplierIntegration> {
    const integration = await this.repo.findBySupplierId(supplierId);
    if (!integration) throw new SupplierIntegrationNotFoundError();
    return integration;
  }

  async verifyConnection(supplierId: number): Promise<{ healthy: boolean; reason?: string }> {
    const integration = await this.repo.findBySupplierId(supplierId);
    if (!integration || !integration.id) throw new SupplierIntegrationNotFoundError();

    const now = new Date();
    let result;
    try {
      result = await this.spocketClient.verifyConnection();
    } catch (err) {
      // Any unexpected client error (e.g. a malformed response body) is treated
      // the same as an unhealthy connection — the spec requires this endpoint to
      // always return 200 { healthy, reason }, never a 500.
      logger.warn('Spocket connection verification threw unexpectedly', {
        supplierId,
        errorName: err instanceof Error ? err.name : 'unknown',
      });
      result = { healthy: false as const };
    }

    if (result.healthy) {
      await this.repo.updateStatus(integration.id, { status: 'Connected', lastVerifiedAt: now });
      return { healthy: true };
    }

    await this.repo.updateStatus(integration.id, { status: 'Error', lastVerifiedAt: now });
    // Fixed, non-sensitive vocabulary only — never forward raw client/upstream text.
    logger.warn('Spocket connection verification failed', { supplierId });
    return { healthy: false, reason: 'Spocket rejected the configured credentials or is unreachable' };
  }
}
