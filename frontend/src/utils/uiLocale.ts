export type UiLocale = 'es' | 'en';

/** Normalize i18n / Accept-Language values to the storefront's supported locales. */
export function getUiLocale(language?: string | null): UiLocale {
  const raw = (language ?? 'es').toLowerCase().trim();
  const tag = raw.split(/[-_]/)[0] || 'es';
  return tag === 'en' ? 'en' : 'es';
}
