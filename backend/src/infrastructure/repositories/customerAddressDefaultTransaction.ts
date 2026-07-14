import { Prisma } from '@prisma/client';

export class AddressDefaultConflictError extends Error {
  readonly code = 'ADDRESS_DEFAULT_CONFLICT' as const;
  readonly status = 409;

  constructor() {
    super('Lost a concurrent race to set the default address for this type — please retry');
    this.name = 'AddressDefaultConflictError';
    Object.setPrototypeOf(this, AddressDefaultConflictError.prototype);
  }
}

// Shared by both the self-service (customerAddressRepository.ts) and admin
// (customerRepository.ts) address write paths so the "at most one default
// CustomerAddress per (customerId, type)" invariant is enforced identically
// on both. Must run inside the same transaction as the create/update it
// precedes. The DB-level partial unique index
// (CustomerAddress_customerId_type_default_unique) is the concurrency
// backstop — a losing concurrent transaction gets a P2002 on that
// constraint, which callers should map to a 409 conflict.
export async function unsetPreviousDefaultIfNeeded(
  tx: Prisma.TransactionClient,
  customerId: number,
  type: string,
  isDefault: boolean | undefined
): Promise<void> {
  if (!isDefault) return;
  await tx.customerAddress.updateMany({
    where: { customerId, type, isDefault: true },
    data: { isDefault: false },
  });
}

// CustomerAddress has no other unique constraint besides its primary key, so
// any P2002 raised by a write on this table can only be the partial unique
// index above — a concurrent transaction won the race to set the default
// for this (customerId, type) first.
export function isAddressDefaultConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
