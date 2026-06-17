import { validateSupplierData, ValidationError } from '../validator';

describe('validateSupplierData — create mode (requireName: true)', () => {
  it('passes with name only', () => {
    expect(() => validateSupplierData({ name: 'ACME' })).not.toThrow();
  });

  it('throws when name is missing', () => {
    expect(() => validateSupplierData({})).toThrow(ValidationError);
  });

  it('throws when name is empty string', () => {
    expect(() => validateSupplierData({ name: '' })).toThrow(ValidationError);
  });

  it('throws when name exceeds 150 chars', () => {
    expect(() => validateSupplierData({ name: 'A'.repeat(151) })).toThrow(ValidationError);
  });

  it('passes with name at exactly 150 chars', () => {
    expect(() => validateSupplierData({ name: 'A'.repeat(150) })).not.toThrow();
  });

  it('passes with all optional fields populated and valid', () => {
    expect(() =>
      validateSupplierData({
        name: 'ACME',
        contactName: 'Jane',
        contactEmail: 'jane@acme.com',
        contactPhone: '+34999123456',
        website: 'https://acme.com',
        notes: 'Internal note',
        status: 'Active',
      })
    ).not.toThrow();
  });

  it('throws ValidationError for invalid email format', () => {
    expect(() => validateSupplierData({ name: 'ACME', contactEmail: 'not-an-email' })).toThrow(ValidationError);
    expect(() => validateSupplierData({ name: 'ACME', contactEmail: 'missing@dot' })).toThrow(ValidationError);
  });

  it('throws when contactEmail exceeds 255 chars', () => {
    const email = 'a'.repeat(250) + '@test.com';
    expect(() => validateSupplierData({ name: 'ACME', contactEmail: email })).toThrow(ValidationError);
  });

  it('throws when contactPhone exceeds 30 chars', () => {
    expect(() => validateSupplierData({ name: 'ACME', contactPhone: '1'.repeat(31) })).toThrow(ValidationError);
  });

  it('throws when website exceeds 500 chars', () => {
    expect(() => validateSupplierData({ name: 'ACME', website: 'https://' + 'x'.repeat(494) })).toThrow(ValidationError);
  });

  it('throws when notes exceed 2000 chars', () => {
    expect(() => validateSupplierData({ name: 'ACME', notes: 'x'.repeat(2001) })).toThrow(ValidationError);
  });

  it('throws when contactName exceeds 150 chars', () => {
    expect(() => validateSupplierData({ name: 'ACME', contactName: 'A'.repeat(151) })).toThrow(ValidationError);
  });

  it('throws for invalid status value', () => {
    expect(() => validateSupplierData({ name: 'ACME', status: 'Deleted' })).toThrow(ValidationError);
  });

  it('accepts all valid status values', () => {
    for (const s of ['Active', 'Inactive', 'Blocked']) {
      expect(() => validateSupplierData({ name: 'ACME', status: s })).not.toThrow();
    }
  });
});

describe('validateSupplierData — update mode (requireName: false)', () => {
  it('passes with empty object', () => {
    expect(() => validateSupplierData({}, { requireName: false })).not.toThrow();
  });

  it('passes with a valid name', () => {
    expect(() => validateSupplierData({ name: 'ACME' }, { requireName: false })).not.toThrow();
  });

  it('throws for invalid email even in update mode', () => {
    expect(() => validateSupplierData({ contactEmail: 'bad-email' }, { requireName: false })).toThrow(ValidationError);
  });

  it('throws for invalid status even in update mode', () => {
    expect(() => validateSupplierData({ status: 'Unknown' }, { requireName: false })).toThrow(ValidationError);
  });

  it('throws when name provided exceeds 150 chars in update mode', () => {
    expect(() => validateSupplierData({ name: 'A'.repeat(151) }, { requireName: false })).toThrow(ValidationError);
  });
});
