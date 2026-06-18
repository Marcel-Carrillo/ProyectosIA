import axios from 'axios';
import { supplierOrderService, mapSupplierOrderError } from '../supplierOrderService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('supplierOrderService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('list calls admin endpoint', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { success: true, data: { items: [], total: 0, page: 1, pageSize: 20 }, message: 'ok' },
    });
    await supplierOrderService.list({ page: 1 });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/supplier-orders'),
      { params: { page: 1 } }
    );
  });

  it('maps eligibility error', () => {
    expect(mapSupplierOrderError('CUSTOMER_ORDER_NOT_ELIGIBLE')).toMatch(/eligible/i);
  });
});
