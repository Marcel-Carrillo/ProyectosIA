# Frontend Implementation Plan: customer-order-management-integration (KAN-30)

Generated from: `ai-specs/agents/frontend-developer.md`  
Context: `.claude/sessions/context_session_customer-order-management-integration.md`  
Parent ticket: KAN-18 · Unblocks: KAN-29 tasks **7.4 / 7.6**

---

## Executive summary

KAN-28/KAN-29 already delivered the customer-order admin UI. **KAN-30 is verification-first** — audit existing components against `openspec/specs/customer-order-management/spec.md`, fix only blockers surfaced by tests/E2E, and pass Cypress headless + Playwright MCP.

**Audit verdict:** Core pages, service, types, timeline, and RTL coverage are **present and spec-aligned**. The primary Cypress blocker is **not missing UI** — it is **(1) admin auth not seeded** in `customer-orders.cy.ts` after unified admin auth landed, **(2) incomplete E2E workflow vs integration checklist**, and **(3) environment Cypress binary install failure** documented in KAN-29 step-7 report.

**Do not rewrite** `CustomerOrdersPage`, `CustomerOrderDetailPage`, or `OrderStatusControl` unless verification proves a defect.

---

## 1. Audit: existing deliverables

### 1.1 File inventory (confirmed on `master`)

| Artifact | Path | Status |
|----------|------|--------|
| List page | `frontend/src/pages/CustomerOrdersPage.tsx` | ✅ Complete |
| Detail page | `frontend/src/pages/CustomerOrderDetailPage.tsx` | ✅ Complete |
| Status control | `frontend/src/components/admin/OrderStatusControl.tsx` | ✅ Complete |
| Status timeline | `frontend/src/components/admin/OrderStatusTimeline.tsx` | ✅ Complete |
| Service | `frontend/src/services/customerOrderService.ts` | ✅ Complete |
| Types | `frontend/src/types/customerOrder.ts` | ✅ Complete (no supplier fields) |
| Routes | `frontend/src/App.tsx` L97–98 | ✅ Under `RequireAdminAuth` |
| Cypress spec | `frontend/cypress/e2e/customer-orders.cy.ts` | ⚠️ Needs auth + workflow fixes |
| Legacy stub | `frontend/cypress/e2e/customerOrders.cy.ts` | ℹ️ `it.todo` only — superseded |

### 1.2 `CustomerOrdersPage.tsx` audit

**Spec alignment: PASS**

- Debounced search (400 ms) with `data-testid="order-search"`.
- Three status filters + `createdFrom` / `createdTo` date inputs (`order-date-from`, `order-date-to`).
- URL sync via `useSearchParams`; page resets to 1 on filter change.
- Passes `createdFrom` / `createdTo` to `customerOrderService.list()`.
- Dual render: desktop `Table` (`d-none d-md-block`) + mobile card list (`d-md-none admin-card-list`).
- Desktop rows use `data-testid="order-link-{id}"`; mobile cards use plain `Link` (no testid — Cypress uses `cy.contains(orderNumber)`).

**No source changes required** unless E2E proves a filter bug.

### 1.3 `CustomerOrderDetailPage.tsx` audit

**Spec alignment: PASS**

- Line items, address snapshots, totals, customer ref.
- `OrderStatusTimeline` in Card (`data-testid="order-status-timeline"` via child).
- `OrderStatusControl` with `data-testid="order-status-control"`.
- Detail badges: `detail-badge-order`, `detail-badge-payment`, `detail-badge-fulfillment`.
- Refund/return modals: `fullscreen="sm-down"`; primary buttons use `admin-touch-btn`.
- Linked supplier orders section shows **order numbers + status badges only** — no `supplierCost` / `supplierReference` / `supplierId` in types or rendered values.
- Fulfillment enum labels (`PendingSupplierOrder`, `SupplierOrderPlaced`) contain the word "Supplier" — **not** a spec violation; assertions must target field **names/values**, not generic copy.

