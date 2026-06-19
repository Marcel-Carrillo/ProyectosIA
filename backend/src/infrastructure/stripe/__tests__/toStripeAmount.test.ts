import { Decimal } from '@prisma/client/runtime/library';
import { toStripeAmount } from '../toStripeAmount';

describe('toStripeAmount', () => {
  it('converts 29.99 EUR to 2999', () => {
    expect(toStripeAmount(new Decimal('29.99'), 'EUR')).toBe(2999);
  });

  it('converts 10.00 EUR to 1000', () => {
    expect(toStripeAmount(new Decimal('10.00'), 'EUR')).toBe(1000);
  });

  it('converts 0.00 EUR to 0', () => {
    expect(toStripeAmount(new Decimal('0.00'), 'EUR')).toBe(0);
  });

  it('rounds 10.005 up to 1001', () => {
    expect(toStripeAmount(new Decimal('10.005'), 'EUR')).toBe(1001);
  });

  it('rounds 10.004 down to 1000', () => {
    expect(toStripeAmount(new Decimal('10.004'), 'EUR')).toBe(1000);
  });

  it('converts 99.99 EUR to 9999', () => {
    expect(toStripeAmount(new Decimal('99.99'), 'EUR')).toBe(9999);
  });
});
