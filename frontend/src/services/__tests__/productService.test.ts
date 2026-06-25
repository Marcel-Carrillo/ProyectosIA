const mockGet = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: mockGet,
      interceptors: {
        request: {
          use: jest.fn(),
        },
      },
    })),
  },
}));

jest.mock('../../i18n', () => ({
  __esModule: true,
  default: { language: 'es' },
}));

describe('productService Accept-Language', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGet.mockResolvedValue({
      data: { success: true, data: { items: [], total: 0, page: 1, pageSize: 20 }, message: '' },
    });
  });

  it('registers a request interceptor that sets Accept-Language from i18n', async () => {
    const axios = (await import('axios')).default;
    await import('../productService');
    const createMock = axios.create as jest.Mock;
    const instance = createMock.mock.results[createMock.mock.results.length - 1].value;
    const interceptor = instance.interceptors.request.use.mock.calls[0][0];
    const config = { headers: {} as Record<string, string> };
    interceptor(config);
    expect(config.headers['Accept-Language']).toBe('es');
  });
});
