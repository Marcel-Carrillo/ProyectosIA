import {
  SupplierIntegrationRepository,
} from '../supplierIntegrationRepository';

const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../prismaClient', () => ({
  prisma: {
    supplierIntegration: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

const dbRow = {
  id: 1,
  supplierId: 10,
  provider: 'Spocket',
  status: 'Disconnected',
  externalAccountRef: null,
  lastVerifiedAt: null,
  lastSyncedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('SupplierIntegrationRepository', () => {
  let repo: SupplierIntegrationRepository;

  beforeEach(() => {
    repo = new SupplierIntegrationRepository();
    jest.clearAllMocks();
  });

  describe('findBySupplierId', () => {
    it('should_return_integration_when_found', async () => {
      mockFindUnique.mockResolvedValue(dbRow);

      const result = await repo.findBySupplierId(10);

      expect(result?.supplierId).toBe(10);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { supplierId: 10 } });
    });

    it('should_return_null_when_not_found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await repo.findBySupplierId(999);

      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('should_report_created_true_when_createdAt_equals_updatedAt', async () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      mockUpsert.mockResolvedValue({ ...dbRow, createdAt: now, updatedAt: now });

      const result = await repo.upsert(10, { externalAccountRef: 'acc-1' });

      expect(result.created).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith({
        where: { supplierId: 10 },
        update: { externalAccountRef: 'acc-1' },
        create: {
          supplierId: 10,
          provider: 'Spocket',
          status: 'Disconnected',
          externalAccountRef: 'acc-1',
        },
      });
    });

    it('should_report_created_false_when_updatedAt_is_after_createdAt', async () => {
      mockUpsert.mockResolvedValue({
        ...dbRow,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        externalAccountRef: 'acc-2',
      });

      const result = await repo.upsert(10, { externalAccountRef: 'acc-2' });

      expect(result.created).toBe(false);
    });

    it('should_use_a_single_atomic_upsert_call_not_findUnique_plus_create_or_update', async () => {
      mockUpsert.mockResolvedValue(dbRow);

      await repo.upsert(10, { externalAccountRef: null });

      expect(mockFindUnique).not.toHaveBeenCalled();
      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateStatus', () => {
    it('should_update_status_and_lastVerifiedAt', async () => {
      const verifiedAt = new Date('2026-02-01');
      mockUpdate.mockResolvedValue({ ...dbRow, status: 'Connected', lastVerifiedAt: verifiedAt });

      const result = await repo.updateStatus(1, { status: 'Connected', lastVerifiedAt: verifiedAt });

      expect(result.status).toBe('Connected');
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'Connected', lastVerifiedAt: verifiedAt },
      });
    });
  });

  describe('updateLastSyncedAt', () => {
    it('should_update_lastSyncedAt_only', async () => {
      const syncedAt = new Date('2026-03-01');
      mockUpdate.mockResolvedValue({ ...dbRow, lastSyncedAt: syncedAt });

      const result = await repo.updateLastSyncedAt(1, syncedAt);

      expect(result.lastSyncedAt).toEqual(syncedAt);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { lastSyncedAt: syncedAt },
      });
    });
  });
});
