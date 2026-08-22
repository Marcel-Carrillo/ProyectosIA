# Product Strategy Analyst — Storefront UI (Inditex-style)

## Executive summary
The request is a customer-facing storefront UI, not a restyle of the existing admin panel.
The current frontend is an internal admin skeleton (dark navbar "Admin", routes for
suppliers/customers/orders/shipments/refunds, "Coming soon" pages, services throwing
"Not implemented"). A public shopping surface does not exist yet. This is a net-new
customer-facing layer that consumes the existing public read endpoints
(`GET /products`, `GET /products/{id}`, `GET /categories`).

## Problem and user value
- Shoppers have no way to browse the catalog; the only UI is internal.
- Value: a clean, minimalist, fashion-forward catalog experience (Zara/Inditex aesthetic)
  that builds trust and drives discovery and conversion for a brand with no physical store.

## Target segments
- Primary: women 20–45, fashion-aware, mobile-first, used to Zara/Mango/H&M UX.
- Secondary: returning customers checking new arrivals.
- Internal (separate persona, already served): store admins — out of scope here.

## MVP scope recommendation
- In: public storefront shell (header/nav/footer), category navigation, product grid
  (listing + filters/sort/pagination/search), product detail (gallery, variant/size/color
  selection, price + compare-at), responsive design system (typography, neutral palette,
  whitespace), loading/empty/error states.
- Out (next phases): cart, checkout, customer accounts, wishlist, search-as-you-type,
  CMS-driven home content. No backend changes required for MVP.

## Fit with supplier-fulfilled model
- Fully compatible. Catalog browsing does not assume internal stock.
- Critical invariant: never surface supplierId/supplierReference/supplierCost. Already
  enforced at the Prisma select layer; the storefront must also avoid requesting/using
  any admin-only fields and must only show Active products.

## Assumptions and risks
- RISK: prompt says "Vite", but the project is Create React App (react-scripts 5.0.1).
  Migrating to Vite is a stack change requiring explicit approval (base-standards §12).
  Assumption for MVP: stay on CRA unless approved.
- RISK: introducing a heavy UI kit/Tailwind conflicts with the mandated React-Bootstrap
  stack. Recommend a lightweight custom design-token CSS layer over Bootstrap rather than
  swapping frameworks.
- RISK: admin and storefront share one app/routing; need clear separation of layouts.
- ASSUMPTION: product images and prices (variant publicPrice/compareAtPrice) are
  populated enough to render an attractive grid; otherwise placeholders needed.

## Success metrics
- Catalog page render < 2.5s LCP on mobile; product grid usable at 360px width.
- Bounce rate on listing, product-detail view rate, add-to-(future)-cart intent clicks.
- Accessibility: keyboard-navigable, alt text on all product images, AA contrast.

## Next steps
1. Confirm CRA-vs-Vite decision and UI styling approach (tokens over Bootstrap).
2. Define public storefront route namespace separate from `/admin`.
3. Implement design system + storefront shell, then listing, then detail.

---

# Product Strategy Analyst — Backlog-wide review (Jira KAN, 2026-06-17)

> Scope: full review of the Jira backlog (project MiProyectoIA / key KAN) against the
> delivered repo, refining features/subtasks and identifying missing tickets. Business
> model: supplier-fulfilled women's fashion ecommerce (no own warehouse at MVP).

## Executive summary
- The backlog is well-structured around milestones M0–M6 (Epic → Feature → parallel
  Backend/Frontend/Integration subtasks), and the OpenSpec mapping is consistent.
- **Reality vs board (now reconciled):** M0, the admin catalog (products + categories),
  and the **public storefront catalog + product detail** are already delivered in
  `master`, but only catalog/categories had Jira features. The storefront delivery had
  **no feature ticket** — a tracking gap, now closed.
- **Three features are missing entirely** (already flagged in `docs/jira-workflow.md` as
  "to add manually"): public storefront catalog (M5), return-request management (M4),
  and production deployment/monitoring (M6).
- **Biggest strategic risk is sequencing + a cross-cutting prerequisite (admin auth),**
  not missing scope. The order infrastructure (Customer → CustomerOrder → SupplierOrder)
  must exist before Checkout MVP can create real orders, and every admin surface built so
  far is unauthenticated.