**No source changes required** unless supplier-field leak is found in DOM during E2E.

### 1.4 `OrderStatusControl.tsx` audit

**Spec alignment: PASS**

- Three independent `<Form.Select>` controls with testids: `select-order-status`, `select-payment-status`, `select-fulfillment-status`.
- PATCH payload includes **only changed** fields (`UpdateCustomerOrderStatusInput`).
- Save button: `btn-save-status`, `admin-touch-btn`.
- Syncs local state when `order` prop updates after save.

**No source changes required.**

### 1.5 `OrderStatusTimeline.tsx` audit

**Spec alignment: PASS**

- Milestones: Created (`createdAt`), Paid (`paidAt` if set), Cancelled (`cancelledAt` if set), Last updated (`updatedAt`).
- `data-testid="order-status-timeline"`.
- Footer note about missing history model.

**Optional (non-blocking):** add dedicated `OrderStatusTimeline.test.tsx` — not required for KAN-30 unless RTL audit wants parity with other admin components.

### 1.6 `customerOrderService.ts` + types audit

- All calls target `/api/admin/customer-orders` (via `REACT_APP_API_BASE_URL`).
- `CustomerOrder` / `CustomerOrderItem` interfaces omit supplier-internal fields.
- Error mapping covers transition codes (`ORDER_STATUS_TRANSITION_INVALID`, etc.).

**No source changes required.**

---

## 2. RTL test audit

### 2.1 Existing coverage

| File | Tests | Notes |
|------|-------|-------|
| `CustomerOrdersPage.test.tsx` | list, date params, empty, error | Uses `findBy*` for DOM ✅ |
| `CustomerOrderDetailPage.test.tsx` | items, timeline, supplier absence | Uses `findBy*` ✅ |
| `OrderStatusControl.test.tsx` | payment-only PATCH | Single dimension only |
| `customerOrderService.test.ts` | list, date params, error map | ✅ |

### 2.2 Gaps (fix only if step 2/3 unit run fails)

| Gap | Priority | Action |
|-----|----------|--------|
| `OrderStatusControl` — order + fulfillment dimensions | Low | Add two tests: `onSave` with `{ status: 'Paid' }` and `{ fulfillmentStatus: 'Fulfilled' }` |
| `CustomerOrderDetailPage` — `supplierId` in DOM | Medium | Extend assertion: `expect(document.body.textContent).not.toMatch(/supplierId/i)` |
| `CustomerOrdersPage` date test uses `waitFor` + `getByTestId` | Low | Acceptable for mock-call assertion after `jest.advanceTimersByTime`; keep `findBy*` for DOM |
| Missing `OrderStatusTimeline.test.tsx` | Low | Optional: paid milestone shown/hidden |

### 2.3 ESLint gate (mandatory before marking tasks complete)

```bash
cd frontend
npx eslint src --ext .ts,.tsx
npx tsc --noEmit
npm test -- --watchAll=false --testPathPattern="customerOrder|CustomerOrdersPage|CustomerOrderDetail|OrderStatus"
```

**Rule:** `testing-library/prefer-find-by` — use `expect(await screen.findBy…)` for async DOM; never `waitFor(() => expect(screen.getBy…))` for presence.

---

## 3. Cypress: root cause and fixes (KAN-29 7.4/7.6 blocker)

### 3.1 Environment blocker (KAN-29 report)

`openspec/changes/archive/2026-06-19-customer-order-management-frontend/reports/2026-06-19-step-7-cypress-e2e.md` documents Cypress **14.5.4 binary unzip failure** on Windows agent.

**Apply agent steps before spec fixes:**

1. `cd frontend && npx cypress install --force`
2. If still failing: set `CYPRESS_CACHE_FOLDER=frontend/.cypress-cache` and retry
3. Document outcome in `openspec/changes/customer-order-management-integration/reports/YYYY-MM-DD-step-5-e2e-testing.md`
4. If binary cannot install locally, run headless on CI/Linux and paste results into report

