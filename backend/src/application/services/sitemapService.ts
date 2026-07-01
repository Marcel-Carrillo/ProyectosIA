import { ProductService } from './productService';
import { CategoryService } from './categoryService';

export interface SitemapUrlEntry {
  /** Absolute URL, e.g. "https://mavile.es/catalog/12" */
  loc: string;
  /** ISO 8601 timestamp; omitted for entries with no natural updatedAt (root catalog, content pages) */
  lastmod?: string;
}

// Frontend-only static pages — not DB-backed, so no <lastmod>.
// Keep in sync with frontend/src/pages/storefront/ContentPage.tsx supported slugs.
export const STATIC_CONTENT_PAGE_SLUGS = [
  'shipping',
  'returns',
  'size-guide',
  'contact',
  'our-story',
  'materials',
  'sustainability',
  'press',
  'privacy',
  'legal',
] as const;

// Sitemap protocol ceiling is 50,000 URLs / 50MB. Cap product listing well
// below that; if the active catalog exceeds this, split into a sitemap index
// (see design.md Risks — deferred, not needed at current data volume).
const SITEMAP_MAX_PRODUCTS = 5000;

function getSiteBaseUrl(): string {
  // Mirrors customerAuthService.ts / oauthConfig.ts — same env var, same parsing.
  return (process.env.FRONTEND_URL ?? 'http://localhost:3001').split(',')[0]!.trim();
}

export class SitemapService {
  constructor(
    private readonly productService: ProductService,
    private readonly categoryService: CategoryService,
  ) {}

  async buildEntries(): Promise<SitemapUrlEntry[]> {
    const baseUrl = getSiteBaseUrl();

    const [productResult, categories] = await Promise.all([
      // Reuses the existing product-listing query (single $transaction call in
      // ProductRepository.findAll) — same pattern as GET /api/public/products.
      // Only id/updatedAt are read below; supplier fields on variants are never touched.
      this.productService.findAll({
        status: 'Active',
        pageSize: SITEMAP_MAX_PRODUCTS,
        sort: 'createdAt',
        order: 'asc',
      }),
      // Reuses the existing categories query — active-only by default, same as
      // GET /api/public/categories.
      this.categoryService.findAll(),
    ]);

    const entries: SitemapUrlEntry[] = [{ loc: `${baseUrl}/catalog` }];

    for (const product of productResult.items) {
      entries.push({
        loc: `${baseUrl}/catalog/${product.id}`,
        lastmod: product.updatedAt?.toISOString(),
      });
    }

    for (const category of categories) {
      entries.push({
        loc: `${baseUrl}/catalog?categoryId=${category.id}`,
        lastmod: category.updatedAt?.toISOString(),
      });
    }

    for (const slug of STATIC_CONTENT_PAGE_SLUGS) {
      entries.push({ loc: `${baseUrl}/pages/${slug}` });
    }

    return entries;
  }
}
