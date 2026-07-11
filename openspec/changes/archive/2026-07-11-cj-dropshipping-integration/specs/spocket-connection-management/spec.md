## REMOVED Requirements

### Requirement: Admin can configure a Spocket connection for a supplier
**Reason**: Spocket has no public developer API — this requirement was built against an assumed, never-validated contract. Replaced by the real, live-validated CJ Dropshipping contract.
**Migration**: See `cj-connection-management`, "Admin can configure a CJ Dropshipping connection for a supplier".

### Requirement: Admin can retrieve Spocket connection status without secrets
**Reason**: Same as above — the underlying provider and route (`/api/admin/suppliers/:supplierId/spocket/connection`) are replaced, not extended.
**Migration**: See `cj-connection-management`, "Admin can retrieve CJ Dropshipping connection status without secrets".

### Requirement: Admin can verify a Spocket connection
**Reason**: The Spocket verify contract was never real. CJ verification uses a different real endpoint (`GET /setting/get`) and a different auth flow (apiKey → accessToken/refreshToken, not a static bearer key).
**Migration**: See `cj-connection-management`, "Admin can verify a CJ Dropshipping connection".

### Requirement: Spocket connection endpoints are admin-only and credentials are never exposed
**Reason**: Route base path moves from `/api/admin/suppliers/:supplierId/spocket/*` to `/api/admin/suppliers/:supplierId/cj/*`.
**Migration**: See `cj-connection-management`, "CJ Dropshipping connection endpoints are admin-only and credentials are never exposed".
