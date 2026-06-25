import { ProductTranslation } from '../models/productTranslation';

export interface TranslationUpsertData {
  name: string;
  description?: string | null;
  source?: string;
}

export interface IProductTranslationRepository {
  upsert(productId: number, locale: string, data: TranslationUpsertData): Promise<ProductTranslation>;
  findByProduct(productId: number): Promise<ProductTranslation[]>;
  findByProductAndLocale(productId: number, locale: string): Promise<ProductTranslation | null>;
  delete(productId: number, locale: string): Promise<void>;
}
