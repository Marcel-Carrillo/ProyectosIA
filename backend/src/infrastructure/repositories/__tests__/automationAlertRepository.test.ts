import { AutomationAlertRepository } from '../automationAlertRepository';

const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../prismaClient', () => ({
  prisma: {
    automationAlert: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const dbRow = {
  id: 1,
  type: 'CjPushFailed',
  customerOrderId: 10,
  supplierOrderId: 5,
  message: 'CJ API unavailable',
  resolvedAt: null,
  createdAt: new Date('2026-01-01'),
};

describe('AutomationAlertRepository', () => {
  let repo: AutomationAlertRepository;

  beforeEach(() => {
    repo = new AutomationAlertRepository();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should_persist_the_alert', async () => {
      mockCreate.mockResolvedValue(dbRow);

      const result = await repo.create({ type: 'CjPushFailed', customerOrderId: 10, supplierOrderId: 5, message: 'CJ API unavailable' });

      expect(result.id).toBe(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'CjPushFailed', customerOrderId: 10, supplierOrderId: 5 }),
        })
      );
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      // findMany()/count() are called to build the promises passed into the
      // $transaction([...]) array — they must resolve even though
      // mockTransaction itself is what actually supplies the final result.
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
    });

    it('should_default_to_unresolved_only', async () => {
      mockTransaction.mockResolvedValue([[dbRow], 1]);

      await repo.findAll();

      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { resolvedAt: null } }));
      expect(mockCount).toHaveBeenCalledWith({ where: { resolvedAt: null } });
    });

    it('should_return_all_alerts_when_resolvedOnly_is_explicitly_false', async () => {
      mockTransaction.mockResolvedValue([[dbRow], 1]);

      const result = await repo.findAll({ resolvedOnly: false });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('should_clamp_pageSize_to_100', async () => {
      mockTransaction.mockResolvedValue([[], 0]);

      const result = await repo.findAll({ pageSize: 500 });

      expect(result.pageSize).toBe(100);
    });
  });
});
