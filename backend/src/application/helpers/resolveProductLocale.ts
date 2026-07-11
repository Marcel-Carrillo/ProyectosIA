import { Product } from '../../domain/models/product';
import { ProductTranslation } from '../../domain/models/productTranslation';

const SUPPORTED_LOCALES = ['en', 'es'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// The storefront's default language is Spanish (frontend i18n fallbackLng:
// 'es'), so requests without a usable Accept-Language get Spanish content too.
// Base Product.name/description remain the last-resort fallback (imported
// catalogs are English), reported as locale 'en'.
const DEFAULT_LOCALE: SupportedLocale = 'es';

export function normalizeLocale(raw: string | undefined | null): SupportedLocale {
  if (!raw) return DEFAULT_LOCALE;
  const tag = raw.toLowerCase().split('-')[0]!;
  return (SUPPORTED_LOCALES as readonly string[]).includes(tag)
    ? (tag as SupportedLocale)
    : DEFAULT_LOCALE;
}

export interface ResolvedProductContent {
  name: string;
  description: string | null;
  locale: string;
}

export function resolveProductLocale(
  product: Product,
  requestedLocale: string | undefined | null,
): ResolvedProductContent {
  const locale = normalizeLocale(requestedLocale);
  const translations = product.translations ?? [];
  const byLocale = (l: string) => translations.find((t: ProductTranslation) => t.locale === l);

  const exact = byLocale(locale);
  if (exact) {
    return { name: exact.name, description: exact.description, locale };
  }

  if (locale !== 'en') {
    const fallback = byLocale('en');
    if (fallback) {
      return { name: fallback.name, description: fallback.description, locale: 'en' };
    }
  }

  return { name: product.name, description: product.description ?? null, locale: 'en' };
}
