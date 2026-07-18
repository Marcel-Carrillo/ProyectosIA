import { Product } from '../../domain/models/product';
import { ProductTranslation } from '../../domain/models/productTranslation';

const SUPPORTED_LOCALES = ['en', 'es'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// The storefront's default language is Spanish (frontend i18n fallbackLng:
// 'es'), so requests without a usable Accept-Language get Spanish content too.
// Base Product.name/description remain the last-resort fallback (imported
// catalogs are English), reported as locale 'en'.
const DEFAULT_LOCALE: SupportedLocale = 'es';

export function normalizeLocale(raw: string | string[] | undefined | null): SupportedLocale {
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) return DEFAULT_LOCALE;

  // Accept-Language may be a quality list: "es-ES,es;q=0.9,en;q=0.8".
  // Prefer the first supported tag in client preference order.
  const candidates = header
    .toLowerCase()
    .split(',')
    .map((part) => {
      const [tagPart] = part.trim().split(';');
      return (tagPart ?? '').split('-')[0] ?? '';
    })
    .filter(Boolean);

  for (const tag of candidates) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(tag)) {
      return tag as SupportedLocale;
    }
  }

  return DEFAULT_LOCALE;
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
