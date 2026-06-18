## ADDED Requirements

### Requirement: Admin can list suppliers with pagination, search and status filter
The system SHALL expose `GET /api/admin/suppliers` returning suppliers in the standard response envelope `{ success, data, message }` where `data` contains `{ items, total, page, pageSize }`. The endpoint SHALL accept `page` (default 1), `pageSize` (default 20, clamped to a maximum of 100), `search` (case-insensitive match on `name`), and `status` (`Active`, `Inactive`, or `Blocked`). This is an internal admin capability; suppliers SHALL NOT be exposed on any customer-facing endpoint. Field definitions follow `docs/data-model.md` (Supplier).

#### Scenario: List returns paginated suppliers
- **WHEN** an admin requests `GET /api/admin/suppliers`
- **THEN** the system returns `200` with up to 20 suppliers in `data.items` and the correct `total`, `page`, and `pageSize`

#### Scenario: Search by name
- **WHEN** an admin requests `GET /api/admin/suppliers?search=acme`
- **THEN** the system returns only suppliers whose `name` contains "acme" (case-insensitive)

#### Scenario: Filter by status
- **WHEN** an admin requests `GET /api/admin/suppliers?status=Inactive`
- **THEN** the system returns only suppliers with `status = Inactive`

#### Scenario: Page size is bounded
- **WHEN** an admin requests a `pageSize` greater than 100
- **THEN** the system clamps the page size to 100 instead of returning an unbounded result set

### Requirement: Admin can retrieve a single supplier
The system SHALL expose `GET /api/admin/suppliers/:id` (numeric id) returning the full supplier record in the standard envelope, including internal fields such as `notes`. A non-existent id SHALL return `404` with error code `SUPPLIER_NOT_FOUND`; a non-numeric id SHALL return `400` with error code `VALIDATION_ERROR`.

#### Scenario: Get an existing supplier
- **WHEN** an admin requests `GET /api/admin/suppliers/:id` for an existing supplier
- **THEN** the system returns `200` with the supplier record including `contactName`, `contactEmail`, `contactPhone`, `website`, `notes`, and `status`

#### Scenario: Get a missing supplier
- **WHEN** an admin requests `GET /api/admin/suppliers/:id` for an id that does not exist
- **THEN** the system returns `404` with error code `SUPPLIER_NOT_FOUND`

#### Scenario: Non-numeric id is rejected
- **WHEN** an admin requests `GET /api/admin/suppliers/abc`
- **THEN** the system returns `400` with error code `VALIDATION_ERROR`

### Requirement: Admin can create a supplier
The system SHALL expose `POST /api/admin/suppliers` to create a supplier. `name` is required (max 150 characters). `contactName` (max 150), `contactEmail` (max 255, valid email format if provided), `contactPhone` (max 30), `website` (max 500), and `notes` (max 2000, internal only) are optional. `status` SHALL default to `Active` when not provided and MUST be one of `Active`, `Inactive`, `Blocked`. On success the system SHALL return `201` with the created supplier. Validation failures SHALL return `400` with error code `VALIDATION_ERROR` and not persist any record.

#### Scenario: Create with valid data
- **WHEN** an admin submits `POST /api/admin/suppliers` with a valid `name`
- **THEN** the system creates the supplier with `status = Active` and returns `201` with the created record

#### Scenario: Missing required name
- **WHEN** an admin submits `POST /api/admin/suppliers` without a `name`
- **THEN** the system returns `400` with error code `VALIDATION_ERROR` and creates no record

#### Scenario: Invalid contact email
- **WHEN** an admin submits a `contactEmail` that is not a valid email format
- **THEN** the system returns `400` with error code `VALIDATION_ERROR` and creates no record

#### Scenario: Invalid status value
- **WHEN** an admin submits a `status` that is not `Active`, `Inactive`, or `Blocked`
- **THEN** the system returns `400` with error code `VALIDATION_ERROR`

### Requirement: Admin can update a supplier
The system SHALL expose `PATCH /api/admin/suppliers/:id` for partial updates of any editable field (`name`, `contactName`, `contactEmail`, `contactPhone`, `website`, `notes`, `status`). The same field validation rules as creation SHALL apply to provided fields. Updating a missing supplier SHALL return `404` with error code `SUPPLIER_NOT_FOUND`. A successful update SHALL return `200` with the updated supplier.

#### Scenario: Partial update of contact details
- **WHEN** an admin submits `PATCH /api/admin/suppliers/:id` changing only `contactEmail`
- **THEN** the system updates that field, leaves other fields unchanged, and returns `200` with the updated record

#### Scenario: Status transition to Blocked
- **WHEN** an admin updates a supplier's `status` to `Blocked`
- **THEN** the system persists `status = Blocked` and returns `200`

#### Scenario: Update validation failure keeps record unchanged
- **WHEN** an admin submits an invalid field value (e.g. `name` exceeding 150 characters)
- **THEN** the system returns `400` with error code `VALIDATION_ERROR` and does not modify the supplier

#### Scenario: Update a missing supplier
- **WHEN** an admin submits `PATCH /api/admin/suppliers/:id` for an id that does not exist
- **THEN** the system returns `404` with error code `SUPPLIER_NOT_FOUND`

### Requirement: Admin can soft-delete a supplier via status
The system SHALL expose `DELETE /api/admin/suppliers/:id` which performs a soft-delete by setting `status = Inactive`. The supplier row SHALL NOT be physically removed, preserving referential integrity with associated `ProductVariant` records (and future `SupplierOrder` records). Deleting a missing supplier SHALL return `404` with error code `SUPPLIER_NOT_FOUND`.

#### Scenario: Soft-delete deactivates the supplier
- **WHEN** an admin requests `DELETE /api/admin/suppliers/:id` for an existing supplier
- **THEN** the system sets the supplier's `status` to `Inactive`, keeps the row in the database, and returns a success response

#### Scenario: Associated product variants are not affected
- **WHEN** a supplier that is referenced by one or more `ProductVariant` records is soft-deleted
- **THEN** those variants and the catalog remain intact and the supplier row is preserved

#### Scenario: Soft-delete a missing supplier
- **WHEN** an admin requests `DELETE /api/admin/suppliers/:id` for an id that does not exist
- **THEN** the system returns `404` with error code `SUPPLIER_NOT_FOUND`

### Requirement: Supplier data is never exposed on customer-facing APIs
The system SHALL NOT expose any supplier endpoint under `/api/public/*`, and SHALL NOT include supplier records, supplier internal `notes`, or the variant supplier fields `supplierId`, `supplierReference`, and `supplierCost` in any customer-facing response. This preserves the existing public product serialization allow-list (`docs/data-model.md` and `docs/api-spec.yml` public schemas).

#### Scenario: No public supplier endpoint exists
- **WHEN** a client requests any `/api/public/suppliers` path
- **THEN** the system does not serve supplier data (the route does not exist)

#### Scenario: Public product responses omit supplier fields
- **WHEN** a client receives any `/api/public/products` or `/api/public/products/:id` response
- **THEN** no `supplierId`, `supplierReference`, `supplierCost`, or supplier `notes` field is present anywhere in the payload
