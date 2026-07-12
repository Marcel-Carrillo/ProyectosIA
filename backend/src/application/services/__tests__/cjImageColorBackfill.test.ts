import {
  planImageColorUpdates,
  backfillImageColors,
  BackfillCandidateRow,
  ExistingImageRow,
} from '../cjImageColorBackfill';

describe('planImageColorUpdates', () => {
  it('should_plan_a_color_update_when_a_persisted_image_matches_a_derivable_variant_color', () => {
    const candidates: BackfillCandidateRow[] = [
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg', variantKey: 'Black-XXL' } } },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: null }];

    const { updates, skippedAmbiguous } = planImageColorUpdates(candidates, existing);

    expect(skippedAmbiguous).toBe(0);
    expect(updates).toEqual([{ imageId: 100, color: 'Black' }]);
  });

  it('should_leave_non_matching_images_untouched', () => {
    const candidates: BackfillCandidateRow[] = [
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/other.jpg', variantKey: 'Black-XXL' } } },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: null }];

    expect(planImageColorUpdates(candidates, existing).updates).toEqual([]);
  });

  it('should_report_zero_updates_when_already_backfilled', () => {
    // Idempotence: re-running after a complete run must produce zero changes.
    const candidates: BackfillCandidateRow[] = [
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg', variantKey: 'Black-XXL' } } },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: 'Black' }];

    expect(planImageColorUpdates(candidates, existing).updates).toEqual([]);
  });

  it('should_skip_and_count_ambiguous_matches_when_two_catalog_items_derive_conflicting_colors_for_the_same_image', () => {
    const candidates: BackfillCandidateRow[] = [
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg', variantKey: 'Black-XXL' } } },
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg', variantKey: 'Red-XXL' } } },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: null }];

    const { updates, skippedAmbiguous } = planImageColorUpdates(candidates, existing);

    expect(skippedAmbiguous).toBe(1);
    expect(updates).toEqual([]);
  });

  it('should_leave_color_null_when_the_variant_color_cannot_be_derived', () => {
    const candidates: BackfillCandidateRow[] = [
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg' } } }, // no variantKey/NameEn/Property
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: null }];

    expect(planImageColorUpdates(candidates, existing).updates).toEqual([]);
  });

  it('should_ignore_candidate_rows_with_no_promoted_product', () => {
    const candidates: BackfillCandidateRow[] = [
      { productId: null, rawPayload: { variant: { variantImage: 'https://a/v.jpg', variantKey: 'Black-XXL' } } },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: null }];

    expect(planImageColorUpdates(candidates, existing).updates).toEqual([]);
  });

  it('should_never_assign_a_color_to_a_row_that_is_the_products_shared_main_image', () => {
    // Regression: a candidate's own variantImage can coincidentally equal
    // its product's bigImage (the shared image is often literally the same
    // photo as one variant's). The persisted row for that URL is the
    // product-level image (color must stay null) — it must never be
    // recolored just because a variant with a derivable color also
    // references that same URL.
    const candidates: BackfillCandidateRow[] = [
      {
        productId: 20,
        rawPayload: {
          product: { bigImage: 'https://a/shared.jpg' },
          variant: { variantImage: 'https://a/shared.jpg', variantKey: 'Black-XXL' },
        },
      },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/shared.jpg', color: null }];

    const { updates, skippedAmbiguous } = planImageColorUpdates(candidates, existing);

    expect(updates).toEqual([]);
    expect(skippedAmbiguous).toBe(0);
  });

  it('should_never_modify_url_altText_or_sortOrder_fields', () => {
    // planImageColorUpdates's return shape ({ imageId, color }) makes this
    // structurally true — documented as an explicit regression guard.
    const candidates: BackfillCandidateRow[] = [
      { productId: 20, rawPayload: { variant: { variantImage: 'https://a/v.jpg', variantKey: 'Black-XXL' } } },
    ];
    const existing: ExistingImageRow[] = [{ id: 100, productId: 20, url: 'https://a/v.jpg', color: null }];

    const { updates } = planImageColorUpdates(candidates, existing);

    expect(Object.keys(updates[0]!).sort()).toEqual(['color', 'imageId']);
  });
});

describe('backfillImageColors', () => {
  let executeRaw: jest.Mock;
  let client: { $executeRaw: jest.Mock };

  beforeEach(() => {
    executeRaw = jest.fn().mockResolvedValue(1);
    client = { $executeRaw: executeRaw };
  });

  function sqlTextOf(callArgs: unknown[]): string {
    const strings = callArgs[0] as TemplateStringsArray;
    return strings.join('');
  }

  it('should_bulk_update_image_colors_in_a_single_statement', async () => {
    const result = await backfillImageColors(client as never, [{ imageId: 100, color: 'Black' }]);

    expect(result).toEqual({ imagesUpdated: 1 });
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(sqlTextOf(executeRaw.mock.calls[0])).toContain('"ProductImage"');
  });

  it('should_be_a_no_op_for_an_empty_plan', async () => {
    const result = await backfillImageColors(client as never, []);

    expect(result).toEqual({ imagesUpdated: 0 });
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
