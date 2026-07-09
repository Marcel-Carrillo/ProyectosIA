import { extractCjImages, planProductImages } from '../cjImageExtraction';

describe('extractCjImages', () => {
  it('should_return_both_images_when_present_and_valid', () => {
    const result = extractCjImages({
      product: { bigImage: 'https://a/p.jpg' },
      variant: { variantImage: 'https://a/v.jpg' },
    });

    expect(result).toEqual({ productImage: 'https://a/p.jpg', variantImage: 'https://a/v.jpg' });
  });

  it('should_return_only_productImage_when_variant_is_missing', () => {
    const result = extractCjImages({ product: { bigImage: 'https://a/p.jpg' } });

    expect(result).toEqual({ productImage: 'https://a/p.jpg' });
  });

  it('should_return_only_variantImage_when_product_is_missing', () => {
    const result = extractCjImages({ variant: { variantImage: 'https://a/v.jpg' } });

    expect(result).toEqual({ variantImage: 'https://a/v.jpg' });
  });

  it.each([null, undefined, 'a string', 42, [1, 2]])(
    'should_return_empty_object_when_rawPayload_is_not_an_object (%p)',
    (value) => {
      expect(extractCjImages(value)).toEqual({});
    }
  );

  it('should_return_empty_object_when_product_and_variant_keys_are_both_absent', () => {
    expect(extractCjImages({})).toEqual({});
  });

  it.each([12345, null, {}])('should_ignore_non_string_bigImage (%p)', (bigImage) => {
    expect(extractCjImages({ product: { bigImage } })).toEqual({});
  });

  it.each(['', '   '])('should_ignore_empty_or_whitespace_only_image_urls (%p)', (bigImage) => {
    expect(extractCjImages({ product: { bigImage } })).toEqual({});
  });

  it('should_ignore_a_non_object_product_or_variant_value', () => {
    expect(extractCjImages({ product: 'not-an-object', variant: ['a'] })).toEqual({});
  });

  it('should_never_throw_for_a_deeply_malformed_shape', () => {
    expect(() => extractCjImages(() => undefined)).not.toThrow();
    expect(extractCjImages(() => undefined)).toEqual({});
    expect(() => extractCjImages(Symbol('x'))).not.toThrow();
    expect(extractCjImages(Symbol('x'))).toEqual({});
  });
});

describe('planProductImages', () => {
  it('should_use_the_product_image_as_main_when_present', () => {
    const plan = planProductImages([{ productImage: 'A', altText: 'Dress' }]);

    expect(plan.mainImageUrl).toBe('A');
    expect(plan.images).toEqual([{ url: 'A', altText: 'Dress' }]);
  });

  it('should_fall_back_to_the_first_variant_image_as_main_when_no_product_image_exists', () => {
    // Regression: previously a product with only variant-level images ended up
    // with ProductImage rows but a permanently-null mainImageUrl.
    const plan = planProductImages([
      { variantImage: 'V1', altText: 'Dress Blue' },
      { variantImage: 'V2', altText: 'Dress Red' },
    ]);

    expect(plan.mainImageUrl).toBe('V1');
    expect(plan.images).toEqual([
      { url: 'V1', altText: 'Dress Blue' },
      { url: 'V2', altText: 'Dress Red' },
    ]);
  });

  it('should_prefer_a_product_image_found_on_a_later_item_over_an_earlier_variant_image', () => {
    const plan = planProductImages([
      { variantImage: 'V1', altText: 'Item 1' },
      { productImage: 'P', altText: 'Item 2' },
    ]);

    // Product-level image always wins as main, regardless of item order —
    // then variant images are appended in item order.
    expect(plan.mainImageUrl).toBe('P');
    expect(plan.images).toEqual([
      { url: 'P', altText: 'Item 2' },
      { url: 'V1', altText: 'Item 1' },
    ]);
  });

  it('should_deduplicate_identical_urls_across_items', () => {
    const plan = planProductImages([
      { productImage: 'A', variantImage: 'A', altText: 'Item 1' },
      { variantImage: 'A', altText: 'Item 2' },
    ]);

    expect(plan.images).toEqual([{ url: 'A', altText: 'Item 1' }]);
  });

  it('should_return_no_main_image_and_an_empty_list_when_no_item_has_any_image', () => {
    const plan = planProductImages([{ altText: 'Item 1' }, { altText: 'Item 2' }]);

    expect(plan.mainImageUrl).toBeUndefined();
    expect(plan.images).toEqual([]);
  });

  it('should_return_an_empty_plan_for_an_empty_items_array', () => {
    expect(planProductImages([])).toEqual({ mainImageUrl: undefined, images: [] });
  });
});
