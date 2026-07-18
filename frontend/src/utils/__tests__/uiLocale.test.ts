import { getUiLocale } from '../uiLocale';

describe('getUiLocale', () => {
  it('defaults to es', () => {
    expect(getUiLocale(undefined)).toBe('es');
    expect(getUiLocale(null)).toBe('es');
    expect(getUiLocale('')).toBe('es');
  });

  it('normalizes region tags', () => {
    expect(getUiLocale('es-ES')).toBe('es');
    expect(getUiLocale('en-US')).toBe('en');
  });

  it('falls back unknown locales to es', () => {
    expect(getUiLocale('fr')).toBe('es');
  });
});
