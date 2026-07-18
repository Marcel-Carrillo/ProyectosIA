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

  it('formats the first sequence value as ORD-000001', async () => {
    mockQueryRaw.mockResolvedValue([{ next_num: 1n }]);
    await expect(repo.generateNextOrderNumber()).resolves.toBe('ORD-000001');
  });

  it('pads sequence values to six digits', async () => {
    mockQueryRaw.mockResolvedValue([{ next_num: 30n }]);
    await expect(repo.generateNextOrderNumber()).resolves.toBe('ORD-000030');
  });

  it('does not truncate sequence values beyond six digits', async () => {
    mockQueryRaw.mockResolvedValue([{ next_num: 1234567n }]);
    await expect(repo.generateNextOrderNumber()).resolves.toBe('ORD-1234567');
  });

  it('uses the atomic nextval sequence query (no MAX scan)', async () => {
    mockQueryRaw.mockResolvedValue([{ next_num: 2n }]);
    await repo.generateNextOrderNumber();
    const [template] = mockQueryRaw.mock.calls[0] as [TemplateStringsArray];
    expect(template.join('')).toContain("nextval('customer_order_number_seq')");
  });
});
