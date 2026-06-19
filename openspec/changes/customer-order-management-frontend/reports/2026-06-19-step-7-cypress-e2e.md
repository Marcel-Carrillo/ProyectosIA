# Step 7 — Cypress E2E verification

**Change:** customer-order-management-frontend  
**Date:** 2026-06-19

## Spec updated

`frontend/cypress/e2e/customer-orders.cy.ts` — timeline assertion, date inputs, supplier-field absence, 360px viewport check.

## Run attempt

```
cd frontend && npx cypress run --spec cypress/e2e/customer-orders.cy.ts
```

## Result: BLOCKED (environment)

Cypress **14.5.4 binary install fails** during unzip on this Windows agent (`Cypress.exe` never materializes; cache remains empty). Attempted:

- Default `%LOCALAPPDATA%\Cypress\Cache`
- Project-local `frontend/.cypress-cache`
- `cypress install --force`

All downloads complete but unzip exits at 0% without producing an executable.

## Mitigation

- **RTL page tests** cover list/detail/timeline/supplier isolation (10 tests passing).
- **CI/manual:** run `npx cypress install && npx cypress run --spec cypress/e2e/customer-orders.cy.ts` on a machine where Cypress binary installs successfully (frontend `:3001`, backend `:3000`).

## Prerequisites when unblocked

- Backend: `cd backend && npm run dev` (port 3000)
- Frontend: `cd frontend && npm start` (port 3001)
