## REMOVED Requirements

### Requirement: Admin can trigger a read-only Spocket catalog and inventory pull
**Reason**: `Spocket*` was a placeholder integration replaced by the real CJ Dropshipping integration (see `cj-dropshipping-integration`, PR #79). The code, routes, and Prisma models were renamed to CJ terminology at that time, but the OpenSpec capability under `openspec/specs/spocket-catalog-sync/` was left un-synced. This change performs the overdue rename of the planning artifact to match the code: the entire capability is renamed to `cj-catalog-sync` (see `specs/cj-catalog-sync/spec.md` in this change), which also adds the `promotionState` reporting this change introduces.
**Migration**: See `cj-catalog-sync` for the equivalent, up-to-date requirement. At sync/archive time, `openspec/specs/spocket-catalog-sync/` SHALL be removed entirely (not left as an empty shell) in favor of `openspec/specs/cj-catalog-sync/`.

### Requirement: Partial sync failures are reported per item without aborting the whole sync
**Reason**: Superseded by the CJ-named equivalent under the renamed capability `cj-catalog-sync`.
**Migration**: See `cj-catalog-sync`.

### Requirement: Admin can list staged Spocket catalog items for review
**Reason**: Superseded by the CJ-named equivalent under the renamed capability `cj-catalog-sync`, which also adds `promotionState`/`productId`/`productVariantId` reporting.
**Migration**: See `cj-catalog-sync`.

### Requirement: Staged Spocket data and supplier cost are never exposed on customer-facing APIs
**Reason**: Superseded by the CJ-named equivalent under the renamed capability `cj-catalog-sync`.
**Migration**: See `cj-catalog-sync`.
