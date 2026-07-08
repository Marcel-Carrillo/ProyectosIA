import axios from 'axios';
import {
  cjCatalogService,
  mapCjCatalogError,
  extractCjCatalogErrorMessage,
  extractCjCatalogErrorCode,
} from '../cjCatalogService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('mapCjCatalogError', () => {
  it.each([
    ['CJ_PROMOTION_CATEGORY_REQUIRED', 'category'],
    ['CJ_PROMOTION_PRICE_REQUIRED', 'price'],
    ['CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE', 'failed to sync'],
    ['CJ_CATALOG_ITEM_NOT_FOUND', 'could not be found'],
    ['CJ_CATALOG_ITEM_NOT_PROMOTED', 'not been promoted'],
    ['CJ_PROMOTION_VALIDATION_FAILED', 'failed validation'],
    ['CJ_CONNECTION_NOT_READY', 'not ready'],
    ['CJ_CONNECTION_NOT_FOUND', 'No CJ Dropshipping connection'],
    ['VALIDATION_ERROR', 'check the form fields'],
  ])('maps %s to a specific message', (code, fragment) => {
    expect(mapCjCatalogError(code)).toContain(fragment);
  });

  it('returns a generic fallback for unknown or empty codes', () => {
    expect(mapCjCatalogError('SOMETHING_ELSE')).toMatch(/unexpected error/i);
    expect(mapCjCatalogError('')).toMatch(/unexpected error/i);
  });
});

describe('cjCatalogService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('listCatalog calls GET with supplier-scoped path and query params', async () => {
    mockedAxios.get.mockResolvedValue({ data: { success: true, data: { items: [], total: 0, page: 1, pageSize: 20 }, message: '' } });

    await cjCatalogService.listCatalog(3, { syncStatus: 'Synced', page: 2 });

    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3000/api/admin/suppliers/3/cj/catalog', {
      params: { syncStatus: 'Synced', page: 2 },
    });
  });

  it('promote calls POST with the promote payload', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true, data: {}, message: '' } });
    const payload = { items: [{ cjCatalogItemId: 1, publicPrice: 39.99 }], categoryId: 1 };

    await cjCatalogService.promote(3, payload);

    expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:3000/api/admin/suppliers/3/cj/catalog/promote', payload);
  });

  it('activate calls POST to the activate endpoint', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true, data: { productId: 20, productVariantId: 50 }, message: '' } });

    await cjCatalogService.activate(3, 42);

    expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:3000/api/admin/suppliers/3/cj/catalog/42/activate');
  });

  it('deactivate calls POST to the deactivate endpoint', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true, data: { productId: 20, productVariantId: 50 }, message: '' } });

    await cjCatalogService.deactivate(3, 42);

    expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:3000/api/admin/suppliers/3/cj/catalog/42/deactivate');
  });

  it.each([
    ['listCatalog', () => cjCatalogService.listCatalog(3), () => mockedAxios.get.mockRejectedValue(new Error('boom'))],
    ['promote', () => cjCatalogService.promote(3, { items: [], categoryId: 1 }), () => mockedAxios.post.mockRejectedValue(new Error('boom'))],
    ['activate', () => cjCatalogService.activate(3, 1), () => mockedAxios.post.mockRejectedValue(new Error('boom'))],
    ['deactivate', () => cjCatalogService.deactivate(3, 1), () => mockedAxios.post.mockRejectedValue(new Error('boom'))],
  ])('%s rethrows on failure', async (_name, call, arrange) => {
    arrange();
    await expect(call()).rejects.toThrow('boom');
  });
});

describe('extractCjCatalogErrorMessage / extractCjCatalogErrorCode', () => {
  it('extracts the mapped message and raw code from an axios error response', () => {
    const err = { response: { data: { error: { code: 'CJ_PROMOTION_PRICE_REQUIRED' } } } };
    expect(extractCjCatalogErrorMessage(err)).toContain('price');
    expect(extractCjCatalogErrorCode(err)).toBe('CJ_PROMOTION_PRICE_REQUIRED');
  });

  it('falls back gracefully when the error has no response', () => {
    const err = new Error('network down');
    expect(extractCjCatalogErrorMessage(err)).toMatch(/unexpected error/i);
    expect(extractCjCatalogErrorCode(err)).toBe('');
  });
});
