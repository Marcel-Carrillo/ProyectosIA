## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/frontend-skeleton` from the master branch
- [x] 0.2 Verify branch creation and confirm current branch is `feature/frontend-skeleton`

## 1. Project Initialization

- [x] 1.1 Run `npx create-react-app frontend --template typescript` from the project root
- [x] 1.2 Verify the `frontend/` directory is created with the default CRA TypeScript structure
- [x] 1.3 Install additional dependencies: `react-router-dom@6`, `bootstrap@5`, `react-bootstrap@2`, `react-bootstrap-icons`, `axios`, `react-datepicker@6`, `react-beautiful-dnd@13`
- [x] 1.4 Install dev dependencies: `cypress@14`, `@types/react-beautiful-dnd`

## 2. Configuration

- [x] 2.1 Update `tsconfig.json` to enable `"strict": true` and add path alias `"@/*": ["src/*"]` under `compilerOptions.paths` with `baseUrl: "."`
- [x] 2.2 Create `frontend/.env.development` with `REACT_APP_API_BASE_URL=http://localhost:3000` and `PORT=3001`
- [x] 2.3 Create `frontend/.env.example` documenting `REACT_APP_API_BASE_URL` and `PORT`
- [x] 2.4 Verify `.env.development` is listed in `.gitignore` inside `frontend/`
- [x] 2.5 Create `frontend/cypress.config.ts` with `baseUrl: 'http://localhost:3001'` and `env.API_URL: 'http://localhost:3000'`

## 3. Global Styles and Bootstrap Setup

- [x] 3.1 Update `frontend/src/index.tsx` to import `bootstrap/dist/css/bootstrap.min.css` before the application CSS
- [x] 3.2 Remove the default CRA logo and placeholder content from `App.tsx`

## 4. Layout Component

- [x] 4.1 Create `frontend/src/components/Layout.tsx` — a functional component that renders a Bootstrap `<Navbar>` with `<NavLink>` entries for all admin sections and an `<Outlet />` for nested route content
- [x] 4.2 Add navigation links for: Products, Categories, Suppliers, Customers, Customer Orders, Supplier Orders, Shipments, Return Requests, Refunds
- [x] 4.3 Verify `Layout.tsx` compiles without TypeScript errors

## 5. Routing Configuration

- [x] 5.1 Rewrite `frontend/src/App.tsx` to use `<BrowserRouter>` and `<Routes>` from React Router DOM v6 with `<Layout />` as the root nested route
- [x] 5.2 Add a root redirect from `/` to `/products`
- [x] 5.3 Add routes: `/products`, `/products/:id`, `/categories`, `/suppliers`, `/customers`, `/customer-orders`, `/customer-orders/:id`, `/supplier-orders`, `/supplier-orders/:id`, `/shipments`, `/return-requests`, `/refunds`
- [x] 5.4 Add a wildcard `*` route rendering a `NotFoundPage` component

## 6. Placeholder Page Components

- [x] 6.1 Create `src/pages/ProductsPage.tsx` — renders heading "Products" and "Coming soon" text
- [x] 6.2 Create `src/pages/ProductDetailPage.tsx` — reads `:id` param and renders "Product Detail" heading with the id
- [x] 6.3 Create `src/pages/CategoriesPage.tsx` — renders heading "Categories" and "Coming soon" text
- [x] 6.4 Create `src/pages/SuppliersPage.tsx` — renders heading "Suppliers" and "Coming soon" text
- [x] 6.5 Create `src/pages/CustomersPage.tsx` — renders heading "Customers" and "Coming soon" text
- [x] 6.6 Create `src/pages/CustomerOrdersPage.tsx` — renders heading "Customer Orders" and "Coming soon" text
- [x] 6.7 Create `src/pages/CustomerOrderDetailPage.tsx` — reads `:id` param and renders "Customer Order Detail" heading
- [x] 6.8 Create `src/pages/SupplierOrdersPage.tsx` — renders heading "Supplier Orders" and "Coming soon" text
- [x] 6.9 Create `src/pages/SupplierOrderDetailPage.tsx` — reads `:id` param and renders "Supplier Order Detail" heading
- [x] 6.10 Create `src/pages/ShipmentsPage.tsx` — renders heading "Shipments" and "Coming soon" text
- [x] 6.11 Create `src/pages/ReturnRequestsPage.tsx` — renders heading "Return Requests" and "Coming soon" text
- [x] 6.12 Create `src/pages/RefundsPage.tsx` — renders heading "Refunds" and "Coming soon" text
- [x] 6.13 Create `src/pages/NotFoundPage.tsx` — renders a 404 message with a link back to `/products`

## 7. Shared Utility Components

- [x] 7.1 Create `src/components/LoadingSpinner.tsx` — renders a React Bootstrap `<Spinner animation="border" />` centered on the page
- [x] 7.2 Create `src/components/ErrorAlert.tsx` — accepts `message: string` prop and renders a dismissible `<Alert variant="danger">` with the message
- [x] 7.3 Verify both components compile without TypeScript errors and accept typed props

## 8. Service Stub Files

