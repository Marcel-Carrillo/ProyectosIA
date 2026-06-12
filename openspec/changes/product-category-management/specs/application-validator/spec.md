## ADDED Requirements

### Requirement: Validator exports a validateCategoryData function
`src/application/validator.ts` SHALL export a `validateCategoryData(data: Record<string, unknown>): void` function. The function MUST verify that `name` is present and non-empty. If `status` is provided, it MUST be one of `Active` or `Inactive`. If `parentId` is provided, it MUST be a positive integer.

#### Scenario: Valid category data passes validation
- **WHEN** `validateCategoryData({ name: 'Dresses', status: 'Active' })` is called
- **THEN** the function returns without throwing

#### Scenario: Missing name throws validation error
- **WHEN** `validateCategoryData({ description: 'Some description' })` is called
- **THEN** the function throws a `ValidationError` identifying `name` as required

#### Scenario: Invalid status value throws validation error
- **WHEN** `validateCategoryData({ name: 'Dresses', status: 'Published' })` is called
- **THEN** the function throws a `ValidationError` indicating `status` must be `Active` or `Inactive`