## Delivered vs planned (ground truth)
| Domain | Data model | Backend API | Frontend | Jira |
|--------|-----------|-------------|----------|------|
| Category | ✅ | ✅ admin + public | ✅ | KAN-11 ✅ |
| Product / Variant / Image | ✅ | ✅ admin + public | ✅ admin panel + storefront | KAN-2 ✅ |
| **Public storefront (catalog + PDP)** | n/a | ✅ `/api/public/*` | ✅ | **missing → created** |
| Supplier | ✅ (Prisma model only) | ❌ | ❌ | KAN-14 (todo) |
| Customer / Address | designed in `data-model.md` | ❌ | ❌ | KAN-17 |
| CustomerOrder / Item | designed | ❌ | ❌ | KAN-18 |
| SupplierOrder / Item | designed | ❌ | ❌ | KAN-19 |
| Shipment | designed | ❌ | ❌ | KAN-22 |
| ReturnRequest | designed | ❌ | ❌ | **missing → created** |
| Refund | designed | ❌ | ❌ | KAN-20 |
| Admin auth | — | ❌ | ❌ | KAN-23 |
| Deployment / monitoring | — | ❌ | ❌ | **missing → created** |

## Findings & refinements

### 1. Tracking gap: storefront delivered without a feature (M5)
The public storefront (browse catalog, product detail, real imported products via
`/api/public/*`) shipped through OpenSpec changes `modern-frontend-ui` +
`storefront-real-products` (+ `frontend-responsive-ui`) and PRs #9/#12, but M5 only
contained KAN-21 (Checkout). **Action:** create "Public storefront catalog" feature under
KAN-7 and mark it Finalizado. This makes M5 honestly "catalog done, checkout pending."

### 2. Returns ≠ Refunds (M4)
`data-model.md` models `ReturnRequest` and `Refund` as distinct entities with distinct
lifecycles (a return is the customer request/RMA; a refund is the money movement, which
can also occur without a physical return). M4 only had KAN-20 (Refund). **Action:** create
"Return request management" feature under KAN-8. Returns generally precede refunds in the
flow, so KAN-20 (Refund) should depend on it.

### 3. Production hardening is more than auth (M6)
KAN-23 covers admin authentication only; M6's own description includes env/secrets, AWS
Serverless deploy, monitoring and smoke tests. **Action:** create "Production deployment &
monitoring" feature under KAN-10, separate from auth.

### 4. Subtasks: keep just-in-time (project convention honored)
`jira-workflow.md` states subtasks are added "when starting" / "before parallel work".
Therefore I deliberately did **not** mass-create Backend/Frontend/Integration subtasks for
not-yet-started features (KAN-14–22). Recommended pattern when each is picked up:
`[Backend] <X> API`, `[Frontend] <X> UI`, `[Integration] merge + E2E + PR`, labels
`backend|frontend|integration`, `parallel-agent`, `openspec`. Note KAN-14 currently has
Backend+Frontend but no Integration subtask — add it when supplier work starts.

### 5. Supplier is half-modeled
The `Supplier` Prisma model exists but has no API/UI. KAN-14 is correctly "todo"; flag in
its description that the schema already exists so the backend subtask starts from migration
+ repository, not schema design.

## Strategic sequencing recommendation (supplier-fulfilled MVP)
The natural critical path for a first sellable flow is:

```
Customer (KAN-17) ─┐
                   ├─► CustomerOrder (KAN-18) ─► Checkout MVP (KAN-21)
Catalog (done) ────┘                               │
                                                   ▼
                              SupplierOrder (KAN-19) ─► Shipment (KAN-22)
                                                   │
                                                   ▼
                              ReturnRequest (new) ─► Refund (KAN-20)
```

Implications:
- **Checkout MVP (KAN-21) is mis-sequenced as a leaf of M5.** It cannot create real orders
  until Customer + CustomerOrder exist (M2). Recommend treating KAN-21 as dependent on
  KAN-17/KAN-18, or explicitly scoping a "guest/manual" order MVP. (Left in place; flagged,
  not unilaterally moved.)
- **Supplier order management (KAN-19) is the heart of the supplier-fulfilled model** —
  prioritize it over customer-facing polish; without it admins cannot fulfill.

