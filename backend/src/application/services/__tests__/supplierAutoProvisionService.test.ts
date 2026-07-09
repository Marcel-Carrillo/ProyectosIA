jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    supplier: { findFirst: jest.fn() },
    supplierIntegration: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from '../../../infrastructure/prismaClient';
import { SupplierAutoProvisionService } from '../supplierAutoProvisionService';
import { SupplierService } from '../supplierService';
import { CjConnectionService } from '../cjConnectionService';
import { Supplier } from '../../../domain/models/supplier';
import { SupplierProviderDescriptor } from '../../providers/providerRegistry';

const mockSupplierFindFirst = prisma.supplier.findFirst as jest.Mock;
const mockIntegrationFindFirst = prisma.supplierIntegration.findFirst as jest.Mock;
const mockQueryRaw = prisma.$queryRaw as unknown as jest.Mock;

function makeDescriptor(overrides: Partial<SupplierProviderDescriptor> = {}): jest.Mocked<SupplierProviderDescriptor> {
  return {
    key: 'CJDropshipping',
    isConfigured: jest.fn().mockReturnValue(true),
    defaultSupplierName: 'CJ Dropshipping',
    runPipeline: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<SupplierProviderDescriptor>;
}

describe('SupplierAutoProvisionService', () => {
  let mockSupplierServiceCreate: jest.Mock;
  let mockConfigureConnection: jest.Mock;
  let supplierService: SupplierService;
  let connectionService: CjConnectionService;
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, SUPPLIER_AUTO_PROVISION_ENABLED: 'true' };

    mockSupplierServiceCreate = jest.fn();
    mockConfigureConnection = jest.fn().mockResolvedValue({ integration: {}, created: true });
    supplierService = { create: mockSupplierServiceCreate } as unknown as SupplierService;
    connectionService = { configureConnection: mockConfigureConnection } as unknown as CjConnectionService;

    mockSupplierFindFirst.mockResolvedValue(null); // no orphan by default

    // Default: lock acquired, unlock succeeds.
    mockQueryRaw.mockImplementation((strings: TemplateStringsArray) => {
      const text = strings.join('');
      if (text.includes('pg_try_advisory_lock')) return Promise.resolve([{ locked: true }]);
      return Promise.resolve([]);
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('should_noop_when_kill_switch_is_disabled', async () => {
    process.env['SUPPLIER_AUTO_PROVISION_ENABLED'] = 'false';
    const descriptor = makeDescriptor();
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [descriptor]);

    const result = await service.run();

    expect(result).toEqual({ enabled: false, providers: [] });
    expect(mockIntegrationFindFirst).not.toHaveBeenCalled();
    expect(descriptor.runPipeline).not.toHaveBeenCalled();
  });

  it('should_skip_a_provider_that_is_not_configured', async () => {
    const descriptor = makeDescriptor({ isConfigured: jest.fn().mockReturnValue(false) });
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [descriptor]);

    const result = await service.run();

    expect(result.providers).toEqual([
      { provider: 'CJDropshipping', skipped: true, skipReason: 'NOT_CONFIGURED', provisioned: false },
    ]);
    expect(mockIntegrationFindFirst).not.toHaveBeenCalled();
  });

  it('should_auto_create_supplier_and_integration_when_none_exists', async () => {
    mockIntegrationFindFirst.mockResolvedValue(null);
    mockSupplierServiceCreate.mockResolvedValue(new Supplier({ id: 5, name: 'CJ Dropshipping', status: 'Active' }));
    const descriptor = makeDescriptor({
      runPipeline: jest.fn().mockResolvedValue({
        verifyHealthy: true,
        itemsUpserted: 3,
        itemsFailed: 0,
        variantsCreated: 3,
        alreadyPromoted: 0,
      }),
    });
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [descriptor]);

    const result = await service.run();

    expect(mockSupplierFindFirst).toHaveBeenCalledWith({ where: { name: 'CJ Dropshipping', cjIntegration: null } });
    expect(mockSupplierServiceCreate).toHaveBeenCalledWith({ name: 'CJ Dropshipping' });
    expect(mockConfigureConnection).toHaveBeenCalledWith(5, {});
    expect(descriptor.runPipeline).toHaveBeenCalledWith(5);
    expect(result.providers[0].provisioned).toBe(true);
  });

  it('should_reuse_an_orphaned_supplier_instead_of_creating_a_duplicate', async () => {
    // Simulates a prior run that created the Supplier but crashed before
    // configureConnection completed (two independent, non-transactional writes).
    mockIntegrationFindFirst.mockResolvedValue(null);
    mockSupplierFindFirst.mockResolvedValue({ id: 42, name: 'CJ Dropshipping' });
    const descriptor = makeDescriptor({
      runPipeline: jest
        .fn()
        .mockResolvedValue({ verifyHealthy: true, itemsUpserted: 0, itemsFailed: 0, variantsCreated: 0, alreadyPromoted: 0 }),
    });
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [descriptor]);

    const result = await service.run();

    expect(mockSupplierServiceCreate).not.toHaveBeenCalled();
    expect(mockConfigureConnection).toHaveBeenCalledWith(42, {});
    expect(descriptor.runPipeline).toHaveBeenCalledWith(42);
    expect(result.providers[0].provisioned).toBe(false);
  });

  it('should_reuse_an_existing_supplier_without_creating_a_duplicate', async () => {
    mockIntegrationFindFirst.mockResolvedValue({ id: 1, supplierId: 9, provider: 'CJDropshipping' });
    const descriptor = makeDescriptor({
      runPipeline: jest.fn().mockResolvedValue({
        verifyHealthy: true,
        itemsUpserted: 0,
        itemsFailed: 0,
        variantsCreated: 0,
        alreadyPromoted: 0,
      }),
    });
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [descriptor]);

    const result = await service.run();

    expect(mockSupplierFindFirst).not.toHaveBeenCalled();
    expect(mockSupplierServiceCreate).not.toHaveBeenCalled();
    expect(mockConfigureConnection).not.toHaveBeenCalled();
    expect(descriptor.runPipeline).toHaveBeenCalledWith(9);
    expect(result.providers[0].provisioned).toBe(false);
  });

  it('should_pass_through_an_unhealthy_verify_result_without_throwing', async () => {
    mockIntegrationFindFirst.mockResolvedValue({ id: 1, supplierId: 9, provider: 'CJDropshipping' });
    const descriptor = makeDescriptor({
      runPipeline: jest
        .fn()
        .mockResolvedValue({ verifyHealthy: false, itemsUpserted: 0, itemsFailed: 0, variantsCreated: 0, alreadyPromoted: 0 }),
    });
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [descriptor]);

    const result = await service.run();

    expect(result.providers[0].verifyHealthy).toBe(false);
  });

  it('should_pass_through_a_default_category_missing_result_while_keeping_sync_counts', async () => {
    mockIntegrationFindFirst.mockResolvedValue({ id: 1, supplierId: 9, provider: 'CJDropshipping' });
    const descriptor = makeDescriptor({
      runPipeline: jest.fn().mockResolvedValue({
        verifyHealthy: true,
        itemsUpserted: 5,
        itemsFailed: 0,
        variantsCreated: 0,
        alreadyPromoted: 0,
        promotionSkippedReason: 'DEFAULT_CATEGORY_MISSING',
      }),
    });
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [descriptor]);

    const result = await service.run();

    expect(result.providers[0]).toMatchObject({ itemsUpserted: 5, promotionSkippedReason: 'DEFAULT_CATEGORY_MISSING' });
  });

  it('should_run_the_full_pipeline_successfully_end_to_end', async () => {
    mockIntegrationFindFirst.mockResolvedValue(null);
    mockSupplierServiceCreate.mockResolvedValue(new Supplier({ id: 5, name: 'CJ Dropshipping', status: 'Active' }));
    const descriptor = makeDescriptor({
      runPipeline: jest.fn().mockResolvedValue({
        verifyHealthy: true,
        itemsUpserted: 10,
        itemsFailed: 1,
        variantsCreated: 8,
        alreadyPromoted: 2,
      }),
    });
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [descriptor]);

    const result = await service.run();

    expect(result.providers[0]).toEqual({
      provider: 'CJDropshipping',
      skipped: false,
      provisioned: true,
      verifyHealthy: true,
      itemsUpserted: 10,
      itemsFailed: 1,
      variantsCreated: 8,
      alreadyPromoted: 2,
    });
  });

  it('should_not_create_duplicate_records_on_a_second_run', async () => {
    mockIntegrationFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1, supplierId: 5, provider: 'CJDropshipping' });
    mockSupplierServiceCreate.mockResolvedValue(new Supplier({ id: 5, name: 'CJ Dropshipping', status: 'Active' }));
    const descriptor = makeDescriptor({
      runPipeline: jest
        .fn()
        .mockResolvedValue({ verifyHealthy: true, itemsUpserted: 1, itemsFailed: 0, variantsCreated: 1, alreadyPromoted: 0 }),
    });
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [descriptor]);

    await service.run();
    await service.run();

    expect(mockSupplierServiceCreate).toHaveBeenCalledTimes(1);
    expect(descriptor.runPipeline).toHaveBeenNthCalledWith(1, 5);
    expect(descriptor.runPipeline).toHaveBeenNthCalledWith(2, 5);
  });

  it('should_isolate_one_providers_failure_from_another', async () => {
    mockIntegrationFindFirst.mockResolvedValue({ id: 1, supplierId: 9, provider: 'X' });
    const failing = makeDescriptor({ key: 'ProviderA', runPipeline: jest.fn().mockRejectedValue(new Error('boom')) });
    const succeeding = makeDescriptor({
      key: 'ProviderB',
      runPipeline: jest
        .fn()
        .mockResolvedValue({ verifyHealthy: true, itemsUpserted: 1, itemsFailed: 0, variantsCreated: 1, alreadyPromoted: 0 }),
    });
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [failing, succeeding]);

    const result = await service.run();

    expect(result.providers[0].error).toBe('boom');
    expect(succeeding.runPipeline).toHaveBeenCalled();
    expect(result.providers[1].error).toBeUndefined();
  });

  it('should_isolate_one_providers_lock_acquisition_failure_from_another', async () => {
    // Regression guard: lock acquisition itself throwing (e.g. a DB blip) must
    // not abort the whole run() loop — it must be caught per-provider, exactly
    // like a pipeline failure, since the very purpose of the descriptor
    // registry is to let a second provider be added without new failure modes.
    mockIntegrationFindFirst.mockResolvedValue({ id: 1, supplierId: 9, provider: 'X' });
    const failing = makeDescriptor({ key: 'ProviderA' });
    const succeeding = makeDescriptor({
      key: 'ProviderB',
      runPipeline: jest
        .fn()
        .mockResolvedValue({ verifyHealthy: true, itemsUpserted: 1, itemsFailed: 0, variantsCreated: 1, alreadyPromoted: 0 }),
    });
    mockQueryRaw
      .mockImplementationOnce(() => Promise.reject(new Error('connection lost during lock acquisition')))
      .mockImplementation((strings: TemplateStringsArray) => {
        const text = strings.join('');
        if (text.includes('pg_try_advisory_lock')) return Promise.resolve([{ locked: true }]);
        return Promise.resolve([]);
      });
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [failing, succeeding]);

    const result = await service.run();

    expect(result.providers[0].error).toBe('connection lost during lock acquisition');
    expect(succeeding.runPipeline).toHaveBeenCalled();
    expect(result.providers[1].error).toBeUndefined();
  });

  it('should_skip_a_provider_when_its_advisory_lock_is_already_held', async () => {
    mockQueryRaw.mockResolvedValue([{ locked: false }]);
    const descriptor = makeDescriptor();
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [descriptor]);

    const result = await service.run();

    expect(descriptor.runPipeline).not.toHaveBeenCalled();
    expect(result.providers[0]).toEqual({
      provider: 'CJDropshipping',
      skipped: true,
      skipReason: 'LOCKED',
      provisioned: false,
    });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('should_release_the_lock_even_when_runPipeline_throws', async () => {
    mockIntegrationFindFirst.mockResolvedValue({ id: 1, supplierId: 9, provider: 'CJDropshipping' });
    const descriptor = makeDescriptor({ runPipeline: jest.fn().mockRejectedValue(new Error('pipeline error')) });
    const service = new SupplierAutoProvisionService(supplierService, connectionService, [descriptor]);

    await service.run();

    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });
});
