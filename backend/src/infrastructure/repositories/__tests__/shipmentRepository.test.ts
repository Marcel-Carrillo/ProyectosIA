import { ShipmentRepository, ShipmentNotFoundError } from '../shipmentRepository';

const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    shipment: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

describe('ShipmentRepository', () => {
  let repo: ShipmentRepository;

  beforeEach(() => {
    repo = new ShipmentRepository();
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated results', async () => {
      const rows = [
        {
          id: 1,
          customerOrderId: 10,
          supplierOrderId: null,
          carrier: 'DHL',
          trackingNumber: 'TRK1',
          trackingUrl: null,
          status: 'Pending',
          shippedAt: null,
          deliveredAt: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];
      mockTransaction.mockResolvedValue([rows, 1]);

      const result = await repo.findAll({ page: 1, pageSize: 20 });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.carrier).toBe('DHL');
    });

    it('applies status filter', async () => {
      mockTransaction.mockResolvedValue([[], 0]);
      await repo.findAll({ status: 'Shipped' });
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns a shipment with relations', async () => {
      const row = {
        id: 1,
        customerOrderId: 10,
        supplierOrderId: null,
        carrier: null,
        trackingNumber: null,
        trackingUrl: null,
        status: 'Pending',
        shippedAt: null,
        deliveredAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        customerOrder: { id: 10, orderNumber: 'ORD-001', status: 'Confirmed' },
        supplierOrder: null,
      };
      mockFindUnique.mockResolvedValue(row);

      const result = await repo.findById(1);

      expect(result).not.toBeNull();
      expect(result!.customerOrder?.orderNumber).toBe('ORD-001');
    });

    it('returns null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await repo.findById(999);
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a shipment with Pending status', async () => {
      const row = {
        id: 1,
        customerOrderId: 10,
        supplierOrderId: null,
        carrier: 'FedEx',
        trackingNumber: null,
        trackingUrl: null,
        status: 'Pending',
        shippedAt: null,
        deliveredAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };
      mockCreate.mockResolvedValue(row);

      const result = await repo.create({ customerOrderId: 10, carrier: 'FedEx' });

      expect(result.status).toBe('Pending');
      expect(result.carrier).toBe('FedEx');
    });
  });

  describe('updateStatus', () => {
    it('updates the status', async () => {
      const row = {
        id: 1,
        customerOrderId: 10,
        supplierOrderId: null,
        carrier: null,
        trackingNumber: null,
        trackingUrl: null,
        status: 'Shipped',
        shippedAt: new Date(),
        deliveredAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };
      mockUpdate.mockResolvedValue(row);

      const result = await repo.updateStatus(1, { status: 'Shipped', shippedAt: new Date() });

      expect(result.status).toBe('Shipped');
    });

    it('throws ShipmentNotFoundError when Prisma reports P2025', async () => {
      const { Prisma } = await import('@prisma/client');
      const prismaErr = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      mockUpdate.mockRejectedValue(prismaErr);

      await expect(repo.updateStatus(999, { status: 'Shipped' })).rejects.toBeInstanceOf(
        ShipmentNotFoundError
      );
    });
  });
});