## Risks & assumptions
- **R1 — Unauthenticated admin (high):** all M1–M4 admin endpoints/UI are open. Admin auth
  (KAN-23) is a launch prerequisite, not late-stage hardening. Recommend pulling a minimal
  auth gate forward before any admin surface handles real customer/order data.
- **R2 — PII exposure (high):** Customer + Address introduce personal data. Reuse the
  established public/admin serializer split (already used to hide supplier cost fields) to
  ensure PII never leaks to public endpoints.
- **R3 — No payment provider decision (med):** Checkout MVP assumes a payment status model
  but no provider chosen. Validate "manual/offline payment" is acceptable for MVP.
- **R4 — Inventory truth (med):** `stockPolicy=SupplierManaged` means stock is not
  authoritative; checkout must not promise availability it cannot guarantee.
- **A1:** single-supplier-per-variant at MVP (model supports it; UI should not assume multi).
- **A2:** EUR single-currency, single-region shipping at MVP.

## Success metrics (when storefront→order flow lands)
- Catalog: product detail view rate, search-to-detail CTR.
- Conversion: cart→order completion, order→supplier-order processing time (ops KPI).
- Fulfillment: % orders with supplier order placed < 24h; shipment tracking coverage.
- Returns: return rate, refund processing time.

## Actions taken in this pass
- Reconciled statuses (prior turn): KAN-1, KAN-2, KAN-3, KAN-4, KAN-13, KAN-9, KAN-11,
  KAN-12 → Finalizado.
- Created missing features: Public storefront catalog (M5, → Finalizado),
  Return request management (M4), Production deployment & monitoring (M6).
- Enriched thin feature descriptions where useful; left subtasks just-in-time per project
  convention.

## Recommended next steps (for the user to decide)
1. Decide whether to pull a minimal admin-auth gate (KAN-23) forward before M2 ops.
2. Confirm Checkout MVP scope/sequence vs the Customer/Order dependency.
3. Pick the next feature to start (recommend Supplier management KAN-14 — model exists,
   unblocks the supplier-fulfilled fulfillment chain) and create its subtasks then.

---

# Product Strategy Analyst — Headless Shopify Catalog, Phase 1 (2026-08-22)

## Executive summary
The request is a **sourcing change, not a product change**: move the read path of the public
catalog (list, PDP, four nav sections) from Prisma to the Shopify Storefront API while the
React storefront, brand styling, i18n, cart, Stripe checkout, accounts, admin panel, and CJ
fulfillment all stay exactly as they are. Success is therefore defined by the *absence* of
customer-visible change, plus a new operational capability (catalog managed in Shopify).

Strategically this is a **build-vs-buy move on catalog management (PIM)**, not on commerce.
It buys Shopify's merchandising/collection tooling without surrendering the storefront brand
or the payment relationship. That is a defensible sequencing choice: the storefront and the
Stripe/CJ chain are where the differentiated work already lives.

## Problem and user value
- Today the catalog is edited through a bespoke admin panel; every merchandising capability
  (collections, publishing windows, bulk edits, richer media) is custom-built work.
- Customer value in Phase 1 is **indirect**: no new customer capability ships. Customers
  benefit later, via faster/richer merchandising and fewer stale or thin product listings.
- Direct value in Phase 1 accrues to the store operator: catalog authoring moves to a mature
  tool, and the door opens to Shopify's ecosystem without a Hydrogen rewrite.
- Because value is indirect, the story must be judged on **risk containment**, not on uplift.

## Target segments
- Primary customer segment unchanged: women 20–45, mobile-first, Zara/Mango/H&M UX
  expectations. They must not be able to tell this shipped.
- Primary *beneficiary* in Phase 1: the store operator/merchandiser (internal persona).
- Secondary: future contributors — a smaller custom catalog surface to maintain.

## Affected user flows
- Browse nav section (Women/Men/Accessories/Shoes) — data source changes.
- Catalog listing with search, sort, pagination — data source changes.
- Product detail: gallery, price/compare-at, variant selection — data source changes.
- **Add to cart → checkout → payment — must NOT change**, but is the flow most at risk,
  because it depends on the identifiers the catalog hands it.
- Wishlist, reviews, sitemap/SEO — same identifier dependency, same risk.

## MVP scope recommendation
- **In:** read-only sourcing of product list, product detail, and the four nav sections from
  Shopify; collection→nav-section mapping; a reversible feature flag; SKU-based identity
  mapping so the purchase path is untouched; reconciliation logging for unmapped SKUs.
