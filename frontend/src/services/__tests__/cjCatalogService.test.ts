import { vi, type Mocked } from 'vitest';
import axios from 'axios';
import {
  cjCatalogService,
  mapCjCatalogError,
  extractCjCatalogErrorMessage,
  extractCjCatalogErrorCode,
} from '../cjCatalogService';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

describe('mapCjCatalogError', () => {
  it.each([
    ['CJ_PROMOTION_CATEGORY_REQUIRED', 'categoría'],
    ['CJ_PROMOTION_PRICE_REQUIRED', 'precio público'],
    ['CJ_CATALOG_ITEM_SYNC_FAILED_CANNOT_PROMOTE', 'sincronizar'],
    ['CJ_CATALOG_ITEM_NOT_FOUND', 'encontrar'],
    ['CJ_CATALOG_ITEM_NOT_PROMOTED', 'promocionado'],
    ['CJ_PROMOTION_VALIDATION_FAILED', 'validación'],
    ['CJ_CONNECTION_NOT_READY', 'no está lista'],
    ['CJ_CONNECTION_NOT_FOUND', 'CJ Dropshipping'],
    ['VALIDATION_ERROR', 'campos del formulario'],
  ])('maps %s to a specific message', (code, fragment) => {
    expect(mapCjCatalogError(code)).toContain(fragment);
  });

  it('returns a generic fallback for unknown or empty codes', () => {
    expect(mapCjCatalogError('SOMETHING_ELSE')).toMatch(/error inesperado/i);
    expect(mapCjCatalogError('')).toMatch(/error inesperado/i);
  });
});

describe('cjCatalogService', () => {
  beforeEach(() => vi.clearAllMocks());

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
    expect(extractCjCatalogErrorMessage(err)).toContain('precio público');
    expect(extractCjCatalogErrorCode(err)).toBe('CJ_PROMOTION_PRICE_REQUIRED');
  });

  it('falls back gracefully when the error has no response', () => {
    const err = new Error('network down');
    expect(extractCjCatalogErrorMessage(err)).toMatch(/error inesperado/i);
    expect(extractCjCatalogErrorCode(err)).toBe('');
  });
});
