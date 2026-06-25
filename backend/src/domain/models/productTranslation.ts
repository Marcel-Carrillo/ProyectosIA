export type TranslationSource = 'manual' | 'import' | 'machine';

export class ProductTranslation {
  id?: number;
  productId: number;
  locale: string;
  name: string;
  description: string | null;
  source: TranslationSource;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: {
    id?: number;
    productId: number;
    locale: string;
    name: string;
    description?: string | null;
    source?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.productId = data.productId;
    this.locale = data.locale;
    this.name = data.name;
    this.description = data.description ?? null;
    this.source = (data.source as TranslationSource) ?? 'manual';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
