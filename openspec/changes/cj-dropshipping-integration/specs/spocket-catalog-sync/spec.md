## REMOVED Requirements

### Requirement: Admin can trigger a read-only Spocket catalog and inventory pull
**Reason**: Spocket has no public developer API — this requirement was built against an assumed, never-validated contract. Replaced by the real, live-validated CJ Dropshipping catalog endpoints (`getCategory`, `listV2`, `variant/query`, stock queries).
**Migration**: See `cj-catalog-sync`, "Admin can trigger a read-only CJ Dropshipping catalog and inventory pull".

### Requirement: Partial sync failures are reported per item without aborting the whole sync
**Reason**: Same underlying sync mechanism, now against the real CJ response envelope (body-based success/failure, not HTTP status).
**Migration**: See `cj-catalog-sync`, "Partial sync failures are reported per item without aborting the whole sync".

### Requirement: Admin can list staged Spocket catalog items for review
**Reason**: Route base path and staging model rename (`SpocketCatalogItem` → `CjCatalogItem`).
**Migration**: See `cj-catalog-sync`, "Admin can list staged CJ Dropshipping catalog items for review".

### Requirement: Staged Spocket data and supplier cost are never exposed on customer-facing APIs
**Reason**: Route base path moves from `/api/admin/suppliers/:supplierId/spocket/*` to `/api/admin/suppliers/:supplierId/cj/*`.
**Migration**: See `cj-catalog-sync`, "Staged CJ Dropshipping data and supplier cost are never exposed on customer-facing APIs".
