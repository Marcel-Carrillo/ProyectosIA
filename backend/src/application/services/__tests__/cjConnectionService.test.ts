import { SupplierIntegration } from '../../../domain/models/supplierIntegration';
import { ISupplierIntegrationRepository } from '../../../domain/repositories/supplierIntegrationRepository';
import { ICjClient } from '../../../infrastructure/external/cjTypes';

const mockSupplierFindUnique = jest.fn();

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    supplier: { findUnique: (...args: unknown[]) => mockSupplierFindUnique(...args) },
  },
}));

import { CjConnectionService } from '../cjConnectionService';
import { SupplierIntegrationNotFoundError } from '../../../infrastructure/repositories/supplierIntegrationRepository';
import { SupplierNotFoundError } from '../../../infrastructure/repositories/supplierRepository';

function makeIntegration(overrides: Partial<ConstructorParameters<typeof SupplierIntegration>[0]> = {}) {
  return new SupplierIntegration({
    id: 1,
    supplierId: 10,
    status: 'Disconnected',
    ...overrides,
  });
}

function makeMockCjClient(): jest.Mocked<ICjClient> {
  return {
    verifyConnection: jest.fn(),
    fetchCategories: jest.fn(),
    fetchCatalog: jest.fn(),
    fetchVariants: jest.fn(),
    calculateFreight: jest.fn(),
    createOrder: jest.fn(),
    getOrderDetail: jest.fn(),
  };
}

describe('CjConnectionService', () => {
  let mockRepo: jest.Mocked<ISupplierIntegrationRepository>;
  let mockCjClient: jest.Mocked<ICjClient>;
  let service: CjConnectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = {
      findBySupplierId: jest.fn(),
      upsert: jest.fn(),
      updateStatus: jest.fn(),
      updateLastSyncedAt: jest.fn(),
    };
    mockCjClient = makeMockCjClient();
    service = new CjConnectionService(mockRepo, mockCjClient);
  });

  describe('configureConnection', () => {
    it('should_create_connection_when_supplier_exists_and_no_connection_yet', async () => {
      mockSupplierFindUnique.mockResolvedValue({ id: 10, name: 'Acme' });
      mockRepo.upsert.mockResolvedValue({ integration: makeIntegration(), created: true });

      const result = await service.configureConnection(10, { externalAccountRef: 'acc-1' });

      expect(result.created).toBe(true);
      expect(mockRepo.upsert).toHaveBeenCalledWith(10, { externalAccountRef: 'acc-1' });
    });

    it('should_update_connection_when_one_already_exists', async () => {
      mockSupplierFindUnique.mockResolvedValue({ id: 10, name: 'Acme' });
      mockRepo.upsert.mockResolvedValue({ integration: makeIntegration(), created: false });

      const result = await service.configureConnection(10, { externalAccountRef: 'acc-2' });

      expect(result.created).toBe(false);
    });

    it('should_throw_supplier_not_found_when_supplier_does_not_exist', async () => {
      mockSupplierFindUnique.mockResolvedValue(null);

      await expect(
        service.configureConnection(999, { externalAccountRef: 'acc-1' })
      ).rejects.toBeInstanceOf(SupplierNotFoundError);
      expect(mockRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getConnection', () => {
    it('should_return_integration_when_found', async () => {
      mockRepo.findBySupplierId.mockResolvedValue(makeIntegration());

      const result = await service.getConnection(10);

      expect(result.supplierId).toBe(10);
    });

    it('should_throw_when_not_found', async () => {
      mockRepo.findBySupplierId.mockResolvedValue(null);

      await expect(service.getConnection(999)).rejects.toBeInstanceOf(SupplierIntegrationNotFoundError);
    });
  });

  describe('verifyConnection', () => {
    it('should_mark_connected_and_return_healthy_true_on_success', async () => {
      mockRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      mockCjClient.verifyConnection.mockResolvedValue({ healthy: true });

      const result = await service.verifyConnection(10);

      expect(result).toEqual({ healthy: true });
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'Connected' }));
    });

    it('should_mark_error_and_return_a_fixed_non_sensitive_reason_on_failure', async () => {
      mockRepo.findBySupplierId.mockResolvedValue(makeIntegration());
      mockCjClient.verifyConnection.mockResolvedValue({ healthy: false });

      const result = await service.verifyConnection(10);

      expect(result.healthy).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).not.toMatch(/cj_test|api[_-]?key|bearer|cj-access-token/i);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'Error' }));
    });

    it('should_throw_and_never_call_cj_client_when_connection_is_missing', async () => {
      mockRepo.findBySupplierId.mockResolvedValue(null);

      await expect(service.verifyConnection(999)).rejects.toBeInstanceOf(SupplierIntegrationNotFoundError);
      expect(mockCjClient.verifyConnection).not.toHaveBeenCalled();
    });
  });
});
