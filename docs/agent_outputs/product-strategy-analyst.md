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