- [x] 8.1 Create `src/services/productService.ts` — exports typed `productService` object with stub methods: `getAll`, `getById`, `create`, `update`, `delete` (each throws `new Error('Not implemented')`)
- [x] 8.2 Create `src/services/categoryService.ts` — same structure as above with methods: `getAll`, `getById`, `create`, `update`, `delete`
- [x] 8.3 Create `src/services/supplierService.ts` — stub methods: `getAll`, `getById`, `create`, `update`, `delete`
- [x] 8.4 Create `src/services/customerService.ts` — stub methods: `getAll`, `getById`, `create`, `update`
- [x] 8.5 Create `src/services/customerOrderService.ts` — stub methods: `getAll`, `getById`, `create`, `updateStatus`
- [x] 8.6 Create `src/services/supplierOrderService.ts` — stub methods: `getAll`, `getById`, `create`, `updateStatus`
- [x] 8.7 Create `src/services/shipmentService.ts` — stub methods: `getAll`, `getById`, `create`, `updateStatus`
- [x] 8.8 Create `src/services/returnRequestService.ts` — stub methods: `getAll`, `getById`, `create`, `updateStatus`
- [x] 8.9 Create `src/services/refundService.ts` — stub methods: `getAll`, `getById`, `create`, `updateStatus`
- [x] 8.10 Verify all service files compile without TypeScript errors and no `any` types are used

## 9. Cypress Stub Test Files

- [x] 9.1 Create `cypress/e2e/products.cy.ts` with an empty `describe('Products', () => {})` block and a placeholder `it.todo('should list products')`
- [x] 9.2 Create `cypress/e2e/categories.cy.ts` — same pattern
- [x] 9.3 Create `cypress/e2e/suppliers.cy.ts` — same pattern
- [x] 9.4 Create `cypress/e2e/customers.cy.ts` — same pattern
- [x] 9.5 Create `cypress/e2e/customerOrders.cy.ts` — same pattern
- [x] 9.6 Create `cypress/e2e/supplierOrders.cy.ts` — same pattern
- [x] 9.7 Create `cypress/e2e/shipments.cy.ts` — same pattern
- [x] 9.8 Create `cypress/e2e/returnRequests.cy.ts` — same pattern
- [x] 9.9 Create `cypress/e2e/refunds.cy.ts` — same pattern

## 10. Review and Update Existing Unit Tests (MANDATORY)

- [x] 10.1 Review the default CRA-generated test file `src/App.test.tsx` — update or remove it so it passes with the new `App.tsx` implementation
- [x] 10.2 Verify no existing test files reference removed CRA boilerplate (logo, default text)
- [x] 10.3 Ensure tests use `@testing-library/react` patterns consistent with the project standards

## 11. Run Unit Tests and Verify Application State (MANDATORY)

- [x] 11.1 Run `npm test -- --watchAll=false` inside `frontend/` and capture results
- [x] 11.2 Confirm all tests pass with zero failures
- [x] 11.3 Run `npx tsc --noEmit` inside `frontend/` and confirm zero TypeScript errors
- [x] 11.4 Note: no database is involved in this change — database state verification is N/A
- [x] 11.5 Create report `openspec/changes/frontend-skeleton/reports/2026-06-12-step-11-unit-test-verification.md`
- [x] 11.6 Mark step complete only after tests pass and report exists

## 12. E2E Testing with Playwright MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 12.1 Start the frontend development server (`npm start` in `frontend/`) and verify it loads on `http://localhost:3001`
- [x] 12.2 Use Playwright MCP `browser_navigate` to open `http://localhost:3001`
- [x] 12.3 Verify the Layout renders with the navigation bar visible
- [x] 12.4 Use Playwright MCP to click each navigation link and verify the correct placeholder page renders
- [x] 12.5 Verify the root `/` redirects to `/products`
- [x] 12.6 Navigate to an unknown path and verify the 404 page renders
- [x] 12.7 Create report `openspec/changes/frontend-skeleton/reports/2026-06-12-step-12-e2e-testing.md`
- [x] 12.8 Mark step complete only after all E2E workflows pass and report exists

## 13. Update Technical Documentation (MANDATORY)

- [x] 13.1 Update `docs/frontend-standards.md` if any conventions were adapted during scaffold (e.g. CRA port configuration, path alias setup details) — leave unchanged if fully conformant
- [x] 13.2 Update `docs/development_guide.md` with the `frontend/` setup steps: install, start, test, Cypress commands
- [x] 13.3 Confirm `docs/api-spec.yml` and `docs/data-model.md` require no changes (frontend skeleton adds no new API endpoints or data model changes)

## 14. Commit and Create Pull Request (MANDATORY - LAST STEP)

- [x] 14.1 Load and apply `ai-specs/skills/commit/SKILL.md`
- [x] 14.2 Verify all tasks above are marked `[x]` and required reports exist under `openspec/changes/frontend-skeleton/reports/`
- [x] 14.3 Stage all relevant files: `frontend/`, `openspec/changes/frontend-skeleton/`, updated `docs/` files (exclude `.env.development`, `node_modules/`, `build/`, `coverage/`)
- [x] 14.4 Create commit with message: `feat(frontend): scaffold React TypeScript frontend skeleton`
- [x] 14.5 Push branch `feature/frontend-skeleton` to remote origin
- [x] 14.6 Create Pull Request with `gh pr create` and report the PR URL in chat
