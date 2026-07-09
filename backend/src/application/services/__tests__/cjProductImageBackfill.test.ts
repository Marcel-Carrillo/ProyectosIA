import { groupVariantsByProduct, backfillProductImages, EligibleVariantRow } from '../cjProductImageBackfill';

describe('groupVariantsByProduct', () => {
  it('should_group_multiple_rows_sharing_the_same_productId_into_one_candidate', () => {
    const rows: EligibleVariantRow[] = [
      { productId: 1, rawPayload: {}, title: 'A' },
      { productId: 1, rawPayload: {}, title: 'B' },
    ];

    const result = groupVariantsByProduct(rows);

    expect(result).toEqual([{ productId: 1, variants: rows }]);
  });

  it('should_keep_distinct_productIds_as_separate_candidates', () => {
    const rows: EligibleVariantRow[] = [
      { productId: 1, rawPayload: {}, title: 'A' },
      { productId: 2, rawPayload: {}, title: 'B' },
    ];

    const result = groupVariantsByProduct(rows);

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.productId).sort()).toEqual([1, 2]);
  });

  it('should_return_an_empty_array_for_empty_input', () => {
    expect(groupVariantsByProduct([])).toEqual([]);
  });
});

describe('backfillProductImages', () => {
  let mockProductUpdate: jest.Mock;
  let mockProductImageCreate: jest.Mock;
  let client: { product: { update: jest.Mock }; productImage: { create: jest.Mock } };

  beforeEach(() => {
    mockProductUpdate = jest.fn().mockResolvedValue({});
    mockProductImageCreate = jest.fn().mockResolvedValue({});
    client = { product: { update: mockProductUpdate }, productImage: { create: mockProductImageCreate } };
  });

  it('should_backfill_the_main_image_from_the_first_variants_rawPayload_and_report_imaged_true', async () => {
    const candidate = {
      productId: 20,
      variants: [{ productId: 20, rawPayload: { product: { bigImage: 'https://a/p.jpg' } }, title: 'Dress' }],
    };

    const result = await backfillProductImages(client as never, candidate);

    expect(result.imaged).toBe(true);
    expect(mockProductUpdate).toHaveBeenCalledWith({ where: { id: 20 }, data: { mainImageUrl: 'https://a/p.jpg' } });
    expect(mockProductImageCreate).toHaveBeenCalledWith({
      data: { productId: 20, url: 'https://a/p.jpg', altText: 'Dress', sortOrder: 0 },
    });
  });

  it('should_backfill_a_distinct_variant_image_for_a_second_variant_in_the_group', async () => {
    const candidate = {
      productId: 20,
      variants: [
        { productId: 20, rawPayload: { product: { bigImage: 'A' } }, title: 'Dress' },
        { productId: 20, rawPayload: { variant: { variantImage: 'B' } }, title: 'Dress Blue' },
      ],
    };

    const result = await backfillProductImages(client as never, candidate);

    expect(result.imaged).toBe(true);
    expect(mockProductImageCreate).toHaveBeenCalledTimes(2);
    expect(mockProductImageCreate).toHaveBeenNthCalledWith(2, {
      data: { productId: 20, url: 'B', altText: 'Dress Blue', sortOrder: 1 },
    });
  });

  it('should_backfill_mainImageUrl_from_the_first_variant_image_when_no_product_image_exists', async () => {
    const candidate = {
      productId: 20,
      variants: [{ productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg' } }, title: 'Dress Blue' }],
    };

    const result = await backfillProductImages(client as never, candidate);

    expect(result.imaged).toBe(true);
    expect(mockProductUpdate).toHaveBeenCalledWith({ where: { id: 20 }, data: { mainImageUrl: 'https://a/v.jpg' } });
  });

  it('should_not_duplicate_when_a_variants_image_matches_the_product_image', async () => {
    const candidate = {
      productId: 20,
      variants: [
        { productId: 20, rawPayload: { product: { bigImage: 'A' } }, title: 'Dress' },
        { productId: 20, rawPayload: { variant: { variantImage: 'A' } }, title: 'Dress Blue' },
      ],
    };

    await backfillProductImages(client as never, candidate);

    expect(mockProductImageCreate).toHaveBeenCalledTimes(1);
  });

  it('should_report_imaged_false_and_write_nothing_when_no_candidate_has_any_image_data', async () => {
    const candidate = { productId: 20, variants: [{ productId: 20, rawPayload: {}, title: 'Dress' }] };

    const result = await backfillProductImages(client as never, candidate);

    expect(result.imaged).toBe(false);
    expect(mockProductUpdate).not.toHaveBeenCalled();
    expect(mockProductImageCreate).not.toHaveBeenCalled();
  });

  it('should_return_imaged_false_for_an_empty_variants_array', async () => {
    const result = await backfillProductImages(client as never, { productId: 20, variants: [] });

    expect(result.imaged).toBe(false);
    expect(mockProductUpdate).not.toHaveBeenCalled();
    expect(mockProductImageCreate).not.toHaveBeenCalled();
  });
});
