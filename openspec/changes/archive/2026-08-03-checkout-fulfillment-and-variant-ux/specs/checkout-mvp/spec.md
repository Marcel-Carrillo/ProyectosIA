## ADDED Requirements

### Requirement: Checkout forms are prefilled from the buyer's saved defaults or profile

When an authenticated buyer opens `/checkout`, the shipping form SHALL be prefilled from their default `Shipping` `CustomerAddress` (if one exists) and the billing form SHALL be prefilled from their default `Billing` `CustomerAddress` (if one exists). If no default address of a given type exists, the corresponding form SHALL be prefilled with `firstName`, `lastName`, and `phone` from the buyer's profile only, leaving address fields empty. Guest buyers SHALL NOT receive any server-sourced prefill; their forms start empty. Prefilled values SHALL remain editable before submission.

#### Scenario: Authenticated buyer with saved defaults sees prefilled forms

- **WHEN** an authenticated buyer with a default `Shipping` address and a default `Billing` address opens `/checkout`
- **THEN** the shipping form is prefilled from the default `Shipping` address and the billing form is prefilled from the default `Billing` address

#### Scenario: Authenticated buyer without saved addresses sees profile-only prefill

- **WHEN** an authenticated buyer with no saved `CustomerAddress` records opens `/checkout`
- **THEN** the shipping and billing forms prefill `firstName`, `lastName`, and `phone` from the buyer's profile and leave address fields empty

#### Scenario: Guest buyer sees empty forms

- **WHEN** a guest (unauthenticated) buyer opens `/checkout`
- **THEN** the shipping and billing forms start empty with no server-sourced prefill

#### Scenario: Prefilled values remain editable

- **WHEN** a buyer's checkout forms are prefilled from a default address
- **THEN** the buyer can edit any prefilled field before submitting checkout

### Requirement: Buyer can clone shipping data into billing with "usar mismos datos"

The checkout page SHALL provide a "usar mismos datos" (use same data) control. While enabled, the billing form SHALL mirror the shipping form's field values, and further edits to the shipping form SHALL propagate to the billing form. Disabling the control SHALL leave the last-mirrored billing values in place as an editable, independent form. This control SHALL be available to both guest and authenticated buyers and requires no persistence to function.

#### Scenario: Enabling the control clones shipping into billing

- **WHEN** a buyer has filled the shipping form and enables "usar mismos datos"
- **THEN** the billing form immediately takes on the shipping form's current field values

#### Scenario: Editing shipping while the control is enabled keeps billing in sync

- **WHEN** the control is enabled and the buyer edits a shipping field
- **THEN** the corresponding billing field updates to match

#### Scenario: Disabling the control leaves billing independently editable

- **WHEN** a buyer disables "usar mismos datos" after it cloned values into billing
- **THEN** the billing form keeps its last mirrored values but no longer follows further shipping edits, and the buyer can edit it independently

#### Scenario: Guest buyer can use the clone control

- **WHEN** a guest buyer enables "usar mismos datos" during checkout
- **THEN** billing mirrors shipping for the duration of that checkout session, with no address persisted

### Requirement: Authenticated buyer can save the address entered at checkout as their default

The checkout page SHALL offer authenticated buyers a "save as default" option per address section (shipping, billing). When selected and checkout succeeds, the system SHALL persist the entered address as the buyer's default `CustomerAddress` of the corresponding `type`, replacing any previous default of that type (see `customer-account-authentication`). Declining this option SHALL NOT persist any address and SHALL NOT affect the order, which still snapshots the entered data as usual per the existing checkout snapshot requirement.

#### Scenario: Save as default persists the address

- **WHEN** an authenticated buyer checks "save as default" for shipping, completes checkout successfully, and had no prior default `Shipping` address
- **THEN** the entered shipping address is persisted as their default `Shipping` `CustomerAddress`

#### Scenario: Declining save as default does not persist an address

- **WHEN** an authenticated buyer completes checkout without checking "save as default"
- **THEN** no new `CustomerAddress` record is created from that checkout submission

#### Scenario: Order snapshot is unaffected by the save-as-default choice

- **WHEN** an authenticated buyer checks "save as default" and completes checkout
- **THEN** the created `CustomerOrder` still snapshots `shippingAddressSnapshot`/`billingAddressSnapshot` exactly as entered, independent of the saved default address record
