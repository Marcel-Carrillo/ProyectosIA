## Context

The Mavile storefront UI is bilingual (ES/EN via i18next) but product content (`name`, `description`) is stored in a single language column on the `Product` table. The data currently in the DB is English (DummyJSON import + Mavile fashion seed). The frontend sends no locale information to the API; the API ignores language preference entirely.

The system uses:
- Backend: Node.js/TypeScript, Express 4, Prisma 6, PostgreSQL (AWS RDS), deployed as AWS Lambda via Serverless Framework.
- Frontend: React CRA, i18next (language key `mavile.lang`, supported: `en`/`es`), Axios for HTTP.
- Architecture: DDD, layered (Presentation → Application → Domain → Infrastructure), repository pattern.

The change affects all layers: DB schema, domain model, repository, service, serializer, controller, routes, and frontend service + components.

## Goals / Non-Goals

**Goals:**
- Add a `ProductTranslation` table with `(productId, locale, name, description, source)`.
- Keep `Product.name`/`description` as the English fallback; never remove them.
- Implement a centralized locale-resolution helper with a total, deterministic fallback chain.
- Make public product list and detail endpoints locale-aware via `Accept-Language`; add `Vary: Accept-Language`.
- Expose admin sub-routes to upsert/delete translations; include translations in admin read responses.
- Add `Accept-Language` interceptor to the frontend public product service and re-fetch on language change.
- Add per-locale name/description fields to the admin `ProductFormModal`.
- Provide an idempotent backfill script that seeds EN translations and machine-translates ES via LibreTranslate.
- Update `docs/data-model.md`, `docs/api-spec.yml`, `docs/development_guide.md`, and `docs/frontend-standards.md`.

**Non-Goals:**
- Localizing `brand`, `slug`, image `altText`, or category names.
- More than two locales in this change.
- Localized full-text search.
- Translation approval/workflow states.
- Auto-translate-on-save in the admin UI.
- Supplier integration changes.

## Decisions

### D1: Overlay table vs. moving fields out of `Product`
**Decision:** Keep `Product.name` and `Product.description` as the English fallback and add a separate `ProductTranslation` table for translations.

**Rationale:** Removing or nullifying `Product.name` would break the order snapshot logic (`productNameSnapshot` in `CustomerOrderItem`), any existing search that matches `Product.name`, and dozens of references across the codebase. The overlay approach adds translations without disturbing existing rows or column references, and it makes the fallback chain natural: if `ProductTranslation` has no row for the requested locale, fall through to `Product.name`.

**Alternative considered:** Move `name`/`description` entirely into `ProductTranslation`, make the `Product` columns nullable, and use a view. Rejected: higher migration risk, breaks snapshots and search, no tangible benefit for a two-locale MVP.

### D2: Locale resolution as a shared helper, not inline per-endpoint
**Decision:** Implement `resolveProductLocale(product, requestedLocale)` as a single utility used by both public and admin serializers.

**Rationale:** Ensures fallback behavior is identical everywhere and only needs to be unit-tested once. Prevents drift where the list endpoint and the detail endpoint behave differently.

**Location:** `backend/src/application/helpers/resolveProductLocale.ts`.

### D3: Eager include in a single Prisma query
**Decision:** All product repository methods that return product data must `include: { translations: true }` in the same Prisma query.

**Rationale:** Any lazy-load approach (e.g., a separate call per product) would produce an N+1 query on the list endpoint, which fetches potentially dozens of products. Eager include is standard Prisma practice and has negligible schema join cost for a small translations table.

**Note:** The include must be added to all existing repository methods that return products: `findAll`, `findById`, `findBySlug`, `findByCategory`, `search`.

### D4: `Vary: Accept-Language` response header
**Decision:** Add `Vary: Accept-Language` on all public product endpoints.

**Rationale:** Without this header, a CDN or reverse proxy (CloudFront, browser cache) may serve a cached EN response to an ES request (or vice versa). Since we are already behind CloudFront in production, this header is non-negotiable.

**Implementation:** Applied in the public product controller via `res.set('Vary', 'Accept-Language')` before the JSON response.

### D5: `source` field on `ProductTranslation`
**Decision:** Add a `source` varchar(20) field with values `manual`, `import`, `machine`.

**Rationale:** Machine-translated ES content (via LibreTranslate) is draft quality. Marking it `machine` allows admins to identify and curate low-quality translations without re-running the entire backfill. The field has no effect on read-time resolution — it is metadata only.

