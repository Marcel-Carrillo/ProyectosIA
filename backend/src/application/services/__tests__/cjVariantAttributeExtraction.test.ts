import { extractCjVariantAttributes } from '../cjVariantAttributeExtraction';

describe('extractCjVariantAttributes', () => {
  it('should_derive_color_and_size_from_variantKey_Black-XXL', () => {
    expect(extractCjVariantAttributes({ variantKey: 'Black-XXL' })).toEqual({
      color: 'Black',
      size: 'XXL',
    });
  });

  it('should_classify_numeric_size_in_Blue-37', () => {
    expect(extractCjVariantAttributes({ variantKey: 'Blue-37' })).toEqual({
      color: 'Blue',
      size: '37',
    });
  });

  it('should_classify_EU_size_token', () => {
    expect(extractCjVariantAttributes({ variantKey: 'EU38' })).toEqual({
      color: null,
      size: 'EU38',
    });
  });

  it('should_treat_single_alpha_size_token_as_size_only', () => {
    expect(extractCjVariantAttributes({ variantKey: 'XL' })).toEqual({
      color: null,
      size: 'XL',
    });
  });

  it('should_treat_single_non_size_token_as_color_only', () => {
    expect(extractCjVariantAttributes({ variantKey: 'Red' })).toEqual({
      color: 'Red',
      size: null,
    });
  });

  it('should_join_multi_word_color_before_size_in_variantKey', () => {
    expect(extractCjVariantAttributes({ variantKey: 'Ivory white-S' })).toEqual({
      color: 'Ivory white',
      size: 'S',
    });
  });

  it('should_use_variantNameEn_when_variantKey_is_absent', () => {
    expect(
      extractCjVariantAttributes({
        variantNameEn: 'Summer Dress Black XXL',
      })
    ).toEqual({
      color: 'Black',
      size: 'XXL',
    });
  });

  it('should_not_override_variantKey_with_variantNameEn', () => {
    expect(
      extractCjVariantAttributes({
        variantKey: 'Black-XXL',
        variantNameEn: 'Other Name Red S',
      })
    ).toEqual({
      color: 'Black',
      size: 'XXL',
    });
  });

  it('should_fallback_to_variantProperty_JSON_when_variantKey_absent', () => {
    expect(
      extractCjVariantAttributes({
        variantProperty: '[{"key":"Color","value":"Green"},{"key":"Size","value":"M"}]',
      })
    ).toEqual({
      color: 'Green',
      size: 'M',
    });
  });

  it('should_return_nulls_for_garbage_input_without_throwing', () => {
    expect(extractCjVariantAttributes({ variantKey: '???-???-???' })).toEqual({
      color: '??? ??? ???',
      size: null,
    });
    expect(extractCjVariantAttributes({ variantProperty: 'not-json' })).toEqual({
      color: null,
      size: null,
    });
    expect(extractCjVariantAttributes({})).toEqual({ color: null, size: null });
  });

  it('should_prefer_null_size_when_multiple_size_tokens_create_ambiguity', () => {
    expect(extractCjVariantAttributes({ variantKey: 'XL-XXL' })).toEqual({
      color: null,
      size: null,
    });
  });
});
