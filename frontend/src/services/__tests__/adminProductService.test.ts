import { vi, type Mocked } from 'vitest';
import axios from 'axios';
import { mapProductError, adminProductService } from '../adminProductService';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

describe('mapProductError', () => {
  it.each([
    ['PRODUCT_REQUIRES_ACTIVE_VARIANT', 'variante activa'],
    ['PRODUCT_ARCHIVED_CANNOT_REACTIVATE', 'archivados'],
    ['PRODUCT_SLUG_CONFLICT', 'Ya existe'],
    ['PRODUCT_NOT_FOUND', 'no encontrado'],
    ['VARIANT_NOT_FOUND', 'Variante no encontrada'],
    ['VARIANT_SKU_CONFLICT', 'SKU'],
    ['VARIANT_COMPARE_PRICE_INVALID', 'precio de comparación'],
    ['IMAGE_NOT_FOUND', 'Imagen no encontrada'],
  ])('maps %s to a specific message', (code, fragment) => {
    expect(mapProductError(code)).toContain(fragment);
  });

  it('returns a generic fallback for unknown or empty codes', () => {
    expect(mapProductError('SOMETHING_ELSE')).toMatch(/error inesperado/i);
    expect(mapProductError('')).toMatch(/error inesperado/i);
  });
});

describe('adminProductService translations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listTranslations calls the translations endpoint', async () => {
    mockedAxios.get.mockResolvedValue({ data: { success: true, data: [], message: '' } });
    await adminProductService.listTranslations(7);
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3000/api/admin/products/7/translations');
  });

  it('upsertTranslation calls PUT with locale', async () => {
    mockedAxios.put.mockResolvedValue({ data: { success: true, data: {}, message: '' } });
    await adminProductService.upsertTranslation(7, 'es', { name: 'Vestido', source: 'manual' });
    expect(mockedAxios.put).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/products/7/translations/es',
      { name: 'Vestido', source: 'manual' },
    );
  });

  it('deleteTranslation calls DELETE with locale', async () => {
    mockedAxios.delete.mockResolvedValue({});
    await adminProductService.deleteTranslation(7, 'es');
    expect(mockedAxios.delete).toHaveBeenCalledWith('http://localhost:3000/api/admin/products/7/translations/es');
  });
});
