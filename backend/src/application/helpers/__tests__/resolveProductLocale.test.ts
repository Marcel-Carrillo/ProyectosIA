import { resolveProductLocale, normalizeLocale } from '../resolveProductLocale';
import { Product } from '../../../domain/models/product';
import { ProductTranslation } from '../../../domain/models/productTranslation';

function makeProduct(overrides: Partial<ConstructorParameters<typeof Product>[0]> = {}): Product {
  return new Product({
    id: 1,
    name: 'Test Product',
    slug: 'test-product',
    description: 'English description',
    status: 'Active',
    ...overrides,
  });
}

function makeTranslation(locale: string, name: string, description?: string | null): ProductTranslation {
  return new ProductTranslation({ id: 1, productId: 1, locale, name, description: description ?? null });
}

describe('normalizeLocale', () => {
  // The store's default language is Spanish — mirror the storefront fallback.
  it('returns es for undefined', () => expect(normalizeLocale(undefined)).toBe('es'));
  it('returns es for null', () => expect(normalizeLocale(null)).toBe('es'));
  it('returns es for empty string', () => expect(normalizeLocale('')).toBe('es'));
  it('returns es for unknown locale fr', () => expect(normalizeLocale('fr')).toBe('es'));
  it('strips region tag es-ES', () => expect(normalizeLocale('es-ES')).toBe('es'));
  it('strips region tag es-419', () => expect(normalizeLocale('es-419')).toBe('es'));
  it('handles en-US', () => expect(normalizeLocale('en-US')).toBe('en'));
});

describe('resolveProductLocale', () => {
  it('returns exact ES match when ES translation exists', () => {
    const product = makeProduct({ translations: [makeTranslation('es', 'Producto ES', 'Desc ES')] });
    const result = resolveProductLocale(product, 'es');
    expect(result).toEqual({ name: 'Producto ES', description: 'Desc ES', locale: 'es' });
  });

  it('returns exact EN match when EN translation exists', () => {
    const product = makeProduct({ translations: [makeTranslation('en', 'Product EN', 'Desc EN')] });
    const result = resolveProductLocale(product, 'en');
    expect(result).toEqual({ name: 'Product EN', description: 'Desc EN', locale: 'en' });
  });

  it('falls back to EN translation when ES is requested but missing', () => {
    const product = makeProduct({ translations: [makeTranslation('en', 'Fallback EN', 'Fallback Desc')] });
    const result = resolveProductLocale(product, 'es');
    expect(result).toEqual({ name: 'Fallback EN', description: 'Fallback Desc', locale: 'en' });
  });

  it('falls back to Product.name when both ES and EN translations are missing', () => {
    const product = makeProduct({ translations: [] });
    const result = resolveProductLocale(product, 'es');
    expect(result).toEqual({ name: 'Test Product', description: 'English description', locale: 'en' });
  });

  it('resolves unknown locale fr to the Spanish default, then falls back to Product.name', () => {
    const product = makeProduct({ translations: [] });
    const result = resolveProductLocale(product, 'fr');
    expect(result).toEqual({ name: 'Test Product', description: 'English description', locale: 'en' });
  });

  it('serves the Spanish translation when no locale is requested', () => {
    const product = makeProduct({ translations: [makeTranslation('es', 'Producto ES', 'Desc ES')] });
    const result = resolveProductLocale(product, undefined);
    expect(result).toEqual({ name: 'Producto ES', description: 'Desc ES', locale: 'es' });
  });

  it('uses Product.name when translations is undefined', () => {
    const product = makeProduct();
    const result = resolveProductLocale(product, 'es');
    expect(result).toEqual({ name: 'Test Product', description: 'English description', locale: 'en' });
  });

  it('handles region-stripped locale es-419', () => {
    const product = makeProduct({ translations: [makeTranslation('es', 'Producto ES')] });
    const result = resolveProductLocale(product, 'es-419');
    expect(result.name).toBe('Producto ES');
  });

  it('returns null description when translation has no description', () => {
    const product = makeProduct({ translations: [makeTranslation('es', 'Producto ES', null)] });
    const result = resolveProductLocale(product, 'es');
    expect(result.description).toBeNull();
  });
});
