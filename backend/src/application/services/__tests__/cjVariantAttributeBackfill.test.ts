import {
  planVariantAttributeUpdates,
  backfillVariantAttributes,
  BackfillCandidateRow,
} from '../cjVariantAttributeBackfill';

describe('planVariantAttributeUpdates', () => {
  it('should_plan_an_update_from_rawPayload_variantKey', () => {
    const rows: BackfillCandidateRow[] = [
      {
        cjCatalogItemId: 1,
        productVariantId: 10,
        productId: 100,
        currentSize: null,
        currentColor: null,
        rawPayload: { variant: { variantKey: 'Black-XXL' } },
      },
    ];

    const { updates, skippedAmbiguous } = planVariantAttributeUpdates(rows);

    expect(skippedAmbiguous).toBe(0);
    expect(updates).toEqual([
      {
        cjCatalogItemId: 1,
        productVariantId: 10,
        productId: 100,
        size: 'XXL',
        color: 'Black',
      },
    ]);
  });

  it('should_return_no_updates_when_attributes_already_match', () => {
    const rows: BackfillCandidateRow[] = [
      {
        cjCatalogItemId: 1,
        productVariantId: 10,
        productId: 100,
        currentSize: 'XXL',
        currentColor: 'Black',
        rawPayload: { variant: { variantKey: 'Black-XXL' } },
      },
    ];

    expect(planVariantAttributeUpdates(rows)).toEqual({ updates: [], skippedAmbiguous: 0 });
  });

  it('should_skip_sibling_size_color_collisions', () => {
    const rows: BackfillCandidateRow[] = [
      {
        cjCatalogItemId: 1,
        productVariantId: 10,
        productId: 100,
        currentSize: 'XXL',
        currentColor: 'Black',
        rawPayload: { variant: { variantKey: 'Black-XXL' } },
      },
      {
        cjCatalogItemId: 2,
        productVariantId: 11,
        productId: 100,
        currentSize: null,
        currentColor: null,
        rawPayload: { variant: { variantKey: 'Black-XXL' } },
      },
    ];

    const { updates, skippedAmbiguous } = planVariantAttributeUpdates(rows);

    expect(skippedAmbiguous).toBe(1);
    expect(updates).toEqual([]);
  });
});

describe('backfillVariantAttributes', () => {
  let mockCjCatalogItemUpdate: jest.Mock;
  let mockProductVariantUpdate: jest.Mock;
  let client: { cjCatalogItem: { update: jest.Mock }; productVariant: { update: jest.Mock } };

  beforeEach(() => {
    mockCjCatalogItemUpdate = jest.fn().mockResolvedValue({});
    mockProductVariantUpdate = jest.fn().mockResolvedValue({});
    client = {
      cjCatalogItem: { update: mockCjCatalogItemUpdate },
      productVariant: { update: mockProductVariantUpdate },
    };
  });

  it('should_update_catalog_item_and_linked_variant_size_color', async () => {
    const result = await backfillVariantAttributes(client as never, [
      {
        cjCatalogItemId: 1,
        productVariantId: 10,
        productId: 100,
        size: 'XXL',
        color: 'Black',
      },
    ]);

    expect(result).toEqual({ itemsUpdated: 1, variantsUpdated: 1 });
    expect(mockCjCatalogItemUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { size: 'XXL', color: 'Black' },
    });
    expect(mockProductVariantUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { size: 'XXL', color: 'Black' },
    });
    expect(mockProductVariantUpdate.mock.calls[0][0].data).not.toHaveProperty('status');
  });

  it('should_update_only_catalog_item_when_not_promoted', async () => {
    const result = await backfillVariantAttributes(client as never, [
      {
        cjCatalogItemId: 2,
        productVariantId: null,
        productId: null,
        size: 'M',
        color: 'Green',
      },
    ]);

    expect(result).toEqual({ itemsUpdated: 1, variantsUpdated: 0 });
    expect(mockProductVariantUpdate).not.toHaveBeenCalled();
  });

  it('should_be_idempotent_when_called_with_an_empty_plan', async () => {
    const result = await backfillVariantAttributes(client as never, []);

    expect(result).toEqual({ itemsUpdated: 0, variantsUpdated: 0 });
    expect(mockCjCatalogItemUpdate).not.toHaveBeenCalled();
  });
});
