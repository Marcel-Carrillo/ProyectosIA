import { CustomerOrderRepository } from '../customerOrderRepository';

const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../prismaClient', () => ({
  prisma: {
    customerOrder: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

describe('CustomerOrderRepository.findAll date filters', () => {
  const repo = new CustomerOrderRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockTransaction.mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    });
  });

  it('applies createdFrom and createdTo UTC day bounds', async () => {
    await repo.findAll({ createdFrom: '2026-06-01', createdTo: '2026-06-30' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lte: new Date('2026-06-30T23:59:59.999Z'),
          },
        }),
      })
    );
  });
});
