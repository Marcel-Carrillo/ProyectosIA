import { ValidationError } from '../../validator';
import { validateAndNormalizeStorefrontCategoryIdField } from '../storefrontCategoryGuard';

describe('validateAndNormalizeStorefrontCategoryIdField', () => {
  it('allows null', () => {
    const data: Record<string, unknown> = { storefrontCategoryId: null };
    validateAndNormalizeStorefrontCategoryIdField(data);
    expect(data['storefrontCategoryId']).toBeNull();
  });

  it('allows a positive integer', () => {
    const data: Record<string, unknown> = { storefrontCategoryId: 4 };
    validateAndNormalizeStorefrontCategoryIdField(data);
    expect(data['storefrontCategoryId']).toBe(4);
  });

  it('rejects non-integers', () => {
    expect(() =>
      validateAndNormalizeStorefrontCategoryIdField({ storefrontCategoryId: 1.5 }),
    ).toThrow(ValidationError);
  });

  it('ignores omitted field', () => {
    const data: Record<string, unknown> = { name: 'x' };
    validateAndNormalizeStorefrontCategoryIdField(data);
    expect(data).not.toHaveProperty('storefrontCategoryId');
  });
});
