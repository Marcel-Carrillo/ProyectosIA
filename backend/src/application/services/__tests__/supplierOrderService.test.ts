import { SupplierOrder, SupplierOrderItem } from '../../../domain/models/supplierOrder';

const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockFindByCustomerOrderId = jest.fn();
const mockCreate = jest.fn();
const mockGenerate = jest.fn();
const mockUpdateStatus = jest.fn();
const mockGenerateNumber = jest.fn();

jest.mock('../../../infrastructure/repositories/supplierOrderRepository', () => ({
  SupplierOrderRepository: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    findByCustomerOrderId: mockFindByCustomerOrderId,
    create: mockCreate,
    generateFromCustomerOrder: mockGenerate,
    updateStatus: mockUpdateStatus,
    generateNextSupplierOrderNumber: mockGenerateNumber,
    recomputeCustomerFulfillmentStatus: jest.fn(),
  })),
  SupplierOrderNotFoundError: class SupplierOrderNotFoundError extends Error {
    code = 'SUPPLIER_ORDER_NOT_FOUND';
    status = 404;
  },
  SupplierBlockedError: class SupplierBlockedError extends Error {
    code = 'SUPPLIER_BLOCKED';
    status = 422;
  },
}));

jest.mock('../../../infrastructure/prismaClient', () => ({
  prisma: {
    customerOrder: { findUnique: jest.fn() },
    supplier: { findUnique: jest.fn() },
    productVariant: { findUnique: jest.fn() },
  },
}));

import { SupplierOrderService } from '../supplierOrderService';
import { SupplierOrderRepository } from '../../../infrastructure/repositories/supplierOrderRepository';

const makeOrder = () =>
  new SupplierOrder({
    id: 1,
    supplierOrderNumber: 'SPO-000001',
    customerOrderId: 1,
    supplierId: 1,
    items: [
      new SupplierOrderItem({
        customerOrderItemId: 1,
        productVariantId: 1,
        quantity: 1,
        supplierCost: '10.00',
      }),
    ],
  });

describe('SupplierOrderService', () => {
  const service = new SupplierOrderService(new SupplierOrderRepository());

  beforeEach(() => jest.clearAllMocks());

  it('findById throws when missing', async () => {
    mockFindById.mockResolvedValue(null);
    await expect(service.findById(99)).rejects.toMatchObject({ code: 'SUPPLIER_ORDER_NOT_FOUND' });
  });

  it('generateFromCustomerOrder delegates to repository', async () => {
    const orders = [makeOrder()];
    mockGenerate.mockResolvedValue({ orders, created: true });
    const result = await service.generateFromCustomerOrder(1);
    expect(result.created).toBe(true);
    expect(result.orders).toHaveLength(1);
  });

  it('updateStatus sets lifecycle timestamps', async () => {
    mockFindById.mockResolvedValue(makeOrder());
    mockUpdateStatus.mockResolvedValue({ ...makeOrder(), status: 'Requested' });
    await service.updateStatus(1, { status: 'Requested' });
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: 'Requested', requestedAt: expect.any(Date) })
    );
  });
});
