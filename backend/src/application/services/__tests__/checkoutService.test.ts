import { variantSelectForOrder } from '../checkoutService';

// Regression guard for the shipping-margin-guardrail change: checkout's own
// price-computation Prisma select must never reach into supplierCost or
// shippingCostEstimate. checkoutService.ts hard-codes `shipping = new
// Decimal(0)` regardless of any variant's margin data, and this select never
// even fetches supplierCost/shippingCostEstimate to reach it — so a variant
// sold at a loss can never leak a shipping charge, or any margin field,
// through checkout.
describe('checkoutService — variantSelectForOrder never touches margin/supplier fields', () => {
  it('does not select supplierCost', () => {
    expect(variantSelectForOrder).not.toHaveProperty('supplierCost');
  });

  it('does not select shippingCostEstimate', () => {
    expect(variantSelectForOrder).not.toHaveProperty('shippingCostEstimate');
  });

  it('does not select supplierId or supplierReference', () => {
    expect(variantSelectForOrder).not.toHaveProperty('supplierId');
    expect(variantSelectForOrder).not.toHaveProperty('supplierReference');
  });
});