- **Out (confirmed by the requester):** Shopify checkout, Customer Account API, replacing
  Stripe, moving admin catalog authoring to Shopify Admin, CJ fulfillment via Shopify,
  Hydrogen rewrite.
- **Recommended addition to MVP scope:** dual-source reconciliation + alerting. Without it,
  the first catalog drift becomes a silent conversion loss rather than an alert.
- **Recommended sequencing:** ship the adapter behind a flag, run both sources in parallel on
  a real catalog subset, then flip. Do not delete the Prisma read path in Phase 1.

## Customer-facing vs internal impact split
| | Customer-facing | Internal / operational |
|---|---|---|
| Intended change | None (visual and behavioural parity) | Catalog authored in Shopify; collections drive nav |
| New risk | Product visible but unpurchasable; wrong-currency price; missing colour images; slower catalog TTFB | Two catalog sources to reconcile; Shopify rate limits; new credential to rotate |
| New capability | None in Phase 1 | Shopify merchandising tooling; ecosystem optionality |

## Fit with the supplier-fulfilled model
- **Compatible.** Shopify is used purely as a catalog/PIM read source. Fulfillment stays
  manual/CJ-driven, inventory stays `SupplierManaged`, and no warehouse assumption is added.
- Critical invariant preserved by design: supplier cost/reference must never reach the
  storefront. Shopify metafields are a *new* potential leak vector — cost data synced into a
  metafield would be one careless field addition away from the public payload. The existing
  allow-list serializer must remain the single exit point.
- Availability messaging must stay non-committal; Shopify's `availableForSale` must not be
  turned into a delivery promise the supplier chain cannot honour.

## Assumptions and risks
- **A1:** Shopify is a catalog source only in Phase 1; Prisma remains the system of record for
  variants that can be purchased. Cart/checkout continue to resolve Prisma variant ids.
- **A2:** Every purchasable variant has a SKU that is unique and identical on both sides.
  This is the load-bearing assumption of the whole phase.
- **A3:** Single currency EUR, single storefront locale pair (ES/EN).
- **A4:** Catalog volume is small (curated dropshipping), so cursor-based pagination can be
  walked server-side without cost concerns.
- **R1 — CRITICAL, identity break:** the purchase path keys on Prisma `ProductVariant.id`. If
  the PDP starts emitting Shopify ids, "add to cart" breaks store-wide. Mitigation: SKU join,
  Prisma ids remain the public identifiers, contract tests on the add-to-cart payload.
- **R2 — HIGH, phantom products:** a product published in Shopify with no matching Prisma SKU
  renders fine and fails at checkout. Mitigation: exclude unmapped SKUs from the response and
  alert; never render an unpurchasable card.
- **R3 — HIGH, silent SEO/identifier regression:** `/catalog/:id`, canonical URLs, JSON-LD and
  the sitemap are all built from Prisma ids. Changing the identifier scheme silently
  invalidates indexed URLs. Mitigation: identifier scheme is frozen in Phase 1.
- **R4 — MED, brand-parity regression:** Shopify media has no per-colour association, whereas
  the current gallery filters images by variant colour. Straight mapping degrades the PDP.
- **R5 — MED, currency:** Shopify returns money as a `MoneyV2` string with a currency code;
  `PriceTag` always formats EUR. A non-EUR shop setting would render wrong prices with no error.
- **R6 — MED, latency/availability:** the catalog becomes dependent on a third-party API on the
  critical browse path. Mitigation: caching, timeouts, and a fallback to the Prisma read path.
- **R7 — MED, credential exposure:** a Storefront token placed in a `VITE_*` variable is
  inlined into the JS bundle, which contradicts the requester's own "env/SSM, never committed"
  constraint. Mitigation: keep the token server-side.
- **R8 — LOW/MED, pagination semantics:** Shopify product connections are cursor-based with no
  total count; the current UI renders numbered pages from a `total`. Needs an explicit decision.

## Critical assumptions to validate before implementation
1. SKU parity and uniqueness across Shopify and Prisma for 100% of purchasable variants.
2. Shopify shop currency is EUR and the sales channel publishes exactly the intended products.
3. Translations exist in Shopify for ES/EN, or a fallback source is agreed.
4. Colour↔image association can be reconstructed from Shopify variant media.
5. Whether numbered pagination must be preserved exactly (drives the pagination decision).