### D6: Backfill script as a standalone TypeScript script, not a Prisma seed
**Decision:** Implement as `backend/scripts/backfillProductTranslations.ts`, runnable via `npx ts-node` directly, separate from `prisma/seed.ts`.

**Rationale:** The seed is run automatically on every deploy via `prisma db seed`. The backfill is a one-off operation with external HTTP calls (LibreTranslate) and should not be triggered on every deployment. Keeping it separate avoids accidentally re-running translation API calls in CI.

**Run command (to document in `docs/development_guide.md`):**
```
LIBRETRANSLATE_URL=http://localhost:5000 npx ts-node backend/scripts/backfillProductTranslations.ts
```

### D7: Frontend interceptor on Axios public product service
**Decision:** Add an Axios request interceptor on the public `productService` (or a shared Axios instance used by public product calls) that injects `Accept-Language: i18n.language`.

**Rationale:** A request interceptor is the least invasive, most DRY approach — no per-call change in individual hook or component files. A single point of change that covers all product fetches.

**Note:** The admin service already uses a similar pattern for the Authorization header.

### D8: Re-fetch on language change using `i18n.language` as a `useEffect` dependency
**Decision:** Pass `i18n.language` as a dependency to the `useEffect` hooks in `ProductsPage`, `ProductDetailPage`, and any hook that fetches product data.

**Rationale:** This is idiomatic React. When `i18n.language` changes, the effect re-runs and fetches fresh data from the API with the new `Accept-Language` header. No additional event subscription is required.

## Risks / Trade-offs

**[Risk] Performance regression on product list query** → The added `include: { translations: true }` adds a join/subquery to what was a simple product list fetch. Mitigation: the `ProductTranslation` table is small and indexed on `productId`; the single eager include is standard Prisma practice and should not cause measurable latency regression on the scale of this catalog. Add a `@@index([productId])` index.

**[Risk] LibreTranslate availability during backfill** → The free LibreTranslate public instance may be rate-limited or unavailable. Mitigation: the backfill script is idempotent and resumable; it skips-and-logs on per-product failure and can be re-run after partial completion.

**[Risk] Machine ES name exceeds 150-char limit** → ES text is typically 15–30% longer. Mitigation: the script enforces the limit by truncating to 150 characters and logging a warning.

**[Risk] `Vary: Accept-Language` not yet set on CloudFront** → CloudFront caches by URL path by default. Adding `Vary` in the response header alone is not sufficient; CloudFront must also be configured to forward and vary on `Accept-Language`. Mitigation: document as a post-deploy CloudFront cache behavior step in `docs/development_guide.md`. For the MVP, CloudFront TTL for API responses is typically 0 (API Gateway + Lambda with no-cache default), so caching is not an immediate issue.

**[Risk] Localized search limitation surprises users** → Public search still matches `Product.name` (English). Mitigation: document explicitly in `docs/api-spec.yml` as a known limitation; add a TODO comment in the search controller.

**[Trade-off] Two-locale hard-code** → The `locale` field is a free varchar, but validation currently only accepts `en`/`es`. Adding a third locale requires a validator update and a new backfill run, but no schema migration.

## Migration Plan

1. **Deploy backend:** apply Prisma migration (`add_product_translation` migration file) via `prisma migrate deploy` in CI/CD — no downtime; the new table is additive.
2. **Deploy frontend:** the interceptor and re-fetch logic is backwards-compatible (if the backend returns the old mono-lingual name, it still displays).
3. **Run backfill (ops, once):** execute `backfillProductTranslations.ts` against production RDS after the backend deploy. Review the summary report.
4. **Verify:** curl the public product list with `Accept-Language: es` and confirm Spanish names appear.

**Rollback:**
- Revert the backend deploy; the `ProductTranslation` table can be left in place (it is additive and harmless).
- If the table must be removed, run: `DROP TABLE "ProductTranslation";` — no FK dependency from any other table (cascade is from `Product` to `ProductTranslation`, not the reverse).

## Open Questions

- **LibreTranslate instance:** Will we use the public free instance or self-host? The public instance has rate limits. Document the chosen URL in `docs/development_guide.md`.
- **CloudFront `Accept-Language` forwarding:** Does the current CloudFront distribution forward the `Accept-Language` header to API Gateway? If not, the `Vary` header is moot and the CDN may serve the wrong language. Needs verification post-deploy.
- **ES translation quality review process:** Who reviews and corrects machine-translated ES content? Should the admin panel surface the `source` field as a badge? Deferred, but worth tracking.
