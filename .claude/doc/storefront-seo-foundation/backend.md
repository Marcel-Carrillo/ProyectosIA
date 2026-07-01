# Backend Implementation Plan — storefront-seo-foundation (Task Group 6)

Scope: `GET /api/public/sitemap.xml` only (tasks 6.1–6.5 in
`openspec/changes/storefront-seo-foundation/tasks.md`). Planning only — no
implementation performed.

## Context already verified in the codebase

- Public routers follow a strict Router → Controller → Service → Repository
  layering, one router per resource, mounted individually in
  `backend/src/index.ts` (e.g. `app.use('/api/public/products', productPublicRoutes)`).
  `backend/src/routes/index.ts` re-exports each router as a named barrel export.
- `ProductService.findAll(filters)` (`backend/src/application/services/productService.ts`)
  delegates to `ProductRepository.findAll` (`backend/src/infrastructure/repositories/productRepository.ts:71-116`),
  which already does a single `prisma.$transaction([findMany, count])` call with
  `include: { variants, translations }` — i.e. the existing "avoid N+1" pattern the
  task wants reused. Calling it with `{ status: 'Active', pageSize: <cap> }` is
  sufficient; **no new repository method is needed**.
- `CategoryService.findAll(includeInactive = false)` → `CategoryRepository.findAll`
  (`backend/src/infrastructure/repositories/categoryRepository.ts:33-37`) already
  does a single `prisma.category.findMany` restricted to `status: 'Active'` by
  default — this is exactly what `GET /api/public/categories` uses today. Reuse
  it as-is.
- `PublicProductDTO` (`backend/src/presentation/serializers/publicProduct.ts`)
  proves `id` and `updatedAt` are already customer-safe/public fields. The
  sitemap will read only `product.id` and `product.updatedAt` off the `Product`
  domain entities returned by `ProductService.findAll` — it never touches
  `variants[].supplierId/supplierReference/supplierCost` or any other field, so
  there is no risk of leaking supplier data even though the underlying query
  happens to fetch variants for its own unrelated reasons.
- Backend already has a same-purpose "public site origin" convention: three
  files (`application/services/customerAuthService.ts:19`,
  `infrastructure/auth/oauthConfig.ts:45`, `index.ts:71`) all derive the
  storefront's public base URL the same way:
  `(process.env.FRONTEND_URL ?? 'http://localhost:3001').split(',')[0].trim()`.
  The frontend's `REACT_APP_SITE_URL` (introduced elsewhere in this change) is a
  separate, build-time-only CRA variable and is **not** readable from the
  backend process — do NOT try to share it. Reuse `FRONTEND_URL` server-side,
  matching the existing three call sites. No new backend env var required.
- Category detail has no dedicated public route; `CatalogPage.tsx:34` reads
  `categoryId` from `useSearchParams()` on `/catalog`. So each category's
  sitemap URL must be `/catalog?categoryId={id}`, not `/categories/{id}`.
- Static content-page slugs (frontend-only, not DB-backed): `shipping`,
  `returns`, `size-guide`, `contact`, `our-story`, `materials`,
  `sustainability`, `press`, `privacy`, `legal` → each becomes `/pages/{slug}`
  with no `<lastmod>` (no backing entity has an `updatedAt`).
- Errors in this route should still flow through the existing
  `next(err) → globalErrorHandler` (`backend/src/middleware/errorHandler.ts:214`),
  which always responds with JSON — that's fine and expected; only the
  **success** response must be `application/xml`.

## Files to create

### 1. `backend/src/application/services/sitemapService.ts` (new)

Application-layer orchestration. No new domain entity/repository — this is a
read-only composition over two existing services, which is consistent with
"Domain Services... coordinate multiple entities" guidance in
`docs/backend-standards.md`, but since it produces no business invariants of
its own and only aggregates presentation data, it stays in the application
layer (mirrors how `productService`/`categoryService` are consumed elsewhere,
not a new aggregate root).

```typescript
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

// Sitemap protocol has no hard limit here, but 50,000 URLs / 50MB is the spec
// ceiling. Cap product listing well below that; if the active catalog exceeds
// this, split into a sitemap index (see design.md Risks — deferred, not needed
// at current data volume).
const SITEMAP_MAX_PRODUCTS = 5000;

function getSiteBaseUrl(): string {
  // Mirrors customerAuthService.ts / oauthConfig.ts — same env var, same parsing.
  return (process.env.FRONTEND_URL ?? 'http://localhost:3001').split(',')[0].trim();
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
      // Only `id`/`updatedAt` are read below; supplier fields on `variants` are
      // never touched.
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
```