### 3.2 Auth blocker (code — **must fix**)

Unified admin auth (`RequireAdminAuth`, `requireAdminAuth` on `/api/admin/*`) means the current spec **will fail**:

- `cy.request('POST', …/customer-orders')` without `Authorization: Bearer <token>` → **401**
- `cy.visit('/customer-orders')` without session → redirect to **`/admin/login`**

Access token lives **in-memory** in `adminAuthService.ts` (not `localStorage`). Refresh cookie is httpOnly on backend; browser API calls go through CRA **proxy** (`frontend/package.json` → `"proxy": "http://localhost:3000"`).

**Recommended pattern:** add shared helpers (new files below) and use in `customer-orders.cy.ts`.

#### File A: `frontend/cypress/support/e2e.ts` (CREATE)

```typescript
import './commands';
```

#### File B: `frontend/cypress/support/commands.ts` (CREATE)

```typescript
const API = () => Cypress.env('API_URL') ?? 'http://localhost:3000';

Cypress.Commands.add('loginAdmin', () => {
  const email = Cypress.env('ADMIN_EMAIL') ?? 'admin@example.com';
  const password = Cypress.env('ADMIN_PASSWORD') ?? 'AdminPass1';

  cy.session('admin-ui', () => {
    cy.visit('/admin/login');
    cy.get('#admin-email').clear().type(email);
    cy.get('#admin-password').clear().type(password);
    cy.contains('button', 'Sign in').click();
    cy.url({ timeout: 15000 }).should('not.include', '/admin/login');
  });
});

Cypress.Commands.add('adminApi', (options: Partial<Cypress.RequestOptions>) => {
  const email = Cypress.env('ADMIN_EMAIL') ?? 'admin@example.com';
  const password = Cypress.env('ADMIN_PASSWORD') ?? 'AdminPass1';

  return cy
    .request('POST', `${API()}/api/admin/auth/login`, { email, password })
    .then((loginRes) => {
      const token = loginRes.body.data.accessToken as string;
      return cy.request({
        ...options,
        url: options.url!.startsWith('http') ? options.url! : `${API()}${options.url}`,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    });
});
```

Add to `frontend/cypress.config.ts`:

```typescript
e2e: {
  baseUrl: 'http://localhost:3001',
  supportFile: 'cypress/support/e2e.ts',
  env: {
    API_URL: 'http://localhost:3000',
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'AdminPass1',
  },
},
```

#### File C: `frontend/cypress/e2e/customer-orders.cy.ts` — MODIFY

**Changes:**

1. `beforeEach(() => cy.loginAdmin())` in both tests.
2. Replace bare `cy.request('POST', …)` with `cy.adminApi({ method: 'POST', url: '/api/admin/customer-orders', body: … })`.
3. Replace bare `cy.request('PATCH', …)` similarly if added.
4. Add **async waits** (Cypress equivalent of RTL `findBy*`):

```typescript
// After cy.visit — wait for list shell, not just existence
cy.get('[data-testid="order-search"]', { timeout: 15000 }).should('be.visible');

// After creating order — list refetch may lag
cy.contains(orderNumber, { timeout: 15000 }).should('be.visible').click();

// After status save — badge update after PATCH round-trip
cy.get('[data-testid="btn-save-status"]').click();
cy.get('[data-testid="detail-badge-payment"]', { timeout: 15000 })
  .should('contain.text', 'Paid');
```

5. Extend `assertNoSupplierFields`:

```typescript
const SUPPLIER_LEAK = /supplierId|supplierCost|supplierReference/i;
const assertNoSupplierFields = () => {
  cy.get('body').invoke('text').should('not.match', SUPPLIER_LEAK);
};
```

6. Add **768px** viewport test (integration spec requires 360 / 768 / 1280):

