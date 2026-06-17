import { Request, Response, NextFunction } from 'express';
import { Supplier } from '../../../domain/models/supplier';
import { SupplierListResult } from '../../../domain/repositories/supplierRepository';

const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockSoftDelete = jest.fn();

jest.mock('../../../application/services/supplierService', () => ({
  SupplierService: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    create: mockCreate,
    update: mockUpdate,
    softDelete: mockSoftDelete,
  })),
}));

jest.mock('../../../infrastructure/repositories/supplierRepository', () => ({
  SupplierRepository: jest.fn().mockImplementation(() => ({})),
}));

import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../supplierController';

const makeSupplier = (overrides: Partial<ConstructorParameters<typeof Supplier>[0]> = {}) =>
  new Supplier({ id: 1, name: 'ACME', status: 'Active', ...overrides });

const makeListResult = (items: Supplier[]): SupplierListResult => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 20,
});

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};
const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('listSuppliers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with envelope', async () => {
    const result = makeListResult([makeSupplier()]);
    mockFindAll.mockResolvedValue(result);
    const res = mockRes();
    await listSuppliers({ query: {} } as Request, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: result,
      message: 'Suppliers retrieved successfully',
    });
  });

  it('passes search, status, page, pageSize to service', async () => {
    mockFindAll.mockResolvedValue(makeListResult([]));
    const req = { query: { search: 'acme', status: 'Active', page: '2', pageSize: '10' } } as unknown as Request;
    await listSuppliers(req, mockRes(), mockNext);
    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'acme', status: 'Active', page: 2, pageSize: 10 })
    );
  });

  it('calls next on error', async () => {
    mockFindAll.mockRejectedValue(new Error('db error'));
    await listSuppliers({ query: {} } as Request, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});

describe('getSupplierById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with supplier', async () => {
    const s = makeSupplier();
    mockFindById.mockResolvedValue(s);
    const res = mockRes();
    await getSupplierById({ params: { id: '1' } } as unknown as Request, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: s,
      message: 'Supplier retrieved successfully',
    });
  });

  it('calls next with ValidationError for non-numeric id', async () => {
    await getSupplierById({ params: { id: 'abc' } } as unknown as Request, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('calls next on service error', async () => {
    const err = Object.assign(new Error('not found'), { code: 'SUPPLIER_NOT_FOUND', status: 404 });
    mockFindById.mockRejectedValue(err);
    await getSupplierById({ params: { id: '99' } } as unknown as Request, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('createSupplier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 with created supplier', async () => {
    const s = makeSupplier();
    mockCreate.mockResolvedValue(s);
    const res = mockRes();
    await createSupplier({ body: { name: 'ACME' } } as Request, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: s,
      message: 'Supplier created successfully',
    });
  });

  it('calls next on ValidationError', async () => {
    const err = Object.assign(new Error('name required'), { code: 'VALIDATION_ERROR' });
    mockCreate.mockRejectedValue(err);
    await createSupplier({ body: {} } as Request, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('updateSupplier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with updated supplier', async () => {
    const updated = makeSupplier({ status: 'Blocked' });
    mockUpdate.mockResolvedValue(updated);
    const req = { params: { id: '1' }, body: { status: 'Blocked' } } as unknown as Request;
    const res = mockRes();
    await updateSupplier(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: updated,
      message: 'Supplier updated successfully',
    });
  });

  it('calls next with ValidationError for non-numeric id', async () => {
    const req = { params: { id: 'xyz' }, body: {} } as unknown as Request;
    await updateSupplier(req, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('calls next on service error', async () => {
    const err = Object.assign(new Error('not found'), { code: 'SUPPLIER_NOT_FOUND', status: 404 });
    mockUpdate.mockRejectedValue(err);
    const req = { params: { id: '99' }, body: {} } as unknown as Request;
    await updateSupplier(req, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe('deleteSupplier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with soft-deleted supplier (status=Inactive), not 204', async () => {
    const inactive = makeSupplier({ status: 'Inactive' });
    mockSoftDelete.mockResolvedValue(inactive);
    const res = mockRes();
    await deleteSupplier({ params: { id: '1' } } as unknown as Request, res, mockNext);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: inactive,
      message: 'Supplier deactivated successfully',
    });
    expect(res.status).not.toHaveBeenCalledWith(204);
  });

  it('calls next on service error', async () => {
    const err = Object.assign(new Error('not found'), { code: 'SUPPLIER_NOT_FOUND', status: 404 });
    mockSoftDelete.mockRejectedValue(err);
    await deleteSupplier({ params: { id: '99' } } as unknown as Request, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});