### 2. `backend/src/presentation/serializers/sitemapXml.ts` (new)

Pure XML templating — mirrors the existing `serializers/publicProduct.ts`
allow-list style, but here the "allow-list" is structural (only `loc`/`lastmod`
ever get written).

```typescript
import { SitemapUrlEntry } from '../../application/services/sitemapService';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderSitemapXml(entries: SitemapUrlEntry[]): string {
  const urlNodes = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : '';
      return `  <url><loc>${escapeXml(entry.loc)}</loc>${lastmod}</url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlNodes}\n</urlset>\n`;
}
```

No new dependency needed (no `xmlbuilder`/`sitemap` package) — output is small
and structurally trivial, so hand-rolled templating keeps `package.json`
untouched, consistent with `docs/backend-standards.md`'s dependency-hygiene
note (every new runtime import must be declared; avoid it if unnecessary).

### 3. `backend/src/presentation/controllers/publicSitemapController.ts` (new)

Thin controller, same shape as `publicProductController.ts`/`categoryController.ts`
(module-level service instantiation, `try { } catch { next(err) }`).

```typescript
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

export async function getPublicSitemap(req: Request, res: Response, next: NextFunction): Promise<void> {
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
```

Signature note: `req` is unused but kept for consistency with the other public
controllers and Express's handler signature; ESLint's
`@typescript-eslint/no-unused-vars` allows unused function params by default
for Express handlers in this codebase (see `listCategories(req, res, next)`
above which also ignores `req` in some branches) — if lint complains, rename to
`_req`.

### 4. `backend/src/routes/public/sitemapRoutes.ts` (new)

Same shape as `categoryRoutes.ts` — one line, no extra middleware (public,
unauthenticated, no params).

```typescript
import { Router } from 'express';
import { getPublicSitemap } from '../../presentation/controllers/publicSitemapController';

const router = Router();

router.get('/', getPublicSitemap);

export default router;
```

## Files to modify

### 5. `backend/src/routes/index.ts`

Add one export line next to the other public routers:

```typescript
export { default as sitemapPublicRoutes } from './public/sitemapRoutes';
```

(This barrel export currently isn't imported from in `index.ts` — `index.ts`
imports each public router directly via its own path, e.g.
`import productPublicRoutes from './routes/public/productRoutes';`. Add the
barrel export anyway for consistency with the existing `categoryPublicRoutes`
entry already present there, but the actual wiring happens via the direct
import below.)

### 6. `backend/src/index.ts`

Add the direct import near the other public route imports (after line 19,
`categoryPublicRoutes`):

```typescript
import sitemapPublicRoutes from './routes/public/sitemapRoutes';
```

Add the mount line in the `/api/public routes` block (after
`app.use('/api/public/categories', categoryPublicRoutes);`):

```typescript
app.use('/api/public/sitemap.xml', sitemapPublicRoutes);
```

This mirrors the existing pattern exactly: mount path = full public path,
router itself only defines `/`.

### 7. `docs/api-spec.yml`

Add a new path entry directly after the existing `/api/public/categories`
block (around line 1176, before `/api/admin/customers`):

```yaml
  /api/public/sitemap.xml:
    get:
      summary: Dynamic XML sitemap (public storefront)
      description: >
        Generates an XML sitemap (sitemaps.org 0.9 schema) listing the public
        storefront catalog: `/catalog`, one `<url>` per Active-status product
        (`/catalog/{id}`), one per category (`/catalog?categoryId={id}`), and
        one per static content-page slug (`/pages/{slug}`). Each product and
        category entry includes `<lastmod>` derived from its `updatedAt`. This
        endpoint is public and unauthenticated. The response is NEVER JSON and
        NEVER includes `supplierId`, `supplierReference`, or `supplierCost`.
      tags:
        - Public — Catalog
      responses:
        '200':
          description: Sitemap generated successfully
          content:
            application/xml:
              schema:
                type: string
                description: XML document conforming to the sitemaps.org 0.9 urlset schema
        '500':
          $ref: '#/components/responses/InternalServerError'
```