## Success metrics
- **Parity (primary):** zero change in add-to-cart success rate, checkout conversion, and PDP
  bounce rate before vs after the flip.
- **Integrity:** count of Shopify-published SKUs with no Prisma match = 0 (alert if > 0).
- **Performance:** catalog list and PDP p95 latency within the pre-migration budget.
- **Reversibility:** time to roll back = one config change, no code deploy.
- **Operational:** time to publish a new product / re-merchandise a nav section (should fall).

## Recommended next steps
1. Decide the sourcing topology (server-side adapter vs browser-direct) — architecture change,
   requires explicit approval per base-standards §17.
2. Decide the pagination contract (numbered pages vs cursor).
3. Validate SKU parity on the real catalog before writing adapter code.
4. Only then open the OpenSpec change and generate backend/frontend plans.

---

# Product Strategy Analyst — Shopify Liquid Theme, Mavile Visual Port (2026-08-22)

> Supersedes the analysis above (`Headless Shopify Catalog, Phase 1`). That phase kept Prisma
> and Stripe and used Shopify only as a catalog content source. The decision has changed:
> Shopify becomes the whole commerce platform, and Mavile contributes only its visual system
> to a Shopify-hosted Online Store 2.0 Liquid theme. Hydrogen was explicitly rejected.

## Executive summary
This is a **replatform, not a feature**. The commerce engine moves from a bespoke
Express/Prisma/Stripe/Lambda stack to Shopify, and the only thing carried across is the brand
surface: design tokens, layout, catalog grid, product card, PDP gallery and variant look, cart
look, four-section navigation, ES/EN flag switcher, cookie banner, content-page treatment and
editorial photography tone.

Strategically this converts roughly two years of custom commerce infrastructure into a
subscription line item, and reduces the maintained surface from "storefront + API + DB + payments
+ auth + admin + fulfillment integration" down to "one theme". The brand — which is the actual
differentiator for a fashion store with no physical presence — is preserved. That is a sound
trade for a single-operator dropshipping business.

The strategic risk is not technical, it is **completion risk on the parts deliberately deferred**.
A beautiful theme on an empty store sells nothing. The theme is maybe a third of the work between
here and a live `mavile.es` on Shopify; product migration, market/tax/shipping configuration,
CJ app setup and domain cutover are the rest, and they are all explicitly out of this change.
The plan must say so loudly enough that "theme done" is never mistaken for "ready to launch".

## Problem and user value
- The current stack costs disproportionate engineering time per unit of customer value. Every
  commerce primitive — checkout, refunds, 2FA, shipment tracking, tax, the admin panel — was
  hand-built and must be hand-maintained, for a store whose competitive edge is curation and
  aesthetics, not payment infrastructure.
- **Customer value in this change is zero by design.** No new shopper capability ships. The
  theme is a prerequisite; the customer-visible payoff arrives at cutover, and is indirect:
  a checkout shoppers already trust, saved payment methods and wallets, reliable order/return
  handling, and faster merchandising.
- The genuine near-term value is preserving brand equity through the replatform. A default Dawn
  store would be functionally complete and brand-dead. This change is what stops the replatform
  from costing the brand.

## Affected user flows
| Flow | Change |
|---|---|
| Browse nav section (Women/Men/Accessories/Shoes) | Rebuilt as Shopify collections + menus; same look |
| Catalog listing, sort, search, pagination | Rebuilt on Shopify collection/search; same look |
| Product detail (gallery, variants, price) | Rebuilt in Liquid; same look, Shopify variant semantics |
| Cart | Rebuilt on Shopify cart; same look |
| Checkout | **Look changes.** Shopify-hosted, branding-only control. Accepted trade-off |
| Login / register / account | Look depends on classic vs new customer accounts — open decision |
| Language switch ES/EN | Rebuilt on Shopify Markets; same flag control |
| Cookie consent | Same look, different engine (Shopify Customer Privacy API) |
| Legal and content pages | Same look, content moves to Shopify Pages and Policies |
| Reviews, wishlist | **Lost unless re-sourced.** Not in Shopify core |

## Target segments
- Primary customer segment unchanged: women 20–45, mobile-first, Zara/Mango/H&M UX expectations,
  shopping in Spanish with English as a secondary market. They must not perceive a downgrade.
