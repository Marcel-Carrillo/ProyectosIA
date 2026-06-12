## ADDED Requirements

### Requirement: Category has a products relation
The system SHALL maintain a one-to-many relationship between `Category` and `Product` at the database level. A product MAY belong to one category via `categoryId`. A category MAY have zero or more products. This relation is stored in the `products` table via the `categoryId` foreign key and does not change any existing category CRUD API behavior.

#### Scenario: Product is created with a categoryId
- **WHEN** admin creates a product with a valid `categoryId`
- **THEN** the product is associated with that category in the database

#### Scenario: Product is created without a categoryId
- **WHEN** admin creates a product without a `categoryId`
- **THEN** the product is created with `categoryId` as null and is not linked to any category

#### Scenario: Category CRUD is unaffected
- **WHEN** admin performs any create, read, update, or delete operation on a category
- **THEN** the behavior is identical to the existing category-management spec — the products relation does not alter category endpoints or responses
