import { CustomerOrderRepository } from '../customerOrderRepository';

const mockQueryRaw = jest.fn();

jest.mock('../../prismaClient', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

describe('CustomerOrderRepository.generateNextOrderNumber', () => {
  const repo = new CustomerOrderRepository();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ORD-000001 when no ORD-* orders exist', async () => {
    mockQueryRaw.mockResolvedValue([{ max_num: null }]);
    await expect(repo.generateNextOrderNumber()).resolves.toBe('ORD-000001');
  });

  it('increments from the highest ORD-* number regardless of latest row id', async () => {
    mockQueryRaw.mockResolvedValue([{ max_num: 29 }]);
    await expect(repo.generateNextOrderNumber()).resolves.toBe('ORD-000030');
  });
});
