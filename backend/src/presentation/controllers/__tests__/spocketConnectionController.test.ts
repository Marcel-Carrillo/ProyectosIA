import { Request, Response, NextFunction } from 'express';
import { SupplierIntegration } from '../../../domain/models/supplierIntegration';

const mockConfigureConnection = jest.fn();
const mockGetConnection = jest.fn();
const mockVerifyConnection = jest.fn();

jest.mock('../../../application/services/spocketConnectionService', () => ({
  SpocketConnectionService: jest.fn().mockImplementation(() => ({
    configureConnection: mockConfigureConnection,
    getConnection: mockGetConnection,
    verifyConnection: mockVerifyConnection,
  })),
}));

jest.mock('../../../infrastructure/repositories/supplierIntegrationRepository', () => ({
  SupplierIntegrationRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../infrastructure/external/spocketClient', () => ({
  spocketClient: {},
}));

import { configure, get, verify } from '../spocketConnectionController';

const makeIntegration = () => new SupplierIntegration({ id: 1, supplierId: 10, status: 'Connected' });

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;

describe('spocketConnectionController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('configure', () => {
    it('should_return_201_on_create_with_no_credential_field_in_response', async () => {
      mockConfigureConnection.mockResolvedValue({ integration: makeIntegration(), created: true });
      const req = { params: { supplierId: '10' }, body: { externalAccountRef: 'acc-1' } } as unknown as Request;
      const res = mockRes();

      await configure(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      const payload = JSON.stringify((res.json as jest.Mock).mock.calls[0][0]);
      expect(payload).not.toMatch(/apiKey|credential|secret/i);
    });

    it('should_return_200_on_update', async () => {
      mockConfigureConnection.mockResolvedValue({ integration: makeIntegration(), created: false });
      const req = { params: { supplierId: '10' }, body: {} } as unknown as Request;
      const res = mockRes();

      await configure(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should_call_next_with_validation_error_for_non_numeric_supplierId', async () => {
      const req = { params: { supplierId: 'abc' }, body: {} } as unknown as Request;

      await configure(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
      expect(mockConfigureConnection).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should_return_200_with_connection_fields', async () => {
      mockGetConnection.mockResolvedValue(makeIntegration());
      const req = { params: { supplierId: '10' } } as unknown as Request;
      const res = mockRes();

      await get(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ supplierId: 10 }) })
      );
    });

    it('should_call_next_on_service_error', async () => {
      const err = Object.assign(new Error('not found'), { code: 'SPOCKET_CONNECTION_NOT_FOUND', status: 404 });
      mockGetConnection.mockRejectedValue(err);
      const req = { params: { supplierId: '99' } } as unknown as Request;

      await get(req, mockRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  describe('verify', () => {
    it('should_return_200_with_healthy_result', async () => {
      mockVerifyConnection.mockResolvedValue({ healthy: true });
      const req = { params: { supplierId: '10' } } as unknown as Request;
      const res = mockRes();

      await verify(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: { healthy: true } })
      );
    });

    it('should_never_leak_credential_shaped_content_on_failed_verification', async () => {
      mockVerifyConnection.mockResolvedValue({ healthy: false, reason: 'Spocket rejected the configured credentials or is unreachable' });
      const req = { params: { supplierId: '10' } } as unknown as Request;
      const res = mockRes();

      await verify(req, res, mockNext);

      const payload = JSON.stringify((res.json as jest.Mock).mock.calls[0][0]);
      expect(payload).not.toMatch(/spocket_test|bearer /i);
    });
  });
});
