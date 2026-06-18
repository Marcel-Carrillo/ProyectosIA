import { ShipmentService } from '../shipmentService';
import {
  ShipmentNotFoundError,
  ShipmentStatusTransitionInvalidError,
} from '../../../infrastructure/repositories/shipmentRepository';
import { CustomerOrderNotFoundError } from '../../../infrastructure/repositories/customerOrderRepository';
import { Shipment } from '../../../domain/models/shipment';

const mockCustomerOrderFindUnique = jest.fn();
const mockSupplierOrderFindUnique = jest.fn();
const mockShipmentCreate = jest.fn();
const mockShipmentFindUnique = jest.fn();
const mockTransaction = jest.fn(async (cb: (tx: unknown) => unknown) =>
  cb({
    customerOrder: { findUnique: (a: unknown) => mockCustomerOrderFindUnique(a) },
    supplierOrder: { findUnique: (a: unknown) => mockSupplierOrderFindUnique(a) },
    shipment: {
      create: (a: unknown) => mockShipmentCreate(a),
      findUnique: (a: unknown) => mockShipmentFindUnique(a),
    },
  })
);

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: (cb: any) => mockTransaction(cb as (tx: unknown) => unknown),
  },
}));

const mockRepo = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
};

function makeShipment(
  overrides: Partial<ConstructorParameters<typeof Shipment>[0]> = {}
): Shipment {
  return new Shipment({
    id: 1,
    customerOrderId: 10,
    supplierOrderId: null,
    carrier: null,
    trackingNumber: null,
    trackingUrl: null,
    status: 'Pending',
    shippedAt: null,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('ShipmentService', () => {
  let service: ShipmentService;

  beforeEach(() => {
    service = new ShipmentService(mockRepo as never);
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        customerOrder: { findUnique: (a: unknown) => mockCustomerOrderFindUnique(a) },
        supplierOrder: { findUnique: (a: unknown) => mockSupplierOrderFindUnique(a) },
        shipment: {
          create: (a: unknown) => mockShipmentCreate(a),
          findUnique: (a: unknown) => mockShipmentFindUnique(a),
        },
      })
    );
  });

  describe('listShipments', () => {
    it('delegates to repository', async () => {
      const result = { items: [], total: 0, page: 1, pageSize: 20 };
      mockRepo.findAll.mockResolvedValue(result);
      const r = await service.listShipments({});
      expect(mockRepo.findAll).toHaveBeenCalled();
      expect(r).toBe(result);
    });
  });

  describe('getShipmentById', () => {
    it('returns shipment when found', async () => {
      const s = makeShipment();
      mockRepo.findById.mockResolvedValue(s);
      const result = await service.getShipmentById(1);
      expect(result).toBe(s);
    });

    it('throws ShipmentNotFoundError when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.getShipmentById(999)).rejects.toBeInstanceOf(ShipmentNotFoundError);
    });
  });

  describe('createShipment', () => {
    it('throws validation error for missing customerOrderId', async () => {
      await expect(service.createShipment({})).rejects.toThrow("Field 'customerOrderId' is required");
    });

    it('throws CustomerOrderNotFoundError when order does not exist', async () => {
      mockCustomerOrderFindUnique.mockResolvedValue(null);
      await expect(service.createShipment({ customerOrderId: 999 })).rejects.toBeInstanceOf(
        CustomerOrderNotFoundError
      );
    });

    it('creates shipment with Pending status', async () => {
      mockCustomerOrderFindUnique.mockResolvedValue({ id: 10 });
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockShipmentCreate.mockResolvedValue(row);

      const result = await service.createShipment({ customerOrderId: 10 });
      expect(result.status).toBe('Pending');
    });

    it('pre-fills tracking from supplierOrder when not provided', async () => {
      mockCustomerOrderFindUnique.mockResolvedValue({ id: 10 });
      mockSupplierOrderFindUnique.mockResolvedValue({
        id: 5,
        trackingNumber: 'SUPPLIER-TRK',
        trackingUrl: 'https://supplier.example.com/track',
      });
      const row = {
        id: 1,
        customerOrderId: 10,
        supplierOrderId: 5,
        carrier: null,
        trackingNumber: 'SUPPLIER-TRK',
        trackingUrl: 'https://supplier.example.com/track',
        status: 'Pending',
        shippedAt: null,
        deliveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockShipmentCreate.mockResolvedValue(row);

      const result = await service.createShipment({ customerOrderId: 10, supplierOrderId: 5 });
      expect(result.trackingNumber).toBe('SUPPLIER-TRK');
    });
  });

  describe('updateShipmentStatus', () => {
    it('throws validation error for invalid status', async () => {
      await expect(service.updateShipmentStatus(1, { status: 'Blah' })).rejects.toThrow();
    });

    it('throws ShipmentNotFoundError when shipment does not exist', async () => {
      mockShipmentFindUnique.mockResolvedValue(null);
      await expect(service.updateShipmentStatus(999, { status: 'Shipped' })).rejects.toBeInstanceOf(
        ShipmentNotFoundError
      );
    });

    it('throws ShipmentStatusTransitionInvalidError for invalid transition', async () => {
      mockShipmentFindUnique.mockResolvedValue({ id: 1, status: 'Delivered' });
      await expect(service.updateShipmentStatus(1, { status: 'Shipped' })).rejects.toBeInstanceOf(
        ShipmentStatusTransitionInvalidError
      );
    });

    it('sets shippedAt when transitioning to Shipped', async () => {
      mockShipmentFindUnique.mockResolvedValue({ id: 1, status: 'Pending' });
      const updatedShipment = makeShipment({ status: 'Shipped', shippedAt: new Date() });
      mockRepo.updateStatus.mockResolvedValue(updatedShipment);

      const result = await service.updateShipmentStatus(1, { status: 'Shipped' });

      expect(result.status).toBe('Shipped');
      const call = mockRepo.updateStatus.mock.calls[0];
      expect(call![1].shippedAt).toBeInstanceOf(Date);
    });

    it('sets deliveredAt when transitioning to Delivered', async () => {
      mockShipmentFindUnique.mockResolvedValue({ id: 1, status: 'Shipped' });
      const updatedShipment = makeShipment({ status: 'Delivered', deliveredAt: new Date() });
      mockRepo.updateStatus.mockResolvedValue(updatedShipment);

      const result = await service.updateShipmentStatus(1, { status: 'Delivered' });

      expect(result.status).toBe('Delivered');
      const call = mockRepo.updateStatus.mock.calls[0];
      expect(call![1].deliveredAt).toBeInstanceOf(Date);
    });
  });
});
