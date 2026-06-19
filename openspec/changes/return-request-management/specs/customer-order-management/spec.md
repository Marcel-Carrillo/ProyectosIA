## ADDED Requirements

### Requirement: Admin can initiate a return request from the order detail page

The system SHALL display a "Create Return" action button on `CustomerOrderDetailPage`, accessible per order item. The button SHALL be visible for orders whose `status` is not `Cancelled`. Clicking the button SHALL navigate to or open the create-return-request form with `customerOrderId` and `customerOrderItemId` pre-filled. The order detail page SHALL also display a link to the list of return requests filtered by `customerOrderId`.

#### Scenario: Create Return button is visible for an active order

- **WHEN** an admin views a customer order with `status` other than `Cancelled`
- **THEN** a "Create Return" action is displayed for each order item

#### Scenario: Create Return button is not shown for cancelled orders

- **WHEN** an admin views a customer order with `status = Cancelled`
- **THEN** no "Create Return" action is displayed

#### Scenario: Create Return pre-fills order and item context

- **WHEN** an admin clicks the "Create Return" action for a specific item
- **THEN** the system navigates to the return request creation form with `customerOrderId` and `customerOrderItemId` pre-filled

#### Scenario: Order detail links to the order's return requests

- **WHEN** an admin views a customer order that has at least one return request
- **THEN** a link to `return-requests?customerOrderId=<id>` is displayed on the order detail page
