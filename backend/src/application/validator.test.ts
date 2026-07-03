import {
  validateRequiredFields,
  validateCategoryData,
  validateProductData,
  isValidGtinFormat,
  ValidationError,
} from './validator';

describe('validateRequiredFields', () => {
  it('passes when all required fields are present', () => {
    expect(() =>
      validateRequiredFields({ name: 'Alice', email: 'a@b.com' }, ['name', 'email'])
    ).not.toThrow();
  });

  it('throws ValidationError when a field is missing (undefined)', () => {
    expect(() =>
      validateRequiredFields({ name: 'Alice' }, ['name', 'email'])
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when a field is empty string', () => {
    expect(() =>
      validateRequiredFields({ name: '' }, ['name'])
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when a field is null', () => {
    expect(() =>
      validateRequiredFields({ name: null }, ['name'])
    ).toThrow(ValidationError);
  });

  it('error message contains the missing field name', () => {
    expect(() =>
      validateRequiredFields({}, ['email'])
    ).toThrow("Field 'email' is required");
  });

  it('error code is VALIDATION_ERROR', () => {
    try {
      validateRequiredFields({}, ['email']);
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('validateCategoryData', () => {
  it('passes when name is provided', () => {
    expect(() => validateCategoryData({ name: 'Dresses' })).not.toThrow();
  });

  it('passes when name and valid status are provided', () => {
    expect(() => validateCategoryData({ name: 'Dresses', status: 'Active' })).not.toThrow();
    expect(() => validateCategoryData({ name: 'Dresses', status: 'Inactive' })).not.toThrow();
  });

  it('passes when parentId is a positive integer', () => {
    expect(() => validateCategoryData({ name: 'Dresses', parentId: 5 })).not.toThrow();
  });

  it('throws ValidationError when name is missing', () => {
    expect(() => validateCategoryData({})).toThrow(ValidationError);
    expect(() => validateCategoryData({ name: '' })).toThrow(ValidationError);
    expect(() => validateCategoryData({ name: null })).toThrow(ValidationError);
  });

  it('throws ValidationError when status is invalid', () => {
    expect(() =>
      validateCategoryData({ name: 'Dresses', status: 'Published' })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when parentId is not a positive integer', () => {
    expect(() =>
      validateCategoryData({ name: 'Dresses', parentId: -1 })
    ).toThrow(ValidationError);
    expect(() =>
      validateCategoryData({ name: 'Dresses', parentId: 'abc' })
    ).toThrow(ValidationError);
    expect(() =>
      validateCategoryData({ name: 'Dresses', parentId: 0 })
    ).toThrow(ValidationError);
  });
});

describe('validateProductData', () => {
  it('passes when name is provided and gtin is omitted', () => {
    expect(() => validateProductData({ name: 'Summer Dress' })).not.toThrow();
  });

  it.each([8, 12, 13, 14])('accepts a valid %i-digit gtin', (length) => {
    const gtin = '1'.repeat(length);
    const data: Record<string, unknown> = { name: 'Summer Dress', gtin };
    expect(() => validateProductData(data)).not.toThrow();
    expect(data['gtin']).toBe(gtin);
  });

  it('throws ValidationError when gtin contains non-digit characters', () => {
    expect(() =>
      validateProductData({ name: 'Summer Dress', gtin: '12345ABC9012' })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when gtin has an invalid length', () => {
    expect(() =>
      validateProductData({ name: 'Summer Dress', gtin: '123456789' })
    ).toThrow(ValidationError);
    expect(() =>
      validateProductData({ name: 'Summer Dress', gtin: '1234567' })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when gtin is not a string', () => {
    expect(() =>
      validateProductData({ name: 'Summer Dress', gtin: 12345678 })
    ).toThrow(ValidationError);
  });

  it('normalizes an empty-string gtin to null instead of throwing', () => {
    const data: Record<string, unknown> = { name: 'Summer Dress', gtin: '' };
    expect(() => validateProductData(data)).not.toThrow();
    expect(data['gtin']).toBeNull();
  });

  it('normalizes a whitespace-only gtin to null', () => {
    const data: Record<string, unknown> = { name: 'Summer Dress', gtin: '   ' };
    expect(() => validateProductData(data)).not.toThrow();
    expect(data['gtin']).toBeNull();
  });

  it('leaves gtin untouched when omitted entirely', () => {
    const data: Record<string, unknown> = { name: 'Summer Dress' };
    expect(() => validateProductData(data)).not.toThrow();
    expect(data['gtin']).toBeUndefined();
  });

  it('trims surrounding whitespace on a valid gtin', () => {
    const data: Record<string, unknown> = { name: 'Summer Dress', gtin: '  5901234123457  ' };
    expect(() => validateProductData(data)).not.toThrow();
    expect(data['gtin']).toBe('5901234123457');
  });
});

describe('isValidGtinFormat', () => {
  it.each([8, 12, 13, 14])('returns true for a %i-digit numeric string', (length) => {
    expect(isValidGtinFormat('1'.repeat(length))).toBe(true);
  });

  it.each([1, 7, 9, 10, 11, 15])('returns false for a %i-digit numeric string', (length) => {
    expect(isValidGtinFormat('1'.repeat(length))).toBe(false);
  });

  it('returns false for non-digit characters', () => {
    expect(isValidGtinFormat('12345ABC9012')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidGtinFormat('')).toBe(false);
  });
});
