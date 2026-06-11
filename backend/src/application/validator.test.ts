import { validateRequiredFields, validateCategoryData, ValidationError } from './validator';

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
