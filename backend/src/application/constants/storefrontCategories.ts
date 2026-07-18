/** Canonical storefront category DB names (must match frontend STOREFRONT_CATEGORY_DB_NAMES). */
export const STOREFRONT_CATEGORY_DB_NAMES = ['Women', 'Men', 'Accessories', 'Shoes'] as const;

export type StorefrontCategoryDbName = (typeof STOREFRONT_CATEGORY_DB_NAMES)[number];

export function isStorefrontCategoryName(name: string): name is StorefrontCategoryDbName {
  return (STOREFRONT_CATEGORY_DB_NAMES as readonly string[]).includes(name);
}
