import { buildCjCategoryResolver } from '../cjCategoryResolution';
import { ICjClient } from '../../../infrastructure/external/cjTypes';

function makeCjClient(fetchCategories: ICjClient['fetchCategories']): ICjClient {
  return {
    verifyConnection: jest.fn(),
    fetchCategories,
    fetchCatalog: jest.fn(),
    fetchVariants: jest.fn(),
    calculateFreight: jest.fn(),
    createOrder: jest.fn(),
    getOrderDetail: jest.fn(),
    simulateSandboxAdvance: jest.fn(),
  };
}

describe('buildCjCategoryResolver', () => {
  it('should_resolve_a_leaf_category_id_from_a_multi_level_tree', async () => {
    const cjClient = makeCjClient(
      jest.fn().mockResolvedValue([
        {
          categoryFirstName: 'Women',
          categoryFirstList: [
            {
              categorySecondName: 'Dresses',
              categorySecondList: [{ categoryId: 'cj-100', categoryName: 'Midi Dresses' }],
            },
          ],
        },
      ])
    );

    const resolver = await buildCjCategoryResolver(cjClient);

    expect(resolver.resolve('cj-100')).toBe('Midi Dresses');
  });

  it('should_resolve_leaves_across_multiple_first_and_second_level_branches', async () => {
    const cjClient = makeCjClient(
      jest.fn().mockResolvedValue([
        {
          categoryFirstName: 'Women',
          categoryFirstList: [
            { categorySecondName: 'Dresses', categorySecondList: [{ categoryId: 'cj-100', categoryName: 'Midi Dresses' }] },
            { categorySecondName: 'Shoes', categorySecondList: [{ categoryId: 'cj-200', categoryName: 'Heels' }] },
          ],
        },
        {
          categoryFirstName: 'Accessories',
          categoryFirstList: [
            { categorySecondName: 'Bags', categorySecondList: [{ categoryId: 'cj-300', categoryName: 'Totes' }] },
          ],
        },
      ])
    );

    const resolver = await buildCjCategoryResolver(cjClient);

    expect(resolver.resolve('cj-100')).toBe('Midi Dresses');
    expect(resolver.resolve('cj-200')).toBe('Heels');
    expect(resolver.resolve('cj-300')).toBe('Totes');
  });

  it('should_return_undefined_for_an_unmapped_id', async () => {
    const cjClient = makeCjClient(
      jest.fn().mockResolvedValue([
        {
          categoryFirstName: 'Women',
          categoryFirstList: [
            { categorySecondName: 'Dresses', categorySecondList: [{ categoryId: 'cj-100', categoryName: 'Midi Dresses' }] },
          ],
        },
      ])
    );

    const resolver = await buildCjCategoryResolver(cjClient);

    expect(resolver.resolve('does-not-exist')).toBeUndefined();
  });

  it('should_never_throw_and_yield_an_always_missing_resolver_when_fetchCategories_rejects', async () => {
    const cjClient = makeCjClient(jest.fn().mockRejectedValue(new Error('CJ API unavailable')));

    const resolver = await buildCjCategoryResolver(cjClient);

    expect(resolver.resolve('cj-100')).toBeUndefined();
  });

  it('should_handle_an_empty_tree_gracefully', async () => {
    const cjClient = makeCjClient(jest.fn().mockResolvedValue([]));

    const resolver = await buildCjCategoryResolver(cjClient);

    expect(resolver.resolve('cj-100')).toBeUndefined();
  });
});
