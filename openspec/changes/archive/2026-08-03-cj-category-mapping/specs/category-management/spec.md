## ADDED Requirements

### Requirement: Supplier category mappings link an external supplier taxonomy id to a local Category
The system SHALL maintain a `SupplierCategoryMapping` record linking a `(provider, externalCategoryId)` pair to a local `Category`. The system SHALL enforce uniqueness on the `(provider, externalCategoryId)` pair so a given supplier category maps to at most one local `Category`. Finding-or-creating a mapping SHALL be a single idempotent operation: if no mapping exists for the pair, the system creates both a new `Category` and its mapping in the same operation; if a mapping already exists, the system reuses the linked `Category` without creating a duplicate. A `Category` created through this mechanism SHALL default to `status = Inactive` (unlike categories created directly via `POST /categories`, which default to `Active`) so an admin reviews and activates it before it appears in customer-facing category navigation. This capability does not alter any existing category CRUD API behavior, response envelope, or endpoint.

#### Scenario: First promotion of a new supplier category creates the local category and its mapping
- **WHEN** no `SupplierCategoryMapping` exists yet for a given `(provider, externalCategoryId)` pair
- **THEN** the system creates a new `Category` with `status = Inactive` and a `SupplierCategoryMapping` linking the pair to it, and returns that category

#### Scenario: A previously mapped supplier category is reused
- **WHEN** a `SupplierCategoryMapping` already exists for a given `(provider, externalCategoryId)` pair
- **THEN** the system returns the already-linked `Category` and does not create a new one

#### Scenario: Concurrent find-or-create for the same supplier category does not create duplicates
- **WHEN** two concurrent requests attempt to find-or-create a mapping for the same `(provider, externalCategoryId)` pair that does not yet exist
- **THEN** only one `Category` and one `SupplierCategoryMapping` row end up persisted, and both callers resolve to the same `Category`

#### Scenario: Category CRUD is unaffected
- **WHEN** an admin performs any create, read, update, or delete operation on a category directly via the existing category endpoints
- **THEN** the behavior is identical to the existing category-management spec — supplier category mappings do not alter category endpoints, responses, or the default `Active` status for directly-created categories
