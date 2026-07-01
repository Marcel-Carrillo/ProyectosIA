import { Request, Response, NextFunction } from 'express';
import { SitemapService } from '../../application/services/sitemapService';
import { ProductService } from '../../application/services/productService';
import { ProductRepository } from '../../infrastructure/repositories/productRepository';
import { ProductVariantRepository } from '../../infrastructure/repositories/productVariantRepository';
import { ProductTranslationRepository } from '../../infrastructure/repositories/productTranslationRepository';
import { CategoryService } from '../../application/services/categoryService';
import { CategoryRepository } from '../../infrastructure/repositories/categoryRepository';
import { renderSitemapXml } from '../serializers/sitemapXml';
import { logger } from '../../infrastructure/logger';

const productService = new ProductService(
  new ProductRepository(),
  new ProductVariantRepository(),
  new ProductTranslationRepository(),
);
const categoryService = new CategoryService(new CategoryRepository());
const sitemapService = new SitemapService(productService, categoryService);

export async function getPublicSitemap(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entries = await sitemapService.buildEntries();
    const xml = renderSitemapXml(entries);
    logger.info('Public sitemap generated', { urlCount: entries.length });
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (err) {
    next(err);
  }
}
