import { validateRequiredFields, ValidationError } from './validator';

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
