## ADDED Requirements

### Requirement: Scheduled auto-provisioning job
The system SHALL run a scheduled backend job, independent of any HTTP request, that executes once every 24 hours to auto-provision and refresh supplier catalog data for every supported supplier provider with a configured credential. This is an internal/administrative capability; it has no customer-facing behavior.

#### Scenario: Job runs on schedule
- **WHEN** 24 hours have elapsed since the job's last scheduled invocation
- **THEN** the job SHALL execute automatically without any admin or customer action

#### Scenario: Job disabled via kill-switch
- **WHEN** the `SUPPLIER_AUTO_PROVISION_ENABLED` configuration is set to `false`
- **THEN** the job SHALL exit without making any changes and SHALL log that it is disabled

### Requirement: Auto-create missing supplier connection
For each supplier provider with a configured API credential, the system SHALL automatically create the `Supplier` and `SupplierIntegration` records if none exist yet for that provider, without requiring an admin to create or configure them manually.

#### Scenario: No existing CJ Dropshipping supplier
- **WHEN** the job runs and `CJDROPSHIPPING_API_KEY` is configured (non-empty, not a placeholder value) and no `SupplierIntegration` with `provider = "CJDropshipping"` exists
- **THEN** the system SHALL create a new `Supplier` record and a corresponding `SupplierIntegration` record for CJ Dropshipping

#### Scenario: Existing CJ Dropshipping supplier is reused
- **WHEN** the job runs and a `SupplierIntegration` with `provider = "CJDropshipping"` already exists
- **THEN** the system SHALL reuse that existing `Supplier`/`SupplierIntegration` pair and SHALL NOT create a duplicate

#### Scenario: Provider credential not configured
- **WHEN** a supplier provider has no configured API credential (missing or empty)
- **THEN** the system SHALL skip auto-provisioning for that provider and SHALL NOT create a `Supplier` or `SupplierIntegration` for it

### Requirement: Auto-verify and auto-sync connection
After ensuring a supplier connection exists, the system SHALL automatically verify the connection and, if healthy, automatically synchronize the provider's catalog into staging records, without requiring an admin to trigger verification or sync manually.

#### Scenario: Connection verified successfully
- **WHEN** the auto-provisioned or existing supplier connection is verified and the provider reports it as healthy
- **THEN** the system SHALL update the connection status to `Connected` and SHALL proceed to synchronize the catalog

#### Scenario: Connection verification fails
- **WHEN** the connection verification reports the provider as unhealthy or unreachable
- **THEN** the system SHALL update the connection status to `Error`, SHALL NOT attempt to synchronize the catalog for that provider on this run, and SHALL continue processing any other configured provider

#### Scenario: Catalog sync populates staging items
- **WHEN** the connection is `Connected`
- **THEN** the system SHALL synchronize the provider's catalog into staging catalog item records, creating new items and updating previously synced items as the existing manual sync capability already does

### Requirement: Auto-promote synced items into Draft products
After a successful catalog sync, the system SHALL automatically promote staged catalog items that have not yet been promoted into real product and product variant records, so they are visible in the admin Products panel without requiring an admin to trigger promotion manually. Promoted products SHALL default to a non-public (Draft) status.

#### Scenario: Newly synced items are auto-promoted
- **WHEN** the catalog sync completes and staging items exist with a successful sync status and no linked product variant yet
- **THEN** the system SHALL promote those items into `Product`/`ProductVariant` records using a fixed default category and the existing default markup pricing rule, with the resulting product status set to `Draft`

#### Scenario: Already-promoted items are not re-promoted
- **WHEN** a staging catalog item is already linked to an existing product variant
- **THEN** the system SHALL NOT create a duplicate product or product variant for that item on subsequent runs

#### Scenario: Default category missing or misconfigured
- **WHEN** the configured default category for auto-promotion does not exist or is not configured
- **THEN** the system SHALL skip auto-promotion for that provider on this run, SHALL leave the synced staging items unpromoted, and SHALL log the failure, while the earlier sync results remain persisted

#### Scenario: A single item's price cannot be resolved
- **WHEN** one or more staged items among an otherwise-promotable batch cannot resolve a valid price (for example, a zero-cost item with no default markup applicable)
- **THEN** the system SHALL still promote every other item in that batch, SHALL leave only the unresolvable item(s) unpromoted for a later run, and SHALL log which items were excluded and why

#### Scenario: Auto-promoted product requires manual activation
- **WHEN** a product has been auto-promoted by this job
- **THEN** the product SHALL remain in `Draft` status and SHALL NOT be visible through any customer-facing storefront route until an admin explicitly activates it

### Requirement: Idempotent and isolated execution across runs and providers
The job SHALL be safe to run repeatedly without producing duplicate data, and a failure while processing one provider SHALL NOT prevent other providers from being processed in the same run.

#### Scenario: Consecutive runs produce no duplicates
- **WHEN** the job runs twice in succession with no new upstream catalog changes
- **THEN** the second run SHALL NOT create any additional `Supplier`, `SupplierIntegration`, `Product`, or `ProductVariant` records beyond those created by the first run

#### Scenario: One provider's failure does not block others
- **WHEN** processing one supplier provider raises an unexpected error at any step of the pipeline
- **THEN** the system SHALL record that failure for that provider only and SHALL continue attempting to process any remaining configured providers in the same run

#### Scenario: Overlapping executions are prevented
- **WHEN** a new execution of the job starts while a previous execution for the same provider has not yet finished
- **THEN** the system SHALL skip the new execution for that provider rather than running both concurrently

### Requirement: No unauthenticated HTTP trigger
The auto-provisioning job SHALL NOT be triggered by any public or unauthenticated HTTP endpoint. It SHALL only be invocable by the scheduled infrastructure trigger.

#### Scenario: No public route exists for the job
- **WHEN** any HTTP request is made attempting to trigger the auto-provisioning pipeline directly
- **THEN** no such public or customer-facing route SHALL exist to serve that request
