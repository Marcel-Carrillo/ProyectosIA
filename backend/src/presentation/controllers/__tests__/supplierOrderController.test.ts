import { Request, Response, NextFunction } from 'express';
import { SupplierOrder } from '../../../domain/models/supplierOrder';
import { SupplierOrderListResult } from '../../../domain/repositories/supplierOrderRepository';

const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdateStatus = jest.fn();
const mockGenerate = jest.fn();

jest.mock('../../../application/services/supplierOrderService', () => ({
  SupplierOrderService: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    create: mockCreate,
    updateStatus: mockUpdateStatus,
    generateFromCustomerOrder: mockGenerate,
  })),
}));

jest.mock('../../../infrastructure/repositories/supplierOrderRepository', () => ({
  SupplierOrderRepository: jest.fn().mockImplementation(() => ({})),
}));

import {
  listSupplierOrders,
  getSupplierOrderById,
  createSupplierOrder,
  updateSupplierOrderStatus,
  generateSupplierOrdersFromCustomerOrder,
} from '../supplierOrderController';

const makeOrder = () =>
  new SupplierOrder({
    id: 1,
    supplierOrderNumber: 'SPO-000001',
    customerOrderId: 1,
    supplierId: 1,
  });

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('supplierOrderController', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listSupplierOrders returns 200 envelope', async () => {
    const result: SupplierOrderListResult = {
      items: [makeOrder()],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockFindAll.mockResolvedValue(result);
    const res = mockRes();
    await listSupplierOrders({ query: {} } as Request, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: result,
      message: 'Supplier orders retrieved successfully',
    });
  });

  it('createSupplierOrder returns 201', async () => {
    mockCreate.mockResolvedValue(makeOrder());
    const res = mockRes();
    await createSupplierOrder({ body: {} } as Request, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('generateSupplierOrdersFromCustomerOrder returns 201 when created', async () => {
    mockGenerate.mockResolvedValue({ orders: [makeOrder()], created: true });
    const res = mockRes();
    await generateSupplierOrdersFromCustomerOrder(
      { params: { id: '1' } } as unknown as Request,
      res,
      mockNext
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('generateSupplierOrdersFromCustomerOrder returns 200 when idempotent', async () => {
    mockGenerate.mockResolvedValue({ orders: [makeOrder()], created: false });
    const res = mockRes();
    await generateSupplierOrdersFromCustomerOrder(
      { params: { id: '1' } } as unknown as Request,
      res,
      mockNext
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
