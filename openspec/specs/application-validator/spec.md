# Application Validator

## Purpose

Provides reusable validation utilities for the application layer. Ensures that incoming data meets required field constraints before business logic executes, and exposes a typed error class that the global error handler can identify and map to HTTP 400 responses.

## Requirements

### Requirement: Base validator module exports a validateRequiredFields utility
`src/application/validator.ts` SHALL export a `validateRequiredFields(data: Record<string, unknown>, fields: string[]): void` function. If any field in `fields` is `undefined`, `null`, or an empty string, the function MUST throw a typed validation error with a descriptive message identifying the missing field.

#### Scenario: All required fields are present
- **WHEN** `validateRequiredFields({ name: 'Test', status: 'Active' }, ['name', 'status'])` is called
- **THEN** the function returns without throwing

#### Scenario: A required field is missing
- **WHEN** `validateRequiredFields({ name: 'Test' }, ['name', 'status'])` is called
- **THEN** the function throws a validation error with a message identifying `status` as missing

#### Scenario: A required field is empty string
- **WHEN** `validateRequiredFields({ name: '' }, ['name'])` is called
- **THEN** the function throws a validation error indicating `name` cannot be empty

---

### Requirement: Validation errors are a named error type distinguishable from other errors
The validator SHALL throw errors of a specific class (e.g., `ValidationError`) that extends `Error`. The global error handler MUST be able to identify this type and map it to HTTP 400.

#### Scenario: Validator error is caught by global error handler
- **WHEN** a route handler calls `validateRequiredFields` and it throws
- **THEN** the global error handler catches a `ValidationError` instance and returns HTTP 400 with `code: "VALIDATION_ERROR"`