No new schema needs registering under `components.schemas` (plain string
body, not a JSON DTO) and no new shared `components.responses` entry (reuses
`InternalServerError`, already defined) — so this stays a self-contained
addition per the "every `$ref` must resolve" rule in
`docs/backend-standards.md`.

## Unit tests to add

Follow the `__tests__/` subfolder + `jest.mock()` module-mocking convention
already used by `productService.test.ts`, `publicProductController.test.ts`,
and `categoryRoutes.test.ts` (all read above). Target: 90% coverage per
`docs/backend-standards.md`.

### A. `backend/src/application/services/__tests__/sitemapService.test.ts`

Mock `ProductService` and `CategoryService` as plain objects with a
`findAll` jest.fn each (constructor-injected, no `jest.mock()` module mock
needed since `SitemapService` takes them as constructor params — same
DI-friendly style as `ProductService`/`CategoryService` themselves).

Cases:
- `should_include_catalog_root_entry_always` — even with empty products/categories, result contains `{ loc: '<baseUrl>/catalog' }` with no `lastmod`.
- `should_include_one_entry_per_active_product_with_lastmod_from_updatedAt` — stub `productService.findAll` to resolve `{ items: [Product{id:1, updatedAt: <date>}, ...], total, page, pageSize }`; assert `loc` = `${baseUrl}/catalog/1` and `lastmod` = `updatedAt.toISOString()`.
- `should_call_productService_findAll_with_status_Active` — assert `productService.findAll` was called with `expect.objectContaining({ status: 'Active' })` (this is what guarantees Draft/Inactive/Archived are excluded — the filtering itself is `ProductService`'s existing, already-tested responsibility, so this test only verifies the sitemap service asks for the right filter).
- `should_include_one_entry_per_category_with_lastmod_from_updatedAt` — stub `categoryService.findAll` to resolve `[Category{id:5, updatedAt}]`; assert `loc` = `${baseUrl}/catalog?categoryId=5`.
- `should_include_all_static_content_page_slugs_with_no_lastmod` — assert every slug in `STATIC_CONTENT_PAGE_SLUGS` appears as `${baseUrl}/pages/{slug}` with `lastmod` undefined.
- `should_use_FRONTEND_URL_env_var_as_base_url` — set `process.env.FRONTEND_URL = 'https://example.test'` before constructing, assert every `loc` starts with it; restore env after.
- `should_never_include_supplier_fields_in_any_entry` — defensive: `JSON.stringify(entries)` must not match `/supplierId|supplierReference|supplierCost/i`.

### B. `backend/src/presentation/serializers/__tests__/sitemapXml.test.ts`

(Mirrors `serializers/__tests__/publicProduct.test.ts` location convention.)

- `should_produce_valid_xml_with_urlset_root_and_xml_declaration` — parse the
  output with a lightweight check (e.g. `xml2js` if already a devDependency —
  **verify first**; if not present, assert via string/regex on
  `<?xml version="1.0" encoding="UTF-8"?>` and `<urlset xmlns=...>...</urlset>`
  rather than adding a new parsing dependency just for this test).
- `should_render_one_url_element_per_entry`.
- `should_omit_lastmod_element_when_entry_has_no_lastmod`.
- `should_include_lastmod_element_when_entry_has_lastmod`.
- `should_escape_xml_special_characters_in_loc` — feed a `loc` containing `&` and assert `&amp;` in output (defensive; current real inputs never contain these, but the escaper must be verified directly).

  **Before writing this test file, check whether `xml2js` or any XML parser is
  already a devDependency** (`grep -n "xml2js\|fast-xml-parser" backend/package.json`).
  If absent, do NOT add one — assert on the string structure instead. This
  keeps the "no new dependency" decision from section 2 consistent between
  implementation and tests.

### C. `backend/src/presentation/controllers/__tests__/publicSitemapController.test.ts`

Same `jest.mock()` shape as `publicProductController.test.ts`: mock
`SitemapService` (module-level `jest.mock('../../../application/services/sitemapService', ...)`
with `SitemapService: jest.fn().mockImplementation(() => ({ buildEntries: mockBuildEntries }))`),
and mock the four repository/service constructors it transitively imports
(`ProductService`, `ProductRepository`, `ProductVariantRepository`,
`ProductTranslationRepository`, `CategoryService`, `CategoryRepository`) as
empty-object constructors, exactly like `publicProductController.test.ts` does
for its own dependency chain — this avoids ever touching Prisma in this test.

Cases:
- `should_return_200_with_application_xml_content_type` — stub `mockBuildEntries` to resolve a small entries array; call `getPublicSitemap(req, res, next)`; assert `res.setHeader` called with `('Content-Type', 'application/xml')`, `res.status` called with `200`, `res.send` called with a string containing `<urlset`.
- `should_call_next_with_error_when_service_throws` — stub `mockBuildEntries` to reject; assert `next` called with that error and `res.send` never called.

### D. `backend/src/routes/public/__tests__/sitemapRoutes.test.ts`

Same `supertest` + `jest.mock()` shape as `categoryRoutes.test.ts`:

```typescript
import request from 'supertest';
import express from 'express';

const mockBuildEntries = jest.fn();

jest.mock('../../../application/services/sitemapService', () => ({
  SitemapService: jest.fn().mockImplementation(() => ({ buildEntries: mockBuildEntries })),
}));
jest.mock('../../../application/services/productService', () => ({
  ProductService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/productRepository', () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/productVariantRepository', () => ({
  ProductVariantRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/productTranslationRepository', () => ({
  ProductTranslationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../application/services/categoryService', () => ({
  CategoryService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../infrastructure/repositories/categoryRepository', () => ({
  CategoryRepository: jest.fn().mockImplementation(() => ({})),
}));

import sitemapPublicRoutes from '../sitemapRoutes';

const app = express();
app.use('/api/public/sitemap.xml', sitemapPublicRoutes);
```

Cases:
- `should_return_200_and_application_xml_for_GET_sitemap_xml` — assert
  `res.status === 200` and `res.headers['content-type']` starts with
  `application/xml`.
- `should_include_catalog_url_and_at_least_one_product_and_content_page_entry_in_body` — stub entries with one product, one category, one content-page slug; assert `res.text` contains `/catalog<`, the product path, and a `/pages/` path.
- `should_not_contain_supplier_fields_in_response_body` — regex-assert `res.text` never matches `supplierId|supplierReference|supplierCost` (this is the route-level version of requirement scenario "Sitemap response contains no supplier data" from `specs/storefront-seo/spec.md`).

### E. Update existing tests (task 7.1 — flagged for the parent session, not this plan)

`backend/src/routes/public/__tests__/` currently has no file that asserts on
the full list of mounted `/api/public/*` routers, so no existing test should
need updating for this specific endpoint. Double-check
`backend/src/index.ts`-level integration tests (if any exist under a
different path, e.g. `backend/src/__tests__/` or `app.test.ts`) don't
snapshot the full route list in a way this addition would break — search for
`describe.*app\b` or a route-count assertion before finalizing task 7.1.

## Verification commands (for the parent/implementing session)

```bash
cd backend
npm run lint
npm test -- --watchAll=false --testPathPattern=sitemap
```

Then curl-level check (task 9): confirm `Content-Type: application/xml`,
status `200`, and that the body contains `/catalog`, at least one
`/catalog/{id}` product URL, and at least one `/pages/{slug}` URL, and does
**not** contain `supplierId`, `supplierReference`, or `supplierCost`.

## Key risks / things the implementer must not skip

1. **Do not add a new repository method.** `ProductService.findAll` +
   `CategoryService.findAll` already satisfy "reuse existing pattern, avoid
   N+1" — adding a parallel lean query method would duplicate logic without
   benefit at current catalog scale (see `SITEMAP_MAX_PRODUCTS` comment).
2. **Do not read `REACT_APP_SITE_URL`** from the backend — it's a frontend
   build-time variable and won't exist in the Node process. Use `FRONTEND_URL`
   exactly like `customerAuthService.ts`/`oauthConfig.ts` already do.
3. **Category URL is `/catalog?categoryId={id}`, not `/categories/{id}`** —
   there is no dedicated public category-detail route in the frontend.
4. **Success response must never go through `res.json()`** — use
   `res.setHeader('Content-Type', 'application/xml')` + `res.send(xml)`;
   errors still go through the existing JSON `globalErrorHandler` via
   `next(err)`, which is fine and expected (only the happy path differs).
5. **Verify `xml2js`/`fast-xml-parser` is not already present before adding
   one just for tests** — prefer string/regex assertions to avoid an
   unnecessary new devDependency per `docs/backend-standards.md`'s dependency
   hygiene section.
