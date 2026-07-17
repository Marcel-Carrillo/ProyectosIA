// Mirrors backend/src/application/services/pricing.ts — keep the formula
// identical so the promote modal preview matches what the server persists.

export function roundToPsychologicalPrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const cents = Math.round(value * 100 + 1e-9);
  const wholeUnits = Math.floor(cents / 100);
  return Math.round((wholeUnits + 0.99) * 100) / 100;
}

/** Markup 1.6 = 60% margin on supplier cost only. */
export const CJ_DEFAULT_MARKUP_MULTIPLIER = Number(
  import.meta.env.VITE_CJ_DEFAULT_MARKUP_MULTIPLIER ?? 1.6
);

/** Flat shipping add-on in store currency (not marked up). */
export const CJ_DEFAULT_SHIPPING_ESTIMATE = Number(
  import.meta.env.VITE_CJ_DEFAULT_SHIPPING_ESTIMATE ?? 8
);

/** publicPrice = cost * markup + shipping, rounded to ",99". */
export function computeCjPublicPrice(
  supplierCost: number,
  markup: number = CJ_DEFAULT_MARKUP_MULTIPLIER,
  shippingEstimate: number = CJ_DEFAULT_SHIPPING_ESTIMATE
): number {
  return roundToPsychologicalPrice(supplierCost * markup + shippingEstimate);
}
