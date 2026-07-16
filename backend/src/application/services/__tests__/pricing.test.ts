import { roundToPsychologicalPrice } from '../pricing';

describe('roundToPsychologicalPrice', () => {
  it('should_round_up_a_decimal_value_to_the_next_dot99_ending', () => {
    expect(roundToPsychologicalPrice(13.42)).toBe(13.99);
    expect(roundToPsychologicalPrice(9.03)).toBe(9.99);
  });

  it('should_round_up_an_exact_whole_number_instead_of_landing_below_it', () => {
    // Regression: Math.ceil(23) - 0.01 would incorrectly return 22.99 (below
    // the input) for an already-whole value.
    expect(roundToPsychologicalPrice(23)).toBe(23.99);
    expect(roundToPsychologicalPrice(10)).toBe(10.99);
  });

  it('should_never_return_a_result_below_the_raw_input', () => {
    for (const value of [0.5, 1, 4.99, 9.999, 15, 99.01, 8.995, 9.995, 12.995, 100, 0.99, 4.995]) {
      expect(roundToPsychologicalPrice(value)).toBeGreaterThanOrEqual(value);
    }
  });

  it('should_round_up_past_the_dot99_boundary_instead_of_tie_breaking_down_on_float_noise', () => {
    // Regression: `9.995 * 100` evaluates to 999.4999999999999 in IEEE-754,
    // not 999.5, which previously made Math.round tie-break down to 9.99 —
    // one cent *below* the raw 9.995 input.
    expect(roundToPsychologicalPrice(9.995)).toBe(10.99);
    expect(roundToPsychologicalPrice(8.995)).toBe(9.99);
  });

  it('should_return_0_for_non_finite_or_non_positive_input', () => {
    expect(roundToPsychologicalPrice(0)).toBe(0);
    expect(roundToPsychologicalPrice(-5)).toBe(0);
    expect(roundToPsychologicalPrice(NaN)).toBe(0);
    expect(roundToPsychologicalPrice(Infinity)).toBe(0);
  });
});
