import { ICjClient } from '../../infrastructure/external/cjTypes';

export interface CjCategoryResolver {
  resolve(categoryId: string): string | undefined;
}

// Builds a categoryId -> categoryName lookup for CJ's taxonomy, for reuse
// across every pid-group in a single promote() call (design.md Decision 3 —
// fetchCategories() is called at most once per invocation, not once per
// group). Live CJ payloads expose ids at all three levels (categoryFirstId,
// categorySecondId, leaf categoryId); product.categoryId usually targets a
// leaf but can also reference a mid-level id on older catalog entries, so
// we register every id we find.
//
// Never throws: a fetchCategories() failure yields a resolver that misses
// for every id, so callers fall back per the documented resolution order
// (cj-catalog-promotion spec) instead of aborting the whole promote() call.
export async function buildCjCategoryResolver(cjClient: ICjClient): Promise<CjCategoryResolver> {
  const map = new Map<string, string>();
  try {
    const tree = await cjClient.fetchCategories();
    for (const first of tree) {
      const firstAny = first as {
        categoryFirstId?: string;
        categoryFirstName: string;
        categoryFirstList?: unknown[];
      };
      if (firstAny.categoryFirstId && firstAny.categoryFirstName) {
        map.set(firstAny.categoryFirstId, firstAny.categoryFirstName);
      }
      for (const second of first.categoryFirstList ?? []) {
        const secondAny = second as {
          categorySecondId?: string;
          categorySecondName: string;
          categorySecondList?: { categoryId: string; categoryName: string }[];
        };
        if (secondAny.categorySecondId && secondAny.categorySecondName) {
          map.set(secondAny.categorySecondId, secondAny.categorySecondName);
        }
        for (const leaf of secondAny.categorySecondList ?? []) {
          map.set(leaf.categoryId, leaf.categoryName);
        }
      }
    }
  } catch {
    // Leave the map empty — resolve() will miss for every id, which is the
    // intended "resolution unavailable" signal to callers.
  }
  return { resolve: (categoryId: string) => map.get(categoryId) };
}
