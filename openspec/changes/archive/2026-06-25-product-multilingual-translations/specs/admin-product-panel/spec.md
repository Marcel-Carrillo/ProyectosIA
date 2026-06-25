## MODIFIED Requirements

### Requirement: Product form includes per-locale name and description fields
The `ProductFormModal` component SHALL render separate `name` and `description` inputs for each supported locale (`en`, `es`), organized as tabs or clearly labeled grouped fields. On submit, the component SHALL build a `translations` array from these inputs and include it in the create or update request payload. On edit, the component SHALL pre-populate the per-locale inputs from the `translations` array returned by the admin API. Both locales MAY be left empty (the English `Product.name` acts as ultimate fallback), but if a locale's `name` is provided, it SHALL not exceed 150 characters.

#### Scenario: Admin creates product with ES and EN translations via form
- **WHEN** an admin fills in both EN and ES name/description fields and submits the product form
- **THEN** the component SHALL send a `translations` array with both locale entries in the API request

#### Scenario: Admin edits product with existing translations
- **WHEN** the product form is opened for a product that has `en` and `es` translations
- **THEN** the EN and ES fields SHALL be pre-populated with the stored translation values

#### Scenario: Admin leaves ES fields empty
- **WHEN** an admin submits the product form without filling in the ES fields
- **THEN** no `es` entry SHALL be included in the `translations` array (the EN or Product fallback applies at read time)

### Requirement: Admin product service sends and receives translations
`adminProductService.createProduct` and `adminProductService.updateProduct` SHALL include the `translations` array in the request body when provided. `adminProductService.getProduct` and `adminProductService.getProducts` SHALL map the `translations` array from the API response to the frontend `ProductTranslation[]` type. The TypeScript types `CreateProductInput`, `UpdateProductInput`, and the product response type SHALL include an optional `translations` field.

#### Scenario: Service maps translations on response
- **WHEN** the admin API returns a product with a `translations` array
- **THEN** `adminProductService.getProduct` SHALL return the product with the correctly typed `translations` array

#### Scenario: Service includes translations on create
- **WHEN** `adminProductService.createProduct` is called with a `translations` array
- **THEN** the HTTP request body SHALL include the `translations` field