- Primary beneficiary of this change: the store operator. Merchandising, orders, refunds, tax and
  shipping stop being engineering tasks.
- Secondary: future contributors. A Liquid theme is a far smaller and more conventional surface
  than a bespoke full-stack app, and hiring for it is easy.

## MVP scope recommendation
**In:** an Online Store 2.0 theme in `shopify/theme`, restyled to Mavile, that renders home,
collection, product, cart, search, content pages, 404 and the account templates; the four nav
collections; ES/EN via Markets; the cookie banner wired to Shopify's consent API; native hosted
checkout with brand-matched branding settings.

**Out, and must stay out:** product data migration, `mavile.es` DNS cutover, CJ app configuration,
decommissioning the Lambda stack, order/customer history migration, and any attempt to re-create
Stripe, custom auth, 2FA or the admin panel inside Shopify.

**Recommended additions to the stated MVP:**
1. **A visual-parity acceptance artifact.** Side-by-side screenshots of both storefronts at
   360/768/1280 px for every ported surface. Without a defined bar, "matches Mavile" is an
   argument, not a test. Also settle the vocabulary now: the goal is *brand parity*, not pixel
   parity — Shopify's markup differs, and chasing pixels will burn the budget.
2. **A performance budget.** The Mavile React app never had one. The ported look includes a
   five-slide hero carousel with Ken Burns motion, `backdrop-filter` blur on a sticky header, and
   large editorial photography — the three most common causes of a failing Shopify Lighthouse
   score. Set the budget before building, not after.
3. **Search-engine isolation.** The Shopify store must be password-protected or `noindex` until
   cutover, or Google indexes a second Mavile catalog and the real domain loses authority.
4. **An explicit launch-gap document.** One page listing everything still required between
   "theme merged" and "mavile.es on Shopify". This is the single highest-value paragraph in the
   whole change.

**Recommended sequencing:** tokens and layout shell first (they gate everything), then collection
grid and product card, then PDP, then cart, then content/legal, then consent and account. Ship
against a development store with a handful of representative products; do not wait for migration.

## Customer-facing vs internal impact split
| | Customer-facing | Internal / operational |
|---|---|---|
| Intended change now | None — nothing is live | New theme codebase in-repo; second toolchain (Shopify CLI, Liquid, Theme Check) |
| Change at future cutover | Same brand; different checkout, account and email surfaces; trustworthier payments | Commerce ops move to Shopify Admin; Lambda/Prisma/Stripe/admin panel become decommissionable |
| New risk | Brand drift on checkout and account pages; consent-mapping bugs affecting GDPR compliance | Two storefronts live at once; SEO duplication; Shopify fees replace AWS costs; theme is outside the existing ESLint/Jest/Vitest gates |
| New capability | None yet | Shopify app ecosystem, Markets, native tax/shipping, Checkout Extensibility |

## Fit with the supplier-fulfilled model
- **Fully compatible, and materially better served.** Dropshipping is Shopify's best-supported
  model. CJ Dropshipping ships a first-party Shopify app, which replaces the custom CJ Lambda
  integration with vendor-maintained software.
- The base-standards invariant that supplier cost, references and internal notes never reach
  customers is **preserved differently**: Shopify keeps cost per item as an admin-only field, and
  a Liquid theme cannot render it unless someone deliberately exposes it via a metafield. The new
  rule to write down is therefore: no supplier metafield may be rendered in the theme, and cost
  data must never be stored in a storefront-visible namespace.
- Availability messaging must stay non-committal. Shopify's `available` is inventory-truth for a
  warehouse it does not have; the theme should not turn it into a delivery promise.
- No warehouse assumption is introduced. Future internal or hybrid stock remains supported —
  better than before, since Shopify has native multi-location inventory.

## Assumptions and risks
- **A1** — Mavile's visual system is genuinely portable: it is plain CSS custom properties and
  BEM-ish classes with no CSS-in-JS and no framework dependency. Verified in `tokens.css` and
  `storefront.css`; this is the single assumption that makes option A cheap.
- **A2** — Shopify is the full commerce platform going forward. Reviews and wishlist are the two
  Mavile features with no Shopify-core equivalent and no stated plan.
