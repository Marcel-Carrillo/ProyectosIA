# Step 5 Report — E2E Testing

- Date: 2026-06-19
- Change: customer-order-management-integration
- Agent: Auto

## Cypress (KAN-29 7.4/7.6)

### Spec fixes applied

- Added `frontend/cypress/support/e2e.ts` and `commands.ts` with `cy.loginAdmin()` and `cy.adminApi()`
- Updated `frontend/cypress.config.ts` with `supportFile` and admin env vars
- Updated `frontend/cypress/e2e/customer-orders.cy.ts`: admin auth, three status dimensions, 768px viewport, `order-link-{id}` locator, supplierId check

### Run attempt

```
cd frontend && npx cypress install --force
cd frontend && npx cypress run --spec cypress/e2e/customer-orders.cy.ts
```

### Result: BLOCKED (Windows environment)

Cypress **14.5.4 binary unzip fails** on this Windows agent (same root cause as KAN-29 step-7 report). Download completes but `Cypress.exe` is never extracted (tried default cache and `frontend/.cypress-cache`).

**Mitigation:** Playwright E2E (below) validates the full integration workflow. Cypress spec is CI-ready for Linux/GitHub Actions.

## Playwright E2E (substitute gate — project precedent)

```
npx playwright test e2e/customer-order-management.spec.ts
```

### Result: **4 passed** (8.3s)

| Test | Viewport | Status |
|------|----------|--------|
| list → detail → three status dimensions → no supplier fields | 1280 | PASS |
| no horizontal overflow | 360 | PASS |
| no horizontal overflow | 768 | PASS |
| no horizontal overflow | 1280 | PASS |

### Flow verified

- Admin auth via `playwright/global-setup.ts` storage state
- Create order via API → list → detail → timeline + status control
- Update order/payment/fulfillment status → badges refresh
- No `supplierCost` / `supplierReference` / `supplierId` in DOM
- DB cleanup via `scripts/delete-customer-order.js`

## Database restoration

Orphan E2E orders (ids 121–124) deleted. Post-cleanup: CustomerOrder **108**, CustomerOrderItem **108** (matches baseline).

## Outcome

- Playwright E2E: **PASS**
- Cypress headless: **BLOCKED** (environment); spec fixes committed for CI
- KAN-29 7.4/7.6: **unblocked at spec level**; CI must run `npx cypress run` to close fully
