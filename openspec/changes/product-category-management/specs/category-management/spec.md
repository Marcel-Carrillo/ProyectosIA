## ADDED Requirements

### Requirement: Category entity has required and optional fields
The system SHALL model a `Category` domain entity with the following fields: `id` (auto-incremented integer, primary key), `name` (string, unique, required), `description` (string, optional), `imageUrl` (string, optional), `status` (string, `Active` or `Inactive`, defaults to `Active`), `parentId` (integer, optional, references another Category), `createdAt` (DateTime), `updatedAt` (DateTime).

#### Scenario: Category is created with required fields only
- **WHEN** a category is created with only `name` provided
- **THEN** the category is persisted with `status = Active`, `description = null`, `imageUrl = null`, `parentId = null`

#### Scenario: Category is created with all fields
- **WHEN** a category is created with `name`, `description`, `imageUrl`, and `parentId` all provided
- **THEN** all fields are persisted correctly on the category record

---

### Requirement: Category name must be unique
The system SHALL enforce that no two categories share the same `name`. Attempting to create or update a category with a name already in use by another category MUST return an error.

#### Scenario: Duplicate name on create
- **WHEN** `POST /categories` is called with a `name` that already exists
- **THEN** the system returns HTTP 409 with `code: "CATEGORY_NAME_ALREADY_EXISTS"`

#### Scenario: Duplicate name on update
- **WHEN** `PUT /categories/:id` is called with a `name` already used by a different category
- **THEN** the system returns HTTP 409 with `code: "CATEGORY_NAME_ALREADY_EXISTS"`

---

### Requirement: Categories support an optional parent-child hierarchy
A `Category` MAY reference another category via `parentId` to form a two-level hierarchy. A category MUST NOT reference itself as its own parent.

#### Scenario: Category created with valid parentId
- **WHEN** `POST /categories` is called with a `parentId` referencing an existing category
- **THEN** the category is created and linked to the parent

#### Scenario: Category self-reference is rejected
- **WHEN** `PUT /categories/:id` is called with `parentId` equal to the category's own `id`
- **THEN** the system returns HTTP 422 with a validation error

---

### Requirement: List categories returns active categories by default
`GET /categories` SHALL return only categories with `status = Active` unless `includeInactive=true` query parameter is provided.

#### Scenario: List without query parameter
- **WHEN** `GET /categories` is called without query parameters
- **THEN** only categories with `status = Active` are returned

#### Scenario: List with includeInactive flag
- **WHEN** `GET /categories?includeInactive=true` is called
- **THEN** all categories regardless of status are returned

---

### Requirement: Get category by ID returns category or 404
`GET /categories/:id` SHALL return the full category record if it exists. If the category does not exist, the system MUST return HTTP 404.

#### Scenario: Category found
- **WHEN** `GET /categories/:id` is called with a valid existing category ID
- **THEN** the system returns HTTP 200 with the category data

#### Scenario: Category not found
- **WHEN** `GET /categories/:id` is called with a non-existent ID
- **THEN** the system returns HTTP 404 with `code: "CATEGORY_NOT_FOUND"`

---

### Requirement: Create category returns the created record
`POST /categories` SHALL validate input, enforce name uniqueness, and persist a new category. On success it MUST return HTTP 201 with the created category.

#### Scenario: Successful category creation
- **WHEN** `POST /categories` is called with a valid `name`
- **THEN** the system returns HTTP 201 with the newly created category including its generated `id`

---

### Requirement: Update category modifies allowed fields
`PUT /categories/:id` SHALL update `name`, `description`, `imageUrl`, `status`, and `parentId` fields. It MUST return HTTP 404 if the category does not exist. Name uniqueness and self-reference constraints MUST be enforced.

#### Scenario: Successful update
- **WHEN** `PUT /categories/:id` is called with a new valid `name`
- **THEN** the system returns HTTP 200 with the updated category

#### Scenario: Update non-existent category
- **WHEN** `PUT /categories/:id` is called with a non-existent ID
- **THEN** the system returns HTTP 404 with `code: "CATEGORY_NOT_FOUND"`

---

### Requirement: Delete category performs a soft-delete
`DELETE /categories/:id` SHALL set `status = Inactive` on the category rather than removing the row. If the category does not exist, the system MUST return HTTP 404.

#### Scenario: Successful soft-delete
- **WHEN** `DELETE /categories/:id` is called with an existing category ID
- **THEN** the system sets `status = Inactive` and returns HTTP 200 with the updated category

#### Scenario: Delete non-existent category
- **WHEN** `DELETE /categories/:id` is called with a non-existent ID
- **THEN** the system returns HTTP 404 with `code: "CATEGORY_NOT_FOUND"`

---

### Requirement: API responses follow the standard envelope format
All category endpoints MUST return responses wrapped in the standard envelope: `{ success: true, data: ..., message: ... }` for success and `{ success: false, error: { message: ..., code: ... } }` for errors.

#### Scenario: Successful response structure
- **WHEN** any category endpoint returns a success response
- **THEN** the body contains `success: true` and a `data` field with the category or category array

#### Scenario: Error response structure
- **WHEN** any category endpoint returns an error
- **THEN** the body contains `success: false` and an `error` object with `message` and `code` fields