- **A3** — Single currency EUR, Spain-primary market, ES default with EN secondary.
- **A4** — Catalog stays small and curated, so no bulk-migration tooling is needed for MVP.
- **R1 — HIGH, launch-gap illusion.** "Theme complete" reads like "almost live" but omits data
  migration, market/tax/shipping setup, CJ app, and cutover. Mitigation: the explicit launch-gap
  document, and a proposal that names the follow-up changes.
- **R2 — HIGH, feature regression at cutover.** Product reviews and wishlist exist today and have
  no Shopify replacement in scope. Mitigation: decide now — app, defer, or accept the loss.
- **R3 — MED/HIGH, account and checkout brand drift.** New customer accounts are not themeable;
  hosted checkout allows branding settings only. Mitigation: choose classic customer accounts if
  the Mavile account look matters, and accept checkout divergence in writing.
- **R4 — MED/HIGH, performance regression.** Hero carousel + blurred sticky header + editorial
  imagery against a Shopify Lighthouse budget. Mitigation: set the budget up front; self-host a
  subset of Inter instead of Google Fonts; serve imagery through Shopify CDN with responsive
  `srcset`; honour `prefers-reduced-motion`, which the current CSS already does.
- **R5 — MED, consent-model mismatch.** Mavile's banner has two categories (analytics, marketing);
  Shopify's Customer Privacy API models analytics, marketing, preferences and sale-of-data.
  A sloppy mapping is a GDPR exposure in an EU-primary market, not just a UI bug.
- **R6 — MED, image licensing.** The hero and category imagery are hot-linked Unsplash URLs. Both
  the licence position and the performance cost need resolving before they become launch assets on
  a commercial store.
- **R7 — MED, SEO duplication.** Two indexable Mavile catalogs would compete. Mitigation: keep the
  Shopify store gated until cutover.
- **R8 — MED, spec drift.** The superseded change is unimplemented, so OpenSpec's archive flow
  (which is post-merge cleanup) does not apply. It must be withdrawn deliberately, with the
  supersession recorded, or the repo keeps a spec describing an abandoned architecture.
- **R9 — LOW/MED, two frontends in one repo.** `frontend/` and `shopify/theme` will coexist for
  months. The existing ESLint gate covers neither Liquid nor theme JS. Mitigation: Theme Check as
  the equivalent gate, and a README that states which surface is authoritative.
- **R10 — LOW, cost shift.** Shopify subscription plus transaction fees replace AWS spend. A
  business decision, not an engineering one, but it should be stated rather than discovered.

## Critical assumptions to validate before implementation
1. Classic vs new customer accounts — determines whether account pages can carry the Mavile look.
2. Whether reviews and wishlist must survive the replatform.
3. Which Shopify shop and plan to build against, and whether Shopify Payments is available and
   sufficient for Spain (including whether Bizum is required).
4. Rights-cleared hero and category photography to replace the Unsplash hot-links.
5. That ES-at-root plus EN-at-`/en` is the intended URL scheme, since it constrains SEO and the
   language switcher.

## Success metrics
- **Parity (primary):** every ported surface passes design review at 360/768/1280 px, with tokens
  matching `tokens.css` exactly. Target: zero unresolved parity defects on home, collection,
  product, cart and content pages.
- **Performance:** Lighthouse mobile performance ≥ 90 and accessibility ≥ 95 on home, collection
  and product; LCP < 2.5 s, CLS < 0.1, INP < 200 ms.
- **Quality gate:** `shopify theme check` clean; theme JS under budget; no hardcoded copy outside
  `locales/`.
- **Compliance:** no analytics or marketing script fires before consent, verified in both locales.
- **Operational:** time to publish a product and re-merchandise a nav section, measured in Shopify
  Admin — the number that justifies the whole replatform.
- **Not a metric yet:** conversion or revenue. Nothing is live; claiming commercial metrics for
  this change would be dishonest.

## Recommended next steps
1. Resolve the five validation questions above — three are blocking (accounts, shop/plan, imagery).
2. Approve the stack addition explicitly. A Liquid theme plus Shopify CLI is a technology-stack and
   folder-structure change under base-standards §17, and supersedes a documented architecture.
3. Withdraw `shopify-headless-catalog-phase1` deliberately and record the supersession.
4. Open the new OpenSpec change, write the launch-gap document in the same pass, and only then
   generate the frontend plan and start building.
