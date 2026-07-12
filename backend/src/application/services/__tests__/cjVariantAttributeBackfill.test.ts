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
    expect(executeRaw).toHaveBeenCalledTimes(2);
    expect(sqlTextOf(executeRaw.mock.calls[0])).toContain('"CjCatalogItem"');
    const variantSql = sqlTextOf(executeRaw.mock.calls[1]);
    expect(variantSql).toContain('"ProductVariant"');
    expect(variantSql).not.toContain('status');
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
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('should_be_idempotent_when_called_with_an_empty_plan', async () => {
    const result = await backfillVariantAttributes(client as never, []);

    expect(result).toEqual({ itemsUpdated: 0, variantsUpdated: 0 });
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
