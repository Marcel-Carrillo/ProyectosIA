## ADDED Requirements

### Requirement: Purge identifies demo products by SKU prefix

The system SHALL identify demo products created by the EscuelaJS importer or seed scripts by checking whether any of their `ProductVariant` records have an SKU matching the prefix `EJS-`. Seed products added manually or via other means MAY also be targeted if they have no supplier reference.

#### Scenario: Demo product identification

- **WHEN** a Product has at least one ProductVariant with `sku LIKE 'EJS-%'`
- **THEN** it is classified as a demo product and subject to purge evaluation

#### Scenario: Non-demo product excluded

- **WHEN** a Product has no variants with `EJS-` SKU prefix
- **THEN** it is excluded from purge evaluation and left untouched

---

### Requirement: Purge hard-deletes unreferenced demo products

The system SHALL hard-delete demo products whose variants have NO references in `CustomerOrderItem`, `SupplierOrderItem`, or `WishlistItem`. The deletion SHALL follow FK dependency order: `ProductTranslation`, `ProductImage`, `ProductVariant`, then `Product`.

#### Scenario: Unreferenced demo product

- **WHEN** a demo product's variants appear in none of `CustomerOrderItem`, `SupplierOrderItem`, `WishlistItem`
- **THEN** the purge SHALL hard-delete all child records and the product within the transaction

#### Scenario: Deletion order respects FK constraints

- **WHEN** a product is hard-deleted
- **THEN** `ProductTranslation` and `ProductImage` are deleted before `ProductVariant`, and `ProductVariant` before `Product`

---

### Requirement: Purge soft-deletes referenced demo products

The system SHALL soft-delete demo products whose variants ARE referenced in `CustomerOrderItem`, `SupplierOrderItem`, or `WishlistItem`. Soft-delete sets `Product.deletedAt = now()` and `Product.status = "Archived"` and `ProductVariant.status = "Archived"`. The product record and its variants remain in the database to preserve referential integrity and historical order snapshots.

#### Scenario: Referenced demo product

- **WHEN** a demo product's variant is referenced in at least one `CustomerOrderItem` or `SupplierOrderItem`
- **THEN** the product is NOT hard-deleted; instead `deletedAt` and `status = "Archived"` are set on the product and its variants

#### Scenario: WishlistItem reference prevents hard-delete

- **WHEN** a demo product's variant is referenced in `WishlistItem`
- **THEN** the product is soft-deleted (not hard-deleted), and the WishlistItem remains intact

---

### Requirement: Purge runs in a single database transaction

All delete and update operations in a single purge execution SHALL run inside one Prisma transaction. If any operation fails, the entire transaction SHALL be rolled back and no partial state SHALL be written.

#### Scenario: Failure mid-purge

- **WHEN** an error occurs while deleting the third of ten demo products
- **THEN** all deletions are rolled back and the database remains in its original state

---

### Requirement: Purge supports dry-run mode

The system SHALL support a `--dry-run` flag that runs all identification and classification logic but does NOT execute any write operations. It SHALL report what would be hard-deleted and soft-deleted without modifying the database.

#### Scenario: Dry run execution

- **WHEN** the purge script is run with `--dry-run`
- **THEN** it logs `{ wouldHardDelete: number, wouldSoftDelete: number }` and makes no DB changes

---

### Requirement: Purge reports results

The system SHALL return and log a result object `{ hardDeleted: number, softDeleted: number, skipped: number }` after each execution.

#### Scenario: Mixed purge result

- **WHEN** 8 demo products have no FK references and 2 do
- **THEN** the result is `{ hardDeleted: 8, softDeleted: 2, skipped: 0 }`

#### Scenario: All products skipped (non-demo)

- **WHEN** no products match the EJS-prefix identification criteria
- **THEN** result is `{ hardDeleted: 0, softDeleted: 0, skipped: 0 }` and a message is logged

---

### Requirement: Purge is idempotent

Running the purge script multiple times SHALL produce the same final database state. Products already soft-deleted or hard-deleted SHALL not be processed again.

#### Scenario: Re-run after successful purge

- **WHEN** the purge is run a second time on a database already purged
- **THEN** result is `{ hardDeleted: 0, softDeleted: 0, skipped: 0 }` with no errors
