import { SupplierService } from './supplierService';
import { CjConnectionService } from './cjConnectionService';
import { SupplierProviderDescriptor } from '../providers/providerRegistry';
import { prisma } from '../../infrastructure/prismaClient';
import { logger } from '../../infrastructure/logger';

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
      const acquired = await this.tryAcquireLock(descriptor.key);
      if (!acquired) {
        logger.warn('Supplier auto-provisioning skipped: advisory lock already held', { provider: descriptor.key });
        return { provider: descriptor.key, skipped: true, skipReason: 'LOCKED', provisioned: false };
      }

      try {
        const { supplierId, provisioned } = await this.ensureSupplierProvisioned(descriptor);
        const pipelineResult = await descriptor.runPipeline(supplierId);
        return { provider: descriptor.key, skipped: false, provisioned, ...pipelineResult };
      } finally {
        await this.releaseLock(descriptor.key);
      }
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

  // Lock acquire/release are two independent prisma.$queryRaw calls against
  // the module-level prisma singleton, NOT wrapped in an interactive
  // prisma.$transaction. An earlier version of this code pinned both calls
  // inside a single $transaction to guarantee they shared one physical
  // connection (Postgres advisory locks are session-scoped). That was
  // reverted after live production testing: AWS Lambda freezes the execution
  // environment's CPU immediately once the handler's promise resolves, and
  // this consistently left Prisma's interactive transaction connection in
  // Postgres as "idle in transaction" forever — the COMMIT/ROLLBACK never
  // actually completed server-side, permanently holding the advisory lock
  // and requiring a manual pg_terminate_backend to recover. That failure mode
  // is worse than the narrower risk being guarded against (acquire/release
  // landing on different pooled connections), which is bounded in practice —
  // this job runs once a day with a generous connection pool
  // (DATABASE_URL's connection_limit), and any stale session-held lock is
  // released as soon as that connection's Lambda container is recycled.
  private async tryAcquireLock(key: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(hashtext(${key})) AS locked
    `;
    return rows[0]?.locked === true;
  }

  private async releaseLock(key: string): Promise<void> {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${key}))`;
  }
}
