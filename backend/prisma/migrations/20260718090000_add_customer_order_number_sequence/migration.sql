-- Replaces the racy MAX(orderNumber)+1 scan in
-- CustomerOrderRepository.generateNextOrderNumber with an atomic Postgres
-- sequence: two concurrent checkouts previously computed the same next number
-- and the second insert failed on the orderNumber unique constraint.
--
-- Seeded from the current highest ORD-* number so numbering continues without
-- collisions. Non-ORD orderNumbers (test fixtures like E2E-*) are ignored,
-- matching the old scan's regex. Numbers may now skip values when a checkout
-- rolls back after a Stripe failure (sequences are non-transactional by
-- design); order numbers are customer references, not invoice numbers, so
-- gaps are acceptable.
CREATE SEQUENCE IF NOT EXISTS "customer_order_number_seq";

SELECT setval(
  'customer_order_number_seq',
  COALESCE(
    (
      SELECT MAX(CAST(SUBSTRING("orderNumber" FROM 5) AS INTEGER))
      FROM "CustomerOrder"
      WHERE "orderNumber" ~ '^ORD-[0-9]+$'
    ),
    0
  ) + 1,
  false
);
