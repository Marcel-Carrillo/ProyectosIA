import { StorefrontCategoryKey } from './storefrontCategories';

export type CatalogHeroVariantKey = 'slide1' | 'slide2' | 'slide3' | StorefrontCategoryKey | 'search';

export interface CatalogHeroImageSet {
  image: string;
  variant: CatalogHeroVariantKey;
}

/** Curated Unsplash imagery — neutral, editorial, Mavile tone. */
export const CATALOG_HERO_DEFAULT_SLIDES: CatalogHeroImageSet[] = [
  {
    variant: 'slide1',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1800&q=80',
  },
  {
    variant: 'slide2',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1800&q=80',
  },
  {
    variant: 'slide3',
    image: 'https://images.unsplash.com/photo-1483985988354-763728e3685b?auto=format&fit=crop&w=1800&q=80',
  },
];

export const CATALOG_HERO_CATEGORY_IMAGES: Record<StorefrontCategoryKey, string> = {
  women: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1800&q=80',
  men: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1800&q=80',
  accessories: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1800&q=80',
  shoes: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1800&q=80',
};

export const CATALOG_HERO_SEARCH_IMAGE =
  'https://images.unsplash.com/photo-1441984904996-e0b87bdff85f?auto=format&fit=crop&w=1800&q=80';

export const CATALOG_HERO_ROTATE_MS = 7000;
