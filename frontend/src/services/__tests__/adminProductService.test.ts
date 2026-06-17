import { mapProductError } from '../adminProductService';

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
