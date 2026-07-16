// Rounds a raw computed price (cost + shipping + markup) up to a
// psychological retail ending ("…,99") so admins are never left with an
// arbitrary decimal like 13.47. Always rounds UP (ceil to the next whole
// unit, minus 0.01) so the rounding itself never erodes margin.
export function roundToPsychologicalPrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  // Work in whole cents (rounded to the nearest cent first) rather than
  // ceil()-ing the float directly: a plain `Math.ceil(value) - 0.01` lands
  // *below* the raw value both for exact whole numbers (23 -> 22.99) and for
  // values whose cents already round up past 99 (9.999 -> ceil 10 -> 9.99,
  // still under 9.999). Truncating to whole currency units after cent
  // rounding sidesteps both cases: the result is always that unit's ",99".
  const cents = Math.round(value * 100);
  const wholeUnits = Math.floor(cents / 100);
  return Math.round((wholeUnits + 0.99) * 100) / 100;
}
