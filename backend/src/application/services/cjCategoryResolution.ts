import { ICjClient } from '../../infrastructure/external/cjTypes';

export interface CjCategoryResolver {
  resolve(categoryId: string): string | undefined;
}

// Builds a leaf categoryId -> categoryName lookup for CJ's category taxonomy,
// for reuse across every pid-group in a single promote() call (design.md
// Decision 3 — fetchCategories() is called at most once per invocation, not
// once per group). The real taxonomy is exactly 3 fixed levels with an id
// only at the leaf (see cjTypes.ts's CjCategoryDto/CjCategorySecondLevelDto/
// CjCategoryLeafDto comment for the verified source), so this walks the
// concrete typed structure rather than an artificially generic arbitrary-depth
// tree.
//
// Never throws: a fetchCategories() failure yields a resolver that misses
// for every id, so callers fall back per the documented resolution order
// (cj-catalog-promotion spec) instead of aborting the whole promote() call.
export async function buildCjCategoryResolver(cjClient: ICjClient): Promise<CjCategoryResolver> {
  const map = new Map<string, string>();
  try {
    const tree = await cjClient.fetchCategories();
    for (const first of tree) {
      for (const second of first.categoryFirstList ?? []) {
        for (const leaf of second.categorySecondList ?? []) {
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
