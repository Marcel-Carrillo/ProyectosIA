-- Data-only migration: the admin UI historically sent Shopify-style stock
-- policy values (TRACK / DONT_TRACK / DENY) while the domain vocabulary is
-- SupplierManaged / InternalStock / Hybrid. Backend validation now rejects the
-- legacy values; normalize existing rows so reads and edits stay consistent.
-- TRACK meant "we track stock ourselves" -> InternalStock.
-- DONT_TRACK / DENY carried no internal-stock semantics in this supplier-
-- fulfilled model -> SupplierManaged (the schema default).

UPDATE "ProductVariant" SET "stockPolicy" = 'InternalStock' WHERE "stockPolicy" = 'TRACK';
UPDATE "ProductVariant" SET "stockPolicy" = 'SupplierManaged' WHERE "stockPolicy" IN ('DONT_TRACK', 'DENY');
