import { SupplierService } from './supplierService';
import { CjConnectionService } from './cjConnectionService';
import { SupplierProviderDescriptor } from '../providers/providerRegistry';
import { prisma } from '../../infrastructure/prismaClient';
import { logger } from '../../infrastructure/logger';
import { Prisma } from '@prisma/client';

export type ProviderSkipReason = 'NOT_CONFIGURED' | 'LOCKED';

export interface ProviderRunOutcome {
  provider: string;
  skipped: boolean;
  skipReason?: ProviderSkipReason;
  provisioned: boolean;
  verifyHealthy?: boolean;
  itemsUpserted?: number;
  itemsFailed?: number;
  variantsCreated?: number;
  alreadyPromoted?: number;
  promotionSkippedReason?: 'DEFAULT_CATEGORY_MISSING' | 'PRICE_RESOLUTION_FAILED' | 'NO_PROMOTABLE_ITEMS';
  error?: string;
}

export interface SupplierAutoProvisionRunResult {
  enabled: boolean;
  providers: ProviderRunOutcome[];
}

// Advisory locks are session-scoped in Postgres: pg_try_advisory_lock and
// pg_advisory_unlock must run on the SAME physical connection, or the unlock
// silently no-ops and the lock is never released. Prisma's default pool does
// not guarantee that two independent $queryRaw calls share a connection, so
// the whole acquire -> critical section -> release span runs inside a single
// $transaction, which pins one connection for its entire duration. The large
// timeout accommodates the pipeline's external CJ API calls (pagination,
// rate-limit backoff) — this transaction is a connection-pinning device, not
// an atomicity boundary; ensureSupplierProvisioned/runPipeline's real writes
// still go through the module-level prisma singleton on their own connections.
const LOCK_TRANSACTION_TIMEOUT_MS = 890_000;
const LOCK_TRANSACTION_MAX_WAIT_MS = 10_000;

export class SupplierAutoProvisionService {
  constructor(
    private readonly supplierService: SupplierService,
    private readonly connectionService: CjConnectionService,
    private readonly registry: SupplierProviderDescriptor[]
  ) {}

  async run(): Promise<SupplierAutoProvisionRunResult> {
    if (process.env.SUPPLIER_AUTO_PROVISION_ENABLED !== 'true') {
      logger.info('Supplier auto-provisioning disabled via SUPPLIER_AUTO_PROVISION_ENABLED', {});
      return { enabled: false, providers: [] };
    }

    const providers: ProviderRunOutcome[] = [];
    for (const descriptor of this.registry) {
      providers.push(await this.runForProvider(descriptor));
    }

    logger.info('Supplier auto-provision run completed', { providers });
    return { enabled: true, providers };
  }

  private async runForProvider(descriptor: SupplierProviderDescriptor): Promise<ProviderRunOutcome> {
    if (!descriptor.isConfigured()) {
      logger.info('Supplier auto-provisioning skipped: provider not configured', { provider: descriptor.key });
      return { provider: descriptor.key, skipped: true, skipReason: 'NOT_CONFIGURED', provisioned: false };
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          const acquired = await this.tryAcquireLock(tx, descriptor.key);
          if (!acquired) {
            logger.warn('Supplier auto-provisioning skipped: advisory lock already held', { provider: descriptor.key });
            return { provider: descriptor.key, skipped: true, skipReason: 'LOCKED' as const, provisioned: false };
          }

          try {
            const { supplierId, provisioned } = await this.ensureSupplierProvisioned(descriptor);
            const pipelineResult = await descriptor.runPipeline(supplierId);
            return { provider: descriptor.key, skipped: false, provisioned, ...pipelineResult };
          } finally {
            await this.releaseLock(tx, descriptor.key);
          }
        },
        { timeout: LOCK_TRANSACTION_TIMEOUT_MS, maxWait: LOCK_TRANSACTION_MAX_WAIT_MS }
      );
    } catch (err) {
      logger.error('Supplier auto-provisioning failed for provider', {
        provider: descriptor.key,
        errorName: err instanceof Error ? err.name : 'unknown',
      });
      return {
        provider: descriptor.key,
        skipped: false,
        provisioned: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private async ensureSupplierProvisioned(
    descriptor: SupplierProviderDescriptor
  ): Promise<{ supplierId: number; provisioned: boolean }> {
    // No ISupplierIntegrationRepository method covers a provider-keyed lookup
    // (design.md D3 explicitly rejects a new Supplier.providerKey column).
    // Direct prisma access here mirrors the existing precedent in
    // CjConnectionService.configureConnection (prisma.supplier.findUnique).
    const existing = await prisma.supplierIntegration.findFirst({ where: { provider: descriptor.key } });
    if (existing) {
      return { supplierId: existing.supplierId, provisioned: false };
    }

    // supplierService.create() and connectionService.configureConnection()
    // are two independent, non-transactional writes across service
    // boundaries — a crash between them would otherwise leave an orphaned
    // Supplier that this findFirst-by-integration check alone can never
    // detect on retry, causing a duplicate Supplier every run. Reuse the
    // orphan by name instead of creating a new one.
    const orphan = await prisma.supplier.findFirst({
      where: { name: descriptor.defaultSupplierName, cjIntegration: null },
    });
    const supplierId = orphan ? orphan.id : ((await this.supplierService.create({ name: descriptor.defaultSupplierName })).id as number);

    await this.connectionService.configureConnection(supplierId, {});
    logger.info(orphan ? 'Reused orphaned Supplier missing its SupplierIntegration' : 'Auto-created Supplier and SupplierIntegration', {
      provider: descriptor.key,
      supplierId,
    });
    return { supplierId, provisioned: !orphan };
  }

  private async tryAcquireLock(tx: Prisma.TransactionClient, key: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(hashtext(${key})) AS locked
    `;
    return rows[0]?.locked === true;
  }

  private async releaseLock(tx: Prisma.TransactionClient, key: string): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_unlock(hashtext(${key}))`;
  }
}
