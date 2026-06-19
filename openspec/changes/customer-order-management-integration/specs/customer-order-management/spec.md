## VERIFIED Requirements

No requirement changes for KAN-30. Full-stack delivery is verified against the authoritative main spec at `openspec/specs/customer-order-management/spec.md`.

### Verification checklist (KAN-30 integration)

The apply agent SHALL confirm each item before marking the change complete:

#### Scenario: Backend and frontend run together on integration branch

- **WHEN** backend (:3000) and frontend (:3001) start against the same database
- **THEN** admin navigation to `/customer-orders` loads the list without API errors

#### Scenario: Admin list with filters and date range

- **WHEN** an admin uses `CustomerOrdersPage` with status filters, search, and `createdFrom`/`createdTo`
- **THEN** `GET /api/admin/customer-orders` requests include the correct query params and return filtered results in the standard envelope

#### Scenario: Admin detail with status timeline and status control

- **WHEN** an admin opens an order detail page
- **THEN** line items, address snapshots, totals, `OrderStatusTimeline`, and `OrderStatusControl` render correctly

#### Scenario: Three status dimensions update independently via UI

- **WHEN** an admin changes `status`, `paymentStatus`, and `fulfillmentStatus` via `OrderStatusControl`
- **THEN** each PATCH succeeds, badges update, and invalid transitions return visible errors

#### Scenario: Supplier fields never appear in API or DOM

- **WHEN** any customer order API response or rendered admin page is inspected
- **THEN** no `supplierId`, `supplierReference`, or `supplierCost` is present

#### Scenario: No public customer-order admin route

- **WHEN** `GET /api/public/customer-orders` is requested
- **THEN** the route does not exist or returns `404`

#### Scenario: Cypress E2E passes headless

- **WHEN** `cd frontend && npx cypress run --spec cypress/e2e/customer-orders.cy.ts` executes
- **THEN** all specs pass at viewports covering 360/768/1280px width checks

#### Scenario: Database state restored after tests

- **WHEN** curl and E2E create test orders
- **THEN** all created orders are deleted and `CustomerOrder` row count matches the pre-test baseline
