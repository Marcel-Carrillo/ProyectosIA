import axios from 'axios';
import { customerOrderService, mapCustomerOrderError } from '../customerOrderService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('customerOrderService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('list calls admin endpoint', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { success: true, data: { items: [], total: 0, page: 1, pageSize: 20 }, message: 'ok' },
    });
    await customerOrderService.list({ page: 1 });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/customer-orders'),
      { params: { page: 1 } }
    );
  });

  it('maps transition error', () => {
    expect(mapCustomerOrderError('ORDER_STATUS_TRANSITION_INVALID')).toMatch(/not allowed/i);
  });
});
