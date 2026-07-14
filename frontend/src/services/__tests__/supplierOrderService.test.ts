import { vi, type Mocked } from 'vitest';
import axios from 'axios';
import { supplierOrderService, mapSupplierOrderError } from '../supplierOrderService';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

describe('supplierOrderService', () => {
  beforeEach(() => vi.clearAllMocks());

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
    expect(mapSupplierOrderError('CUSTOMER_ORDER_NOT_ELIGIBLE')).toMatch(/no es apto/i);
  });
});
