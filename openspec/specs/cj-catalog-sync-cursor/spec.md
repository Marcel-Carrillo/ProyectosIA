# Spec: CJ Catalog Sync Cursor

## Purpose

Cursor-based pagination for the CJ Dropshipping catalog sync (`cj-catalog-sync`): each sync run continues from the last successfully processed catalog page instead of restarting at page 1, wraps around when the end of the catalog is reached to periodically refresh previously-synced items, stays idempotent under catalog drift, and bounds per-run work to complete safely within the hosting environment's execution time limit.

## Requirements

### Requirement: Catalog sync advances via a persisted cursor
The system SHALL persist the last catalog page successfully processed for a supplier connection, and each subsequent sync run SHALL continue from that position rather than restarting from the first page.

#### Scenario: Second sync run continues past the first run's window
- **WHEN** a sync run completes having processed pages 1 through N
- **THEN** the next sync run SHALL begin at page N+1, not page 1

#### Scenario: First-ever sync run for a connection starts at page 1
- **WHEN** a supplier connection has never been synced before
- **THEN** the first sync run SHALL begin at page 1

### Requirement: Reaching the end of the catalog wraps around
The system SHALL detect when a sync run reaches or passes the last page of the supplier's catalog and SHALL reset the cursor so the next run starts again from page 1, enabling periodic refresh of previously-synced items.

#### Scenario: Sync run reaches the last page
- **WHEN** a sync run's page window reaches or exceeds the catalog's total page count
- **THEN** the system SHALL reset the persisted cursor to the beginning and record when the wrap-around occurred

#### Scenario: Sync run stays within the catalog bounds
- **WHEN** a sync run's page window ends before the catalog's total page count
- **THEN** the system SHALL persist the last page processed as the new cursor position without wrapping

### Requirement: Sync remains idempotent across cursor advancement
Re-processing a catalog item already synced in a previous run (for example, due to page-number drift when the upstream catalog changes between runs) SHALL update the existing staged item rather than create a duplicate.

#### Scenario: An item is encountered again after catalog drift
- **WHEN** a sync run processes a catalog item that was already synced in a previous run
- **THEN** the system SHALL update the existing staged item's data rather than create a duplicate entry

### Requirement: Per-run sync size stays within a safe execution time budget
The system SHALL bound the number of pages and items processed in a single sync run to a size that reliably completes well within the hosting environment's execution time limit, based on the measured cost of processing each item.

#### Scenario: A sync run completes within the safety margin
- **WHEN** a sync run processes its configured page/size window
- **THEN** the run SHALL complete in a duration that leaves substantial safety margin below the environment's maximum execution time, under normal network conditions
