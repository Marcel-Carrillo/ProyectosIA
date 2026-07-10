## ADDED Requirements

### Requirement: Admin can configure a CJ Dropshipping connection from the CJ Catalog admin page
The admin panel SHALL provide a connection panel on the CJ Catalog page (`suppliers/:supplierId/cj-catalog`) that lets an administrator create or update the CJ Dropshipping connection without leaving the page. The panel SHALL present a "Configure connection" action that opens a form accepting only an optional `externalAccountRef` text field (max 150 characters); the form SHALL NOT present any field for an API key, secret, or credential of any kind. Submitting the form SHALL call `POST /api/admin/suppliers/:supplierId/cj/connection` and, on success, SHALL refresh the panel to reflect the created or updated connection.

#### Scenario: Admin configures a connection for the first time
- **WHEN** an administrator opens the CJ Catalog page for a supplier with no existing connection and submits the "Configure connection" form (with or without an `externalAccountRef`)
- **THEN** the admin panel calls `POST .../cj/connection`, and on success displays the connection panel with `status = Disconnected` and the submitted `externalAccountRef`

#### Scenario: Admin updates an existing connection's account reference
- **WHEN** an administrator opens "Configure connection" for a supplier that already has a connection and changes the `externalAccountRef`
- **THEN** the admin panel calls `POST .../cj/connection` and refreshes the panel with the updated value

#### Scenario: No credential input is ever rendered
- **WHEN** an administrator opens the "Configure connection" form
- **THEN** the only editable field is `externalAccountRef`; no password-type or credential-labeled field is present anywhere in the form

### Requirement: Admin can view CJ Dropshipping connection status on the CJ Catalog admin page
On loading the CJ Catalog page, the admin panel SHALL call `GET /api/admin/suppliers/:supplierId/cj/connection` and render the result in a connection panel showing `provider`, `status`, `externalAccountRef`, `lastVerifiedAt`, and `lastSyncedAt`. When the backend returns `404 CJ_CONNECTION_NOT_FOUND`, the admin panel SHALL render a "not configured" state with a "Configure connection" call to action instead of a generic error message, and SHALL NOT attempt to load the staged catalog list in this state.

#### Scenario: Connection status renders for a configured supplier
- **WHEN** an administrator opens the CJ Catalog page for a supplier with an existing connection
- **THEN** the panel displays the connection's `status`, `externalAccountRef` (or a placeholder when null), `lastVerifiedAt`, and `lastSyncedAt`

#### Scenario: Missing connection shows a configuration call to action, not a bare error
- **WHEN** an administrator opens the CJ Catalog page for a supplier with no configured connection
- **THEN** the admin panel shows the "not configured" panel state with a "Configure connection" action, and does not render the previous bare `CJ_CONNECTION_NOT_FOUND` error message, and does not call the staged catalog list endpoint

### Requirement: Admin can verify the CJ Dropshipping connection from the CJ Catalog admin page
The connection panel SHALL provide a "Verify" action that calls `POST /api/admin/suppliers/:supplierId/cj/connection/verify`. While the request is in flight, the action SHALL be disabled to prevent duplicate submissions. On response, the admin panel SHALL refresh the connection panel (reflecting the updated `status` and `lastVerifiedAt`) and SHALL display the returned `healthy` outcome and, when present, the `reason` string verbatim. When the backend returns HTTP `429` for exceeding the verification rate limit, the admin panel SHALL display a message indicating the admin must wait before retrying, without treating it as a generic failure.

#### Scenario: Successful verification updates the panel
- **WHEN** an administrator clicks "Verify" and the backend returns `{ healthy: true }`
- **THEN** the admin panel shows a success indication, and the panel's `status` and `lastVerifiedAt` refresh to the updated values

#### Scenario: Failed verification surfaces the backend reason
- **WHEN** an administrator clicks "Verify" and the backend returns `{ healthy: false, reason }`
- **THEN** the admin panel shows a warning containing the `reason` text as returned by the backend, and the panel's `status` and `lastVerifiedAt` refresh

#### Scenario: Rate limit is handled distinctly from a generic error
- **WHEN** an administrator clicks "Verify" after exceeding the endpoint's rate limit and the backend returns `429`
- **THEN** the admin panel shows a message indicating too many verification attempts and to retry later, and does not treat the response as a connection failure

#### Scenario: Verify action is disabled while in flight
- **WHEN** an administrator clicks "Verify"
- **THEN** the "Verify" action becomes disabled until the request completes, preventing a second concurrent verification request