```typescript
it('is usable at tablet width without supplier fields', () => {
  cy.viewport(768, 1024);
  cy.visit('/customer-orders');
  cy.get('[data-testid="order-search"]', { timeout: 15000 }).should('be.visible');
  assertNoSupplierFields();
  cy.document().then((doc) => {
    expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth + 1);
  });
});
```

7. Expand desktop workflow to cover **three status dimensions** (integration checklist):

```typescript
cy.get('[data-testid="select-payment-status"]').select('Paid');
cy.get('[data-testid="btn-save-status"]').click();
cy.get('[data-testid="detail-badge-payment"]').should('contain.text', 'Paid');

cy.get('[data-testid="select-fulfillment-status"]').select('PendingSupplierOrder');
cy.get('[data-testid="btn-save-status"]').click();
cy.get('[data-testid="detail-badge-fulfillment"]').should('contain.text', 'PendingSupplierOrder');
```

8. **DB cleanup:** keep `cy.exec` Prisma delete; add `failOnNonZeroExit: true` once auth works; capture baseline count before/after per design D5.

### 3.3 Prerequisites (stack must be running)

| Prerequisite | Command / check |
|--------------|-----------------|
| Admin user | `cd backend && npx ts-node prisma/seedAdmin.ts` (uses `ADMIN_EMAIL` / `ADMIN_PASSWORD`) |
| Customer id `6` | Must exist — verify `GET /api/admin/customers/6` → 200 or adjust fixture id |
| Variant id `1` | Must exist and be orderable |
| Backend | `cd backend && npm run dev` → `:3000` |
| Frontend | `cd frontend && npm start` → `:3001` |

### 3.4 Run command (gate for tasks 5.5 / KAN-29 7.4)

```bash
cd frontend
npx cypress install
npx cypress run --spec cypress/e2e/customer-orders.cy.ts
```

---

## 4. Playwright MCP flow (task 5.2)

Mirror `playwright/global-setup.ts` (UI login → `/products`) then execute admin workflow. Document in step-5 report.

### 4.1 Setup

- Servers on `:3001` / `:3000`; admin seeded.
- Use Playwright MCP tools per `docs/openspec-tasks-mandatory-steps.md` § Step N+3.

### 4.2 Step-by-step flow

| Step | MCP action | Assertion |
|------|------------|-----------|
| 1 | `browser_navigate` → `http://localhost:3001/admin/login` | Login form visible |
| 2 | `browser_fill` `#admin-email` / `#admin-password` | — |
| 3 | `browser_click` "Sign in" | Lands on admin (e.g. `/products`) |
| 4 | `browser_navigate` → `/customer-orders` | `order-search` visible |
| 5 | `browser_snapshot` | No `supplierId` / `supplierCost` / `supplierReference` in HTML |
| 6 | `browser_fill` search or use date inputs | List updates (snapshot) |
| 7 | `browser_click` first order link / order number | Detail page loads |
| 8 | `browser_snapshot` | `order-status-timeline`, `order-status-control` present |
| 9 | Change payment select → `Paid` → click `btn-save-status` | `detail-badge-payment` shows Paid |
| 10 | Change fulfillment select → save | `detail-badge-fulfillment` updates |
| 11 | Change order status if valid transition → save | `detail-badge-order` updates |
| 12 | Viewport **360×640** — re-navigate list + detail | `scrollWidth <= clientWidth + 1` |
| 13 | Viewport **768×1024** — same | No horizontal overflow |
| 14 | Viewport **1280×800** — same | Desktop table visible (`order-link-*`) |

### 4.3 Supplier DOM absence (hard gate)

After each snapshot on list and detail:

- HTML must **not** match `/supplierId|supplierCost|supplierReference/i`
- Allowed: section title "Supplier orders", fulfillment labels containing "Supplier", links to `/supplier-orders/:id`

### 4.4 Cleanup

- Delete any orders created during MCP flow (Prisma script or `cy.adminApi` DELETE if added).
- Verify `CustomerOrder` count matches pre-test baseline.

