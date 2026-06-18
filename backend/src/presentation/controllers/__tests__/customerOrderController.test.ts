import { Request, Response, NextFunction } from 'express';
import { CustomerOrder } from '../../../domain/models/customerOrder';
import { CustomerOrderListResult } from '../../../domain/repositories/customerOrderRepository';

const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdateStatus = jest.fn();

jest.mock('../../../application/services/customerOrderService', () => ({
  CustomerOrderService: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    create: mockCreate,
    updateStatus: mockUpdateStatus,
  })),
}));

jest.mock('../../../infrastructure/repositories/customerOrderRepository', () => ({
  CustomerOrderRepository: jest.fn().mockImplementation(() => ({})),
}));

import {
  listCustomerOrders,
  getCustomerOrderById,
  createCustomerOrder,
  updateCustomerOrderStatus,
} from '../customerOrderController';

const address = {
  fullName: 'Jane Doe',
  streetLine1: 'Main St',
  city: 'Malaga',
  province: 'Malaga',
  postalCode: '29001',
  country: 'Spain',
};

const makeOrder = () =>
  new CustomerOrder({
    id: 1,
    orderNumber: 'ORD-000001',
    customerId: 1,
    subtotalAmount: '50.00',
    shippingAmount: '0.00',
    discountAmount: '0.00',
    totalAmount: '50.00',
    shippingAddressSnapshot: address,
    billingAddressSnapshot: address,
  });

const makeListResult = (): CustomerOrderListResult => ({
  items: [makeOrder()],
  total: 1,
  page: 1,
  pageSize: 20,
});

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('customerOrderController', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listCustomerOrders returns 200 envelope', async () => {
    const result = makeListResult();
    mockFindAll.mockResolvedValue(result);
    const res = mockRes();
    await listCustomerOrders({ query: {} } as Request, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: result,
      message: 'Customer orders retrieved successfully',
    });
  });

  it('getCustomerOrderById returns 200', async () => {
    const order = makeOrder();
    mockFindById.mockResolvedValue(order);
    const res = mockRes();
    await getCustomerOrderById({ params: { id: '1' } } as unknown as Request, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: order,
      message: 'Customer order retrieved successfully',
    });
  });

  it('createCustomerOrder returns 201', async () => {
    const order = makeOrder();
    mockCreate.mockResolvedValue(order);
    const res = mockRes();
    await createCustomerOrder({ body: { customerId: 1 } } as Request, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('updateCustomerOrderStatus returns 200', async () => {
    const order = makeOrder();
    mockUpdateStatus.mockResolvedValue(order);
    const res = mockRes();
    await updateCustomerOrderStatus(
      { params: { id: '1' }, body: { paymentStatus: 'Paid' } } as unknown as Request,
      res,
      mockNext
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: order,
      message: 'Customer order status updated successfully',
    });
  });

  it('rejects non-numeric id', async () => {
    await getCustomerOrderById({ params: { id: 'abc' } } as unknown as Request, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
