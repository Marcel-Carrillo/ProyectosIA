## Context

The project already has `Customer` and `CustomerAddress` entities defined in the Prisma schema (`docs/data-model.md`). No migration is expected. The `supplier-management` module (KAN-16) established the structural pattern for admin CRUD modules: Express controllers, application services, Prisma repositories, and validator functions on the backend; a React page with modal forms and an Axios service on the frontend. This design replicates that pattern for customers and their addresses.

The system follows a layered architecture (Presentation → Application → Domain → Infrastructure) with the repository pattern and REST API documented with OpenAPI. Admin routes live under `/api/admin/`.

## Goals / Non-Goals

**Goals:**
- Deliver a complete admin CRUD for `Customer` entities and their `CustomerAddress` sub-resources.
- Follow the supplier-management structural pattern exactly to minimize review friction.
- Protect customer PII — admin-only endpoints, no public exposure.
- Block customer deletion when `CustomerOrder` records exist to preserve referential integrity.
- Validate email uniqueness at both the service layer and the database constraint.

**Non-Goals:**
- Customer self-registration or login (public auth).
- Customer-facing order history or address management.
- Soft-delete for customers (blocked hard delete is sufficient for MVP).
- Email/notification flows on customer creation or update.
- Bulk import or export of customers.

## Decisions

### Decision 1: Delete strategy — blocked hard delete (not soft-delete)
**Choice:** `DELETE /api/admin/customers/:id` performs a physical delete, but returns `409 CUSTOMER_HAS_ORDERS` if any `CustomerOrder` exists for that customer.  
**Rationale:** Customers without orders have no historical significance; physical removal avoids orphan rows. Customers with orders must be preserved to maintain order history integrity. Soft-delete adds complexity (filtering in all queries) without a clear benefit at this stage.  
**Alternative considered:** Soft-delete via `deletedAt`. Rejected — it would require propagating the soft-delete filter across all future customer queries and complicates future customer login work.

### Decision 2: Address ownership validation
**Choice:** Every address operation checks that the `CustomerAddress.customerId` matches the `:customerId` path parameter. Mismatch returns `404 ADDRESS_NOT_FOUND`.  
**Rationale:** Prevents one admin accidentally editing another customer's address by constructing a crafted URL. Returning 404 (not 403) avoids leaking whether the address exists at all.

### Decision 3: Email normalization
**Choice:** Emails are trimmed and lowercased before persistence and uniqueness checks.  
**Rationale:** Prevents duplicate records caused by case differences (`ANA@x.com` vs `ana@x.com`). Applied at the service layer before hitting the repository, consistent with the data model uniqueness constraint.

### Decision 4: Response envelope
**Choice:** Follow the existing standard envelope `{ success: boolean, data: T, message: string }`. List responses wrap paginated data as `{ items, total, page, pageSize }`.  
**Rationale:** Consistent with all existing admin endpoints (categories, products, suppliers). No new serialization contract is introduced.

### Decision 5: Addresses as a sub-resource (not a separate top-level resource)
**Choice:** Address endpoints are nested under `/api/admin/customers/:customerId/addresses`.  
**Rationale:** Addresses only exist in the context of a customer. Nesting makes ownership explicit and prevents address operations without a customer context. This matches REST conventions for owned sub-resources.

### Decision 6: No Prisma migration required
**Choice:** Use the existing `Customer` and `CustomerAddress` Prisma schema as-is.  
**Rationale:** The data model spec already defines both entities with all required fields. Only the application layer (module, service, repository, controller, DTOs) and the frontend are new. If the schema is found to be missing on implementation (e.g., missing `AddressType` enum), a migration shall be added at that point and this design updated accordingly.

## Risks / Trade-offs

- **[Risk] Email uniqueness race condition** → Mitigation: the database `UNIQUE` constraint on `email` is the authoritative guard; the service-layer check is a fast-fail to return a friendly error code before hitting the DB constraint.
- **[Risk] Address count growth** → Mitigation: the `GET /api/admin/customers/:id` detail endpoint returns all addresses inline. If a customer accumulates many addresses in the future, this may need pagination. For MVP the count is expected to be small (1–3 addresses per customer).
- **[Risk] PII logging** → Mitigation: structured logging must not include `email` or `phone` in plain text in log messages. Log only `customerId` and operation name.
- **[Trade-off] Hard delete vs. soft-delete** → Hard delete with a guard keeps queries simple and avoids filter complexity. The trade-off is that once a customer is deleted (no orders), there is no recovery. Acceptable for the admin-only MVP use case.

## Migration Plan

1. Verify `Customer` and `CustomerAddress` tables and the `AddressType` enum exist in the database. If not, generate and run a Prisma migration before any code is deployed.
2. No data migration is required — this is a new capability with no existing data to transform.
3. Rollback: remove customer routes from `backend/src/index.ts` and delete the new backend/frontend files. No schema rollback needed if migration is kept.

## Open Questions

- None blocking implementation. The delete strategy (blocked hard delete) and address ownership approach are defined. If the Prisma schema requires a new migration, that should be confirmed before the backend task starts.
