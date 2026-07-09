const mockRun = jest.fn();

jest.mock('../../application/services/supplierAutoProvisionService', () => ({
  SupplierAutoProvisionService: jest.fn().mockImplementation(() => ({ run: mockRun })),
}));
jest.mock('../../application/services/supplierService', () => ({
  SupplierService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../infrastructure/repositories/supplierRepository', () => ({
  SupplierRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../application/services/cjConnectionService', () => ({
  CjConnectionService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../infrastructure/repositories/supplierIntegrationRepository', () => ({
  SupplierIntegrationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../infrastructure/external/cjClient', () => ({ cjClient: {} }));
jest.mock('../../application/providers/providerRegistry', () => ({ providerRegistry: [] }));

import { handler } from '../supplierAutoProvisionHandler';
import { SupplierAutoProvisionService } from '../../application/services/supplierAutoProvisionService';

describe('supplierAutoProvisionHandler', () => {
  beforeEach(() => {
    mockRun.mockReset();
  });

  // SupplierAutoProvisionService is constructed once at module load time (no
  // composition root — every entry point wires its own graph at import), so
  // its call history must be asserted without resetting mocks created before
  // this describe block runs.
  it('should_construct_SupplierAutoProvisionService_with_its_manually_wired_dependencies_exactly_once', () => {
    expect(SupplierAutoProvisionService).toHaveBeenCalledTimes(1);
    const args = (SupplierAutoProvisionService as unknown as jest.Mock).mock.calls[0];
    expect(args[2]).toEqual([]);
  });

  it('should_delegate_to_service_run_and_return_its_result_unchanged', async () => {
    const expected = { enabled: true, providers: [{ provider: 'CJDropshipping', skipped: false, provisioned: true }] };
    mockRun.mockResolvedValue(expected);

    const result = await handler();

    expect(result).toStrictEqual(expected);
    expect(mockRun).toHaveBeenCalledWith();
  });

  it('should_propagate_a_run_failure_rather_than_swallowing_it', async () => {
    mockRun.mockRejectedValue(new Error('unexpected'));

    await expect(handler()).rejects.toThrow('unexpected');
  });
});
