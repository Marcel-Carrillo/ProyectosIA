## REMOVED Requirements

### Requirement: Admin can configure a Spocket connection for a supplier
**Reason**: `Spocket*` was a placeholder integration replaced by the real CJ Dropshipping integration (see `cj-dropshipping-integration`, PR #79). The code, routes, and Prisma models were renamed to CJ terminology at that time, but the OpenSpec capability under `openspec/specs/spocket-connection-management/` was left un-synced. This change performs the overdue rename of the planning artifact to match the code: the entire capability is renamed to `cj-connection-management` (see `specs/cj-connection-management/spec.md` in this change).
**Migration**: See `cj-connection-management` for the equivalent, up-to-date requirement. At sync/archive time, `openspec/specs/spocket-connection-management/` SHALL be removed entirely (not left as an empty shell) in favor of `openspec/specs/cj-connection-management/`.

### Requirement: Admin can retrieve Spocket connection status without secrets
**Reason**: Superseded by the CJ-named equivalent under the renamed capability `cj-connection-management`.
**Migration**: See `cj-connection-management`.

### Requirement: Admin can verify a Spocket connection
**Reason**: Superseded by the CJ-named equivalent under the renamed capability `cj-connection-management`.
**Migration**: See `cj-connection-management`.

### Requirement: Spocket connection endpoints are admin-only and credentials are never exposed
**Reason**: Superseded by the CJ-named equivalent under the renamed capability `cj-connection-management`.
**Migration**: See `cj-connection-management`.
