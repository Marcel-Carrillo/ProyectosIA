import axios from 'axios';
import { mapProductError, adminProductService } from '../adminProductService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('mapProductError', () => {
  it.each([
    ['PRODUCT_REQUIRES_ACTIVE_VARIANT', 'active variant'],
    ['PRODUCT_ARCHIVED_CANNOT_REACTIVATE', 'Archived'],
    ['PRODUCT_SLUG_CONFLICT', 'already exists'],
    ['PRODUCT_NOT_FOUND', 'not found'],
    ['VARIANT_NOT_FOUND', 'Variant not found'],
    ['VARIANT_SKU_CONFLICT', 'SKU already exists'],
    ['VARIANT_COMPARE_PRICE_INVALID', 'Compare-at price'],
    ['IMAGE_NOT_FOUND', 'Image not found'],
  ])('maps %s to a specific message', (code, fragment) => {
    expect(mapProductError(code)).toContain(fragment);
  });

  it('returns a generic fallback for unknown or empty codes', () => {
    expect(mapProductError('SOMETHING_ELSE')).toMatch(/unexpected error/i);
    expect(mapProductError('')).toMatch(/unexpected error/i);
  });
});

describe('adminProductService translations', () => {
  beforeEach(() => jest.clearAllMocks());

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
