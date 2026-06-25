/** Canonical storefront category order (matches Mavile fashion catalog). */
export const STOREFRONT_CATEGORY_ORDER = ['women', 'men', 'accessories', 'shoes'] as const;

export type StorefrontCategoryKey = (typeof STOREFRONT_CATEGORY_ORDER)[number];

/** Maps canonical key → exact DB category name from seed. */
export const STOREFRONT_CATEGORY_DB_NAMES: Record<StorefrontCategoryKey, string> = {
  women: 'Women',
  men: 'Men',
  accessories: 'Accessories',
  shoes: 'Shoes',
};

export function categoryNameToKey(name: string): StorefrontCategoryKey | null {
  const normalized = name.trim().toLowerCase();
  const entry = Object.entries(STOREFRONT_CATEGORY_DB_NAMES).find(
    ([, dbName]) => dbName.toLowerCase() === normalized,
  );
  return entry ? (entry[0] as StorefrontCategoryKey) : null;
}
