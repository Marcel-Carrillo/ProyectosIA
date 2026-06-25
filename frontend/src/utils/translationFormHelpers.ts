import { ProductTranslation } from '../types/product';

export function readTranslationField(
  translations: ProductTranslation[] | undefined,
  locale: 'en' | 'es',
  field: 'name' | 'description',
): string {
  const row = translations?.find((t) => t.locale === locale);
  if (!row) return '';
  const value = row[field];
  return value ?? '';
}

export function buildTranslationsPayload(fields: {
  name: string;
  description: string;
  nameEn: string;
  descriptionEn: string;
  nameEs: string;
  descriptionEs: string;
}): Array<{ locale: 'en' | 'es'; name: string; description?: string | null }> {
  const translations: Array<{ locale: 'en' | 'es'; name: string; description?: string | null }> = [];
  const enName = fields.nameEn.trim() || fields.name.trim();
  if (enName) {
    translations.push({
      locale: 'en',
      name: enName,
      description: fields.descriptionEn.trim() || fields.description || null,
    });
  }
  if (fields.nameEs.trim()) {
    translations.push({
      locale: 'es',
      name: fields.nameEs.trim(),
      description: fields.descriptionEs.trim() || null,
    });
  }
  return translations;
}
