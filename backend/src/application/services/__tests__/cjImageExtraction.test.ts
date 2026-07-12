import { extractCjImages, planProductImages } from '../cjImageExtraction';

describe('extractCjImages', () => {
  it('should_return_both_images_when_present_and_valid', () => {
    const result = extractCjImages({
      product: { bigImage: 'https://a/p.jpg' },
      variant: { variantImage: 'https://a/v.jpg' },
    });

    expect(result).toEqual({ productImage: 'https://a/p.jpg', variantImage: 'https://a/v.jpg', color: null });
  });

  it('should_derive_color_from_the_variants_variantKey_alongside_variantImage', () => {
    const result = extractCjImages({
      variant: { variantImage: 'https://a/v.jpg', variantKey: 'Black-XXL' },
    });

    expect(result).toEqual({ variantImage: 'https://a/v.jpg', color: 'Black' });
  });

  it('should_return_only_productImage_when_variant_is_missing', () => {
    const result = extractCjImages({ product: { bigImage: 'https://a/p.jpg' } });

    expect(result).toEqual({ productImage: 'https://a/p.jpg', color: null });
  });

  it('should_return_only_variantImage_when_product_is_missing', () => {
    const result = extractCjImages({ variant: { variantImage: 'https://a/v.jpg' } });

    expect(result).toEqual({ variantImage: 'https://a/v.jpg', color: null });
  });

  it.each([null, undefined, 'a string', 42, [1, 2]])(
    'should_return_a_null_color_object_when_rawPayload_is_not_an_object (%p)',
    (value) => {
      expect(extractCjImages(value)).toEqual({ color: null });
    }
  );

  it('should_return_a_null_color_object_when_product_and_variant_keys_are_both_absent', () => {
    expect(extractCjImages({})).toEqual({ color: null });
  });

  it.each([12345, null, {}])('should_ignore_non_string_bigImage (%p)', (bigImage) => {
    expect(extractCjImages({ product: { bigImage } })).toEqual({ color: null });
  });

  it.each(['', '   '])('should_ignore_empty_or_whitespace_only_image_urls (%p)', (bigImage) => {
    expect(extractCjImages({ product: { bigImage } })).toEqual({ color: null });
  });

  it('should_ignore_a_non_object_product_or_variant_value', () => {
    expect(extractCjImages({ product: 'not-an-object', variant: ['a'] })).toEqual({ color: null });
  });

  it('should_never_throw_for_a_deeply_malformed_shape', () => {
    expect(() => extractCjImages(() => undefined)).not.toThrow();
    expect(extractCjImages(() => undefined)).toEqual({ color: null });
    expect(() => extractCjImages(Symbol('x'))).not.toThrow();
    expect(extractCjImages(Symbol('x'))).toEqual({ color: null });
  });
});

describe('planProductImages', () => {
  it('should_use_the_product_image_as_main_when_present', () => {
    const plan = planProductImages([{ productImage: 'A', altText: 'Dress', color: null }]);

    expect(plan.mainImageUrl).toBe('A');
    expect(plan.images).toEqual([{ url: 'A', altText: 'Dress', color: null }]);
  });

  it('should_fall_back_to_the_first_variant_image_as_main_when_no_product_image_exists', () => {
    // Regression: previously a product with only variant-level images ended up
    // with ProductImage rows but a permanently-null mainImageUrl.
    const plan = planProductImages([
      { variantImage: 'V1', altText: 'Dress Blue', color: 'Blue' },
      { variantImage: 'V2', altText: 'Dress Red', color: 'Red' },
    ]);

    expect(plan.mainImageUrl).toBe('V1');
    expect(plan.images).toEqual([
      { url: 'V1', altText: 'Dress Blue', color: 'Blue' },
      { url: 'V2', altText: 'Dress Red', color: 'Red' },
    ]);
  });

  it('should_prefer_a_product_image_found_on_a_later_item_over_an_earlier_variant_image', () => {
    const plan = planProductImages([
      { variantImage: 'V1', altText: 'Item 1', color: 'Blue' },
      { productImage: 'P', altText: 'Item 2', color: null },
    ]);

    // Product-level image always wins as main, regardless of item order —
    // then variant images are appended in item order.
    expect(plan.mainImageUrl).toBe('P');
    expect(plan.images).toEqual([
      { url: 'P', altText: 'Item 2', color: null },
      { url: 'V1', altText: 'Item 1', color: 'Blue' },
    ]);
  });

  it('should_deduplicate_identical_urls_across_items', () => {
    const plan = planProductImages([
      { productImage: 'A', variantImage: 'A', altText: 'Item 1', color: null },
      { variantImage: 'A', altText: 'Item 2', color: null },
    ]);

    expect(plan.images).toEqual([{ url: 'A', altText: 'Item 1', color: null }]);
  });

  it('should_force_the_product_level_image_color_to_null_even_if_the_item_has_a_derived_color', () => {
    // A product-level image is shared regardless of which variant supplied
    // the rawPayload it came from — design.md D1.
    const plan = planProductImages([{ productImage: 'P', altText: 'Item 1', color: 'Black' }]);

    expect(plan.images).toEqual([{ url: 'P', altText: 'Item 1', color: null }]);
  });

  it('should_not_duplicate_when_a_colored_variant_image_matches_the_product_image_url', () => {
    // Regression: keying dedup by (url, color) must not resurrect a
    // duplicate row for a variant whose image happens to equal the
    // product-level image but which itself derives a non-null color — the
    // "variant image matches product image" no-duplicate rule must hold
    // regardless of that variant's derived color.
    const plan = planProductImages([
      { productImage: 'SHARED', altText: 'Product shot', color: null },
      { variantImage: 'SHARED', altText: 'Black variant', color: 'Black' },
    ]);

    expect(plan.images).toEqual([{ url: 'SHARED', altText: 'Product shot', color: null }]);
  });

  it('should_keep_separate_rows_when_two_different_colors_share_the_same_variant_image_url', () => {
    const plan = planProductImages([
      { variantImage: 'SAME', altText: 'Black variant', color: 'Black' },
      { variantImage: 'SAME', altText: 'Red variant', color: 'Red' },
    ]);

    expect(plan.images).toEqual([
      { url: 'SAME', altText: 'Black variant', color: 'Black' },
      { url: 'SAME', altText: 'Red variant', color: 'Red' },
    ]);
  });

  it('should_dedupe_same_color_variant_images_sharing_a_url_into_one_row', () => {
    const plan = planProductImages([
      { variantImage: 'SAME', altText: 'Black M', color: 'Black' },
      { variantImage: 'SAME', altText: 'Black L', color: 'Black' },
    ]);

    expect(plan.images).toEqual([{ url: 'SAME', altText: 'Black M', color: 'Black' }]);
  });

  it('should_return_no_main_image_and_an_empty_list_when_no_item_has_any_image', () => {
    const plan = planProductImages([{ altText: 'Item 1', color: null }, { altText: 'Item 2', color: null }]);

    expect(plan.mainImageUrl).toBeUndefined();
    expect(plan.images).toEqual([]);
  });

  it('should_return_an_empty_plan_for_an_empty_items_array', () => {
    expect(planProductImages([])).toEqual({ mainImageUrl: undefined, images: [] });
  });
});
