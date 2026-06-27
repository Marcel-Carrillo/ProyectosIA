/** Canonical storefront category order. */
export const STOREFRONT_CATEGORY_ORDER = ['women', 'men', 'accessories', 'shoes', 'other'] as const;

export type StorefrontCategoryKey = (typeof STOREFRONT_CATEGORY_ORDER)[number];

/** Maps canonical key → exact DB category name. */
export const STOREFRONT_CATEGORY_DB_NAMES: Record<StorefrontCategoryKey, string> = {
  women: 'Women',
  men: 'Men',
  accessories: 'Accessories',
  shoes: 'Shoes',
  other: 'Other',
};

export function categoryNameToKey(name: string): StorefrontCategoryKey | null {
  const normalized = name.trim().toLowerCase();
  const entry = Object.entries(STOREFRONT_CATEGORY_DB_NAMES).find(
    ([, dbName]) => dbName.toLowerCase() === normalized,
  );
  return entry ? (entry[0] as StorefrontCategoryKey) : null;
}
