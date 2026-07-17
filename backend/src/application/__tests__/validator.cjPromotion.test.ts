import { validateCjPromotionData, ValidationError } from '../validator';

describe('validateCjPromotionData', () => {
  it('accepts a request with no categoryId (auto-resolution mode)', () => {
    const result = validateCjPromotionData({ items: [{ cjCatalogItemId: 1 }] });
    expect(result).toEqual({
      items: [{ cjCatalogItemId: 1, publicPrice: undefined, compareAtPrice: undefined }],
      categoryId: undefined,
      activate: undefined,
    });
  });

  it('accepts a valid positive integer categoryId', () => {
    const result = validateCjPromotionData({ items: [{ cjCatalogItemId: 1 }], categoryId: 5 });
    expect(result.categoryId).toBe(5);
  });

  it.each([1.5, '5', 0, -1])('rejects a non-positive-integer categoryId (%p)', (value) => {
    expect(() => validateCjPromotionData({ items: [{ cjCatalogItemId: 1 }], categoryId: value })).toThrow(
      ValidationError
    );
  });

  it('rejects when items is missing', () => {
    expect(() => validateCjPromotionData({})).toThrow(ValidationError);
  });

  it('rejects when items is an empty array', () => {
    expect(() => validateCjPromotionData({ items: [] })).toThrow(ValidationError);
  });

  it('rejects an item with a non-positive cjCatalogItemId', () => {
    expect(() => validateCjPromotionData({ items: [{ cjCatalogItemId: 0 }] })).toThrow(ValidationError);
  });

  it('rejects an item that is not an object', () => {
    expect(() => validateCjPromotionData({ items: ['not-an-object'] })).toThrow(ValidationError);
  });

  it('accepts a valid publicPrice and compareAtPrice', () => {
    const result = validateCjPromotionData({
      items: [{ cjCatalogItemId: 1, publicPrice: 29.99, compareAtPrice: 39.99 }],
    });
    expect(result.items[0]).toEqual({ cjCatalogItemId: 1, publicPrice: 29.99, compareAtPrice: 39.99 });
  });

  it('rejects a non-positive publicPrice', () => {
    expect(() => validateCjPromotionData({ items: [{ cjCatalogItemId: 1, publicPrice: 0 }] })).toThrow(
      ValidationError
    );
  });

  it('rejects a non-positive compareAtPrice', () => {
    expect(() => validateCjPromotionData({ items: [{ cjCatalogItemId: 1, compareAtPrice: -5 }] })).toThrow(
      ValidationError
    );
  });

  it('accepts a valid activate boolean', () => {
    const result = validateCjPromotionData({ items: [{ cjCatalogItemId: 1 }], activate: true });
    expect(result.activate).toBe(true);
  });

  it('rejects a non-boolean activate', () => {
    expect(() => validateCjPromotionData({ items: [{ cjCatalogItemId: 1 }], activate: 'yes' })).toThrow(
      ValidationError
    );
  });
});