---

## 5. Viewport checks summary

| Width | Where enforced | Status |
|-------|----------------|--------|
| 360px | `customer-orders.cy.ts` test 2 | ✅ Present |
| 768px | Integration spec | ❌ Add Cypress test (§3.2) |
| 1280px | `customer-orders.cy.ts` test 1 | ✅ Present |
| All three | Playwright MCP (§4) | Required for task 5.2 report |

Reuse overflow helper from `frontend/cypress/e2e/responsive.cy.ts`:

```typescript
expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth + 1);
```

---

## 6. Supplier DOM absence — assertion matrix

| Layer | File | Assert |
|-------|------|--------|
| RTL | `CustomerOrderDetailPage.test.tsx` | Extend regex to include `supplierId` |
| Cypress | `customer-orders.cy.ts` | `assertNoSupplierFields` on list + detail |
| Playwright MCP | step-5 report | Snapshot grep for forbidden keys |
| curl | backend task 4.7 | API body grep (backend plan) |

**Not a failure:** visible text "Supplier orders", `PendingSupplierOrder`, `SupplierOrderPlaced`, links to supplier-order admin pages.

---

## 7. Files to create or change (conditional)

| File | Action | Trigger |
|------|--------|---------|
| `frontend/cypress/support/e2e.ts` | CREATE | Always (auth helpers) |
| `frontend/cypress/support/commands.ts` | CREATE | Always (auth helpers) |
| `frontend/cypress.config.ts` | MODIFY | Add `supportFile`, admin env vars |
| `frontend/cypress/e2e/customer-orders.cy.ts` | MODIFY | Auth, waits, 768px, 3-status flow, supplierId assert |
| `frontend/src/pages/__tests__/CustomerOrderDetailPage.test.tsx` | MODIFY | Only if extending supplierId assertion |
| `frontend/src/components/admin/__tests__/OrderStatusControl.test.tsx` | MODIFY | Only if unit audit requests more dimensions |
| `frontend/src/**/*.tsx` (pages/components) | **NO CHANGE** | Unless E2E/curl proves defect |

---

## 8. Verification checklist (map to `tasks.md`)

| Task | Frontend action |
|------|-----------------|
| 1.2 | Confirm files exist (§1) — no edits |
| 1.3–1.5 | Audit three statuses, date filters, supplier types (§1) |
| 2.2 | Run RTL pattern command (§2.3) |
| 2.3 | Backend `customerOrderIsolation.test.ts` — N/A frontend |
| 5.2 | Playwright MCP flow (§4) |
| 5.4–5.5 | Cypress fixes + headless run (§3) |
| 5.7 | Report with Cypress root cause + pass/fail |

---

## 9. Risks and pitfalls

| Risk | Mitigation |
|------|------------|
| Cypress binary won't install on Windows | Document in report; run on CI/Linux; RTL + Playwright MCP as interim |
| `customerId: 6` missing in DB | Pre-flight `cy.adminApi GET /api/admin/customers/6` or query first customer |
| In-memory token lost on `cy.visit` | Use `cy.session('admin-ui', …)` before each test |
| `cy.request` to `:3000` doesn't auth browser | UI session separate from API helper — need **both** |
| Fulfillment transition 422 | Use valid transitions only (e.g. `NotStarted` → `PendingSupplierOrder` after payment Paid) |
| Debounced search flakes | After typing search, wait `{ timeout: 15000 }` or intercept `GET **/customer-orders**` |

---

## 10. Out of scope (per design)

- Supplier-order generation E2E (KAN-19) — button visibility only on detail page
- New timeline/history model
- Refactoring `customerOrders.cy.ts` stub (optional delete in cleanup PR)
- Changes to `CustomerOrdersPage` / `CustomerOrderDetailPage` UI unless verification fails

---

*Plan path: `.claude/doc/customer-order-management-integration/frontend.md`*
