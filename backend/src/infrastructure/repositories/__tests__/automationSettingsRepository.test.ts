import { AutomationSettingsRepository } from '../automationSettingsRepository';

const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../prismaClient', () => ({
  prisma: {
    automationSettings: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

const dbRow = {
  id: 1,
  targetMargin: { toString: () => '5.00' },
  defaultFreightDestinationCountry: 'ES',
  carrierAllowList: [] as string[],
};

describe('AutomationSettingsRepository', () => {
  let repo: AutomationSettingsRepository;

  beforeEach(() => {
    repo = new AutomationSettingsRepository();
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should_return_the_existing_row_when_one_exists', async () => {
      mockFindFirst.mockResolvedValue(dbRow);
      const result = await repo.get();
      expect(result).toEqual({ id: 1, targetMargin: 5, defaultFreightDestinationCountry: 'ES', carrierAllowList: [] });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should_lazily_create_the_singleton_row_with_defaults_when_none_exists', async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue(dbRow);
      const result = await repo.get();
      expect(mockCreate).toHaveBeenCalledWith({ data: {} });
      expect(result.id).toBe(1);
    });
  });

  describe('update', () => {
    it('should_update_only_provided_fields', async () => {
      mockFindFirst.mockResolvedValue(dbRow);
      mockUpdate.mockResolvedValue({ ...dbRow, targetMargin: { toString: () => '8.00' } });

      const result = await repo.update({ targetMargin: 8 });

      expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { targetMargin: 8 } });
      expect(result.targetMargin).toBe(8);
    });
  });
});
