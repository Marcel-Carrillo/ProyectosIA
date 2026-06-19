import { Decimal } from '@prisma/client/runtime/library';

export function toStripeAmount(amount: Decimal, _currency: string): number {
  return Math.round(amount.times(100).toNumber());
}
